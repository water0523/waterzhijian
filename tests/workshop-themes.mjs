import './workspace-driver.mjs';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {strFromU8,unzipSync} from 'fflate';

const channel=process.env.TEST_BROWSER||'chrome';
const out=path.resolve('test-results/workshop-'+channel);
await mkdir(out,{recursive:true});
process.env.TEMP=process.env.TMP=process.env.TMPDIR=out;
const browser=await chromium.launch({channel,headless:true,downloadsPath:out});
const context=await browser.newContext({
  offline:true,viewport:{width:1680,height:960},acceptDownloads:true,
  permissions:['clipboard-read','clipboard-write']
});
await context.addInitScript(()=>{
  if(window.top!==window)return;
  localStorage.setItem('paper-library-open','false');
  localStorage.setItem('paper-theme-sidebar-open','false');
});
const page=await context.newPage();
page.setDefaultTimeout(12000);
const errors=[],network=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url());});

const themes=[
  ['monocle','摩登画报','rgb(250, 248, 244)','01'],
  ['sakura','草莓奶霜','rgb(255, 248, 250)','01'],
  ['matcha','抹茶晴日','rgb(251, 251, 246)','01'],
  ['celadon','青瓷墨韵','rgb(248, 245, 238)','壹'],
  ['swiss','瑞士网格','rgb(255, 255, 255)','01'],
  ['broadsheet','复古铅印','rgb(244, 236, 216)','I'],
  ['finance','投行研报','rgb(255, 255, 255)','01']
];
const recovery=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')));
const saved=()=>page.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');
const downloads=async selector=>{
  const pending=page.waitForEvent('download');
  await page.click(selector);
  const download=await pending, file=path.join(out,download.suggestedFilename());
  await download.saveAs(file);
  return readFile(file);
};

try{
  await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);
  await page.waitForSelector('.cm-content');
  await saved();
  const original=await recovery();
  assert.equal(await page.locator('#offline-module-workshop').getAttribute('data-loaded'),null);

  await page.click('#theme-button');
  await page.click('[data-group="主题工坊"]');
  assert.deepEqual(await page.locator('#theme-results [data-theme]').evaluateAll(nodes=>nodes.map(n=>n.dataset.theme)),themes.map(([id])=>'workshop-'+id));
  for(const [id,name] of themes){
    await page.click(`[data-theme-preview="workshop-${id}"]`);
    const example=page.frameLocator('.workshop-example-frame');
    assert.equal(await example.locator('#wechat-article > [data-wc-module]').count(),39,name);
    assert.ok(await example.locator('#wechat-article svg').count()>10,name);
    await page.click('#theme-detail-close');
  }
  await page.click('[data-theme="workshop-monocle"]');
  await saved();
  assert.equal((await recovery()).markdown,original.markdown);
  console.log(channel+': all seven original articles open offline, and applying a theme preserves Markdown');

  for(const [id,name,paper,number] of themes){
    await page.click('#samples-button');
    await page.click(`[data-sample="workshop-${id}"]`);
    await page.waitForSelector('#preview .workshop-poster');
    await saved();
    const article=page.locator('#preview');
    assert.equal((await recovery()).theme,'workshop-'+id);
    assert.equal(await article.evaluate(n=>getComputedStyle(n).backgroundColor),paper,name);
    assert.equal(await article.locator('h2 .workshop-number').first().innerText(),number,name);
    assert.equal(await article.locator('.workshop-crest svg').count(),1,name);
    assert.equal(await article.locator('.workshop-compare .workshop-item').count(),2,name);
    const cardColors=await article.locator('.workshop-compare .workshop-item').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));
    assert.equal(new Set(cardColors).size,2,name+' has distinct comparison cards');
    if(id==='swiss'){
      const kpiColors=await article.locator('.workshop-kpi .workshop-item').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));
      assert.equal(new Set(kpiColors).size,3);
    }
    for(const width of ['375','430']){
      await page.selectOption('#preview-width',width);
      assert.ok(await article.evaluate(el=>el.scrollWidth<=el.clientWidth+2),name+' '+width);
    }
    assert.doesNotMatch(await article.innerText(),/:::workshop-/);
    await page.locator('#preview-scroll').evaluate(n=>n.scrollTop=0);
    await article.locator('h1').screenshot({path:path.join(out,id+'-masthead.png')});
  }
  console.log(channel+': each editable sample has its own palette, chapter marks and columns at 375 and 430 px');

  await page.click('#format-rewrite-button');
  const prompt=await page.locator('#format-rewrite-prompt').inputValue();
  assert.match(prompt,/workshop-compare/);
  assert.match(prompt,/逐字保留原文/);
  await page.click('#modal-close');
  await page.click('#workshop-block-button');
  assert.equal(await page.locator('#quick-popover [data-workshop-block]').count(),18);
  await page.click('[data-component-preview="workshop-tip"]');
  assert.equal(await page.locator('#modal-body .workshop-tip').count(),1);
  const tipCount=await page.locator('#preview .workshop-tip').count();
  await page.click('#component-insert');
  await page.waitForFunction(count=>document.querySelectorAll('#preview .workshop-tip').length===count+1,tipCount);
  await saved();
  console.log(channel+': assistant prompt, component preview and insertion are wired through the editor');

  await page.click('#copy-button');
  if(await page.locator('#continue-copy').isVisible())await page.click('#continue-copy');
  await page.waitForFunction(()=>document.getElementById('copy-button').dataset.state==='success');
  const html=await page.evaluate(async()=>{
    const [item]=await navigator.clipboard.read();
    return (await item.getType('text/html')).text();
  });
  assert.match(html,/workshop-poster/);
  assert.doesNotMatch(html,/:::workshop-|contenteditable|<iframe|<script/);
  const output=await context.newPage();
  await output.setViewportSize({width:375,height:800});
  await output.setContent('<style>body{margin:0}</style>'+html);
  assert.equal(await output.locator('.workshop-compare > .workshop-content').evaluate(el=>getComputedStyle(el).display),'table');
  assert.ok(await output.locator('article').evaluate(el=>el.scrollWidth<=el.clientWidth+2));
  await output.close();

  await page.click('#export-toggle');
  const exported=await downloads('#export-html');
  assert.match(exported.toString(),/workshop-compare/);
  assert.match(exported.toString(),/用细节推动叙述/);
  await page.click('#export-toggle');
  const word=unzipSync(await downloads('#export-word'));
  const document=strFromU8(word['word/document.xml']);
  assert.match(document,/用细节推动叙述/);
  assert.doesNotMatch(document,/:::workshop-/);
  assert.deepEqual(errors,[]);
  assert.deepEqual(network,[]);
  console.log(channel+': clipboard keeps the themed cards and Word keeps their editable text, all offline');
}finally{await browser.close();}
