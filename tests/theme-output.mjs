import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const channel=process.env.THEME_OUTPUT_BROWSER||'chrome',checks=[],errors=[],network=[];
await mkdir(`test-results/theme-output-${channel}-temp`,{recursive:true});process.env.TEMP=process.env.TMP=process.env.TMPDIR=path.resolve(`test-results/theme-output-${channel}-temp`);
const browser=await chromium.launch({channel,headless:true}),context=await browser.newContext({offline:true,viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']}),page=await context.newPage(),copied=await context.newPage();
for(const p of [page,copied]){p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});}
const check=s=>{checks.push(s);console.log('PASS '+s);};
try{
 await page.goto(pathToFileURL(path.resolve('dist/纸间-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
 const text='# 从一束光，走进科学的故事\n\n正文中有**关键证据 25%**与行内公式 $E=mc^2$。\n\n## 短标题\n\n## 很长的标题也应该保持清楚的层级，并让每一行文字都与编号之后的起点对齐\n\n> 阅读的节奏，来自清楚的文字与恰当的留白。\n\n```python\n# 一条可以读清的注释\ndef energy(n):\n    return "light", n * 25\n```';
 await page.locator('.cm-content').click();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await page.waitForTimeout(350);
 for(const id of ['rational','blueprint','academic','nature','tech']){
  await page.bringToFront();await page.click('#theme-button');await page.click(`[data-theme="${id}"]`);await page.click('#copy-button');if(await page.locator('#continue-copy').isVisible())await page.click('#continue-copy');await page.waitForFunction(()=>document.getElementById('copy-button').dataset.state==='success');
  const html=await page.evaluate(async()=>{const [item]=await navigator.clipboard.read();return (await item.getType('text/html')).text();});assert.doesNotMatch(html,/<style|contenteditable=|data-edit-from=/);assert.match(html,/theme-heading-mark/);
  await copied.setViewportSize({width:375,height:900});await copied.setContent('<!doctype html><meta charset="utf-8"><style>body{margin:0}</style>'+html);
  for(const width of [375,430,680]){
   await copied.setViewportSize({width,height:900});
   const metrics=await copied.locator('article').evaluate(article=>{const h=article.querySelector('h2'),long=article.querySelectorAll('h2')[1],range=document.createRange();range.selectNodeContents(long.querySelector('.theme-heading-text'));return {inner:article.clientWidth-parseFloat(getComputedStyle(article).paddingLeft)-parseFloat(getComputedStyle(article).paddingRight),short:h.getBoundingClientRect().width,scroll:article.scrollWidth,width:article.clientWidth,x:[...range.getClientRects()].filter(r=>r.width>0).map(r=>r.left),mark:article.querySelector('.theme-heading-mark').style.width};});
   assert.ok(metrics.scroll<=metrics.width+2,id+' copy overflow');if(id!=='nature')assert.ok(Math.abs(metrics.short-metrics.inner)<2,id+' copied heading lost responsive width');assert.ok(Math.max(...metrics.x)-Math.min(...metrics.x)<1,id+' copied continuation alignment');assert.equal(metrics.mark,'1%');
  }
  await copied.setViewportSize({width:375,height:900});await copied.screenshot({path:`test-results/theme-output-${id}-${channel}.png`,fullPage:true});check(id+' copy has self-contained styles and responsive heading alignment at three widths');
 }
 await page.bringToFront();await page.click('#preview-edit-button');const run=page.locator('#preview h2 .preview-text-run').first();await run.click();await page.keyboard.press('Home');await page.keyboard.type('改好');await run.blur();await page.waitForTimeout(250);assert.match(await page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown),/## 改好短标题/);assert.equal(await page.locator('#preview .theme-heading-mark [contenteditable]').count(),0);check('decorated heading text remains editable while chapter badges stay locked');
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);check('copy and preview editing work fully offline without runtime errors');
}finally{await writeFile(`test-results/theme-output-${channel}.json`,JSON.stringify({channel,checks,errors,network},null,2));await browser.close();}
