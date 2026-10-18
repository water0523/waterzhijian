import './workspace-driver.mjs';
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
const channel=process.env.STARTUP_BROWSER||'chrome',checks=[],errors=[],network=[],themeRuns=[];
await mkdir('test-results',{recursive:true});
await mkdir(`test-results/startup-${channel}-temp`,{recursive:true});process.env.TEMP=process.env.TMP=process.env.TMPDIR=path.resolve(`test-results/startup-${channel}-temp`);
const browser=await chromium.launch({channel,headless:true,downloadsPath:process.env.TEMP}),context=await browser.newContext({offline:true,viewport:{width:1600,height:1000},acceptDownloads:true}),page=await context.newPage();
const cdp=await browser.newBrowserCDPSession(),{browserContextIds}=await cdp.send('Target.getBrowserContexts');await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',browserContextId:browserContextIds[0],downloadPath:process.env.TEMP});
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
await context.addInitScript(()=>{window.articleReady=0;const observer=new MutationObserver(()=>{if(document.querySelector('.cm-content')&&document.querySelector('#render-state')?.dataset.duration){observer.disconnect();requestAnimationFrame(()=>window.articleReady=performance.now());}});observer.observe(document,{subtree:true,attributes:true,childList:true});});
const modules=()=>page.evaluate(()=>Object.keys(globalThis.__feishuiOfflineModules||{}).sort());
const set=async text=>{await page.locator('.cm-content').click();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await page.waitForTimeout(300);};
const source=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown);
const saved=()=>page.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');
const choose=async id=>{await page.click('#theme-button');await page.click('[data-theme="'+id+'"]');await saved();};
const download=async action=>{const pending=page.waitForEvent('download');await action();const d=await pending,f=path.resolve('test-results/module-'+channel+'-'+d.suggestedFilename());await d.saveAs(f);return readFile(f);};
const check=s=>{checks.push(s);console.log('PASS '+s);};
try{
 await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);await page.waitForFunction(()=>window.articleReady>0);assert.deepEqual(await modules(),['math']);assert.equal(await page.locator('script[type="application/x-feishui-image"][data-loaded]').count(),0);assert.equal(await page.locator('#preview .math-error').count(),0);check('default science article starts only math; Word, code highlighting and seven example images remain unused');
 const prose='# 只恢复上次的主题\n\n今天的文字，只需要安静地呈现在纸上。\n\n## 一段新的思考\n\n保存正文和排版，下次打开时回到这里。';
 await set(prose);
 for(const [id,name] of [['plain','素笺'],['gewu','格物文史'],['press','深度新闻周刊']]){
  await choose(id);
  for(let i=0;i<3;i++){
   await page.reload();await page.waitForFunction(()=>window.articleReady>0);assert.equal(await page.locator('#theme-name').innerText(),name);assert.equal(await source(),prose);assert.deepEqual(await modules(),[]);assert.equal(await page.locator('#theme-sidebar .theme-sample').count(),0);assert.equal(await page.locator('script[type="application/x-feishui-image"][data-loaded]').count(),0);themeRuns.push({theme:id,ready:Math.round(await page.evaluate(()=>window.articleReady))});
  }
 }
 check('plain, gewu and press articles reopen with exactly the saved theme/text and no optional engine or demo image initialization');
 await set(prose+'\n\n$\\frac{a}{b}+\\beta$');assert.deepEqual(await modules(),['math']);assert.equal(await page.locator('#preview .math-inline svg').count(),1);assert.equal(await page.locator('#preview .math-error').count(),0);
 await set(prose+'\n\n```js\nconst answer = 42;\n```');assert.deepEqual(await modules(),['highlight','math']);assert.ok(await page.locator('#preview pre code [class^="hljs-"]').count()>0);check('first formula and first code block initialize their offline engines and render correctly');
 await page.click('#export-toggle');const word=unzipSync(await download(()=>page.click('#export-word')));assert.match(strFromU8(word['word/document.xml']),/只恢复上次的主题/);assert.deepEqual(await modules(),['highlight','math','word']);check('Word engine starts on actual export and produces a valid editable document');
 await page.click('#theme-button');await page.click('[data-theme-preview=folio]');await page.waitForSelector('#theme-detail img');await page.waitForFunction(()=>[...document.querySelectorAll('#theme-detail img')].every(i=>i.complete&&i.naturalWidth>0));assert.equal(await page.locator('script[type="application/x-feishui-image"][data-loaded]').count(),4);await page.click('#theme-detail-close');await page.click('[data-theme-preview=press]');await page.waitForSelector('#theme-detail img');await page.waitForFunction(()=>[...document.querySelectorAll('#theme-detail img')].every(i=>i.complete&&i.naturalWidth>0));assert.equal(await page.locator('script[type="application/x-feishui-image"][data-loaded]').count(),7);await page.click('#modal-close');check('literary and news example images resolve to original data URLs only when their full previews are requested');
 await saved();await page.reload();await page.waitForFunction(()=>window.articleReady>0);assert.deepEqual(await modules(),['highlight']);assert.equal(await page.locator('#theme-name').innerText(),'深度新闻周刊');check('reopening a code article starts highlighting but does not start Word or math used in the previous page');
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);check('all optional functions remain fully offline without runtime errors');
 const median=v=>v.sort((a,b)=>a-b)[Math.floor(v.length/2)],summary=[...new Set(themeRuns.map(r=>r.theme))].map(theme=>({theme,ready:median(themeRuns.filter(r=>r.theme===theme).map(r=>r.ready))}));console.log(JSON.stringify(summary));
 await writeFile('test-results/startup-modules-'+channel+'.json',JSON.stringify({channel,version:browser.version(),checks,themeRuns,summary,errors,network},null,2));
}finally{await browser.close();}
