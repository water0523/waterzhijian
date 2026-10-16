import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const channel=process.env.IDENTITY_BROWSER||'chrome',checks=[],errors=[];
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel,headless:true});
const context=await browser.newContext({offline:true,viewport:{width:1600,height:1000},permissions:['clipboard-read','clipboard-write']});
const page=await context.newPage(),output=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
const source=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown);
const setText=async text=>{await page.locator('.cm-content').click();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await page.waitForTimeout(400);};
const check=s=>{checks.push(s);console.log('PASS '+s);};
const fixture='# 01 标题保留\n\n## 一、第一节\n\n正文中的 1、顺序保留。\n\n```md\n# 02 代码标题\n```\n\n$$\n1 + 2 = 3\n$$\n\n:::poem center\n# 03 诗行保留\n:::\n\n### （2）末节\n';
const expected=fixture.replace('# 01 标题保留','# 标题保留').replace('## 一、第一节','## 第一节').replace('### （2）末节','### 末节');
const measure=n=>{
 const p=n.closest('p'),r=n.getBoundingClientRect(),ps=getComputedStyle(p),lines=[];
 const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let t;
 while(t=walker.nextNode()){
  if(n.contains(t))continue;
  for(let i=0;i<t.length;i++){
   if(!t.data[i].trim())continue;
   const range=document.createRange();range.setStart(t,i);range.setEnd(t,i+1);const b=range.getBoundingClientRect();
   if(!lines.some(l=>Math.abs(l.y-b.y)<2))lines.push({x:b.x,y:b.y});
  }
 }
 return {left:r.x,right:r.right,bottom:r.bottom,lineHeight:parseFloat(ps.lineHeight),lines:lines.slice(0,5),text:p.textContent};
};
try{
 const canonical=await readFile('dist/非水·成章-离线公众号排版器.html');
 assert.deepEqual(canonical,await readFile('dist/纸间-离线公众号排版器.html'));
 assert.deepEqual(canonical,await readFile('docs/index.html'));
 await page.goto(pathToFileURL(path.resolve('dist/纸间-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
 assert.match(await page.title(),/^非水·成章/);assert.equal(await page.locator('.brand-name').innerText(),'非水·成章\n落笔非水，行文成章。');
 check('new brand and tagline; canonical, legacy and Pages entry points contain the same application');
 await setText(fixture);await page.click('#clear-heading-numbers');await page.waitForTimeout(400);assert.equal(await source(),expected);
 await page.keyboard.press('Control+z');await page.waitForTimeout(400);assert.equal(await source(),fixture);
 await page.click('#redo-button');await page.waitForTimeout(400);assert.equal(await source(),expected);
 await page.click('#clear-heading-numbers');await page.waitForTimeout(300);assert.equal(await source(),expected);
 await page.keyboard.press('Control+z');await page.waitForTimeout(400);assert.equal(await source(),fixture);
 await page.click('#clear-heading-numbers');await page.waitForTimeout(1500);await page.reload();await page.waitForSelector('.cm-content');await page.waitForTimeout(400);assert.equal(await source(),expected);
 check('one click clears real headings only; single undo, redo, no-op and old-entry reload retain the draft');
 const color=()=>page.locator('#preview').evaluate(n=>({paper:getComputedStyle(n).backgroundColor,heading:getComputedStyle(n.querySelector('h1')).color}));
 const original=await color(),day=await page.locator('body').evaluate(n=>({bg:getComputedStyle(n).backgroundColor,accent:getComputedStyle(n).getPropertyValue('--accent')}));assert.equal(day.bg,'rgb(239, 246, 251)');assert.equal(day.accent,'#2879b7');
 await page.screenshot({path:'test-results/identity-day-'+channel+'.png'});
 await page.click('#night-button');assert.deepEqual(await color(),original);assert.equal(await page.locator('body').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(19, 31, 43)');assert.equal(await page.locator('#preview-dimming').isVisible(),true);
 await page.click('#export-toggle');await page.screenshot({path:'test-results/identity-night-export-'+channel+'.png'});await page.keyboard.press('Escape');
 await page.screenshot({path:'test-results/identity-night-'+channel+'.png'});
 await page.reload();await page.waitForSelector('.cm-content');assert.equal(await page.locator('body').getAttribute('data-appearance'),'night');await page.click('#night-button');
 for(const width of [1600,1440,1280,1024]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'desktop overflow '+width);assert.ok(await page.locator('#copy-button').isVisible());assert.ok(await page.locator('#clear-heading-numbers').isVisible());}
 check('blue day and night palettes persist; publication colors remain unchanged and four desktop window sizes stay usable');
 await page.setViewportSize({width:1600,height:1000});
 const body='古典诗文常写风、水与星辰。文学先带来感受，科学模型则帮助我们追问条件、区分变量、核对证据。把两种阅读放在一起，不是替诗句贴上一个公式，而是让观察变得更细致。'.repeat(4),measurements=[];
 for(const id of ['digest','press','gewu','journal-indigo','journal-jade']){
  await page.click('#theme-button');await page.click('[data-theme="'+id+'"]');
  const md='# 标题\n\n'+(id==='gewu'?':::gewu-preface\n'+body+'\n:::':id.startsWith('journal')?':::abstract\n'+body+'\n:::':body),cls=id.startsWith('journal')?'journal':id;
  await setText(md);const initial=page.locator('#preview .'+cls+'-initial');await initial.waitFor();
  for(const width of ['375','430','wide']){
   await page.selectOption('#preview-width',width);await page.waitForTimeout(120);
   const m=await initial.evaluate(measure);assert.equal(m.text,body);assert.equal(m.lines.length,5);
   assert.ok(m.lines[0].x>m.right);assert.ok(m.lines[1].x>m.right);assert.ok(Math.abs(m.lines[2].x-m.left)<1,id+' third line returns below initial');
   const rightGap=m.lines[0].x-m.right,bottomGap=m.lines[2].y-m.bottom;
   assert.ok(rightGap>0&&bottomGap>0&&Math.abs(rightGap-bottomGap)<5,id+' balanced gaps '+rightGap+'/'+bottomGap);
   measurements.push({id,width,rightGap,bottomGap});
  }
  await page.selectOption('#preview-width','375');await initial.locator('..').screenshot({path:'test-results/dropcap-fixed-'+id+'-'+channel+'.png'});
  await page.click('#copy-button');if(await page.locator('#continue-copy').isVisible())await page.click('#continue-copy');await page.waitForFunction(()=>document.getElementById('copy-button').dataset.state==='success');
  const copied=await page.evaluate(async()=>{const [item]=await navigator.clipboard.read();return(await item.getType('text/html')).text();});
  await output.setContent('<style>body{margin:0}article{max-width:375px}</style>'+copied);const m=await output.locator('.'+cls+'-initial').evaluate(measure);assert.equal(m.text,body);assert.ok(Math.abs(m.lines[2].x-m.left)<1,id+' clipboard initial');
  assert.equal(await source(),md);
 }
 check('five editable drop caps reserve two lines with balanced spacing at three article widths, including actual clipboard output');
 assert.deepEqual(errors,[]);check('no desktop browser runtime errors');
 await writeFile('test-results/dropcap-measurements-'+channel+'.json',JSON.stringify(measurements,null,2));
}finally{await writeFile('test-results/identity-layout-'+channel+'.json',JSON.stringify({channel,version:browser.version(),checks,errors},null,2));await browser.close();}
