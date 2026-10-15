import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const channel=process.env.TYPE_BROWSER||'chrome';await mkdir(`test-results/type-${channel}-temp`,{recursive:true});process.env.TEMP=process.env.TMP=process.env.TMPDIR=path.resolve(`test-results/type-${channel}-temp`);
const browser=await chromium.launch({channel,headless:true});const context=await browser.newContext({offline:true,viewport:{width:1600,height:1100}});const page=await context.newPage();const errors=[],profiles=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const setText=async text=>{await page.locator('.cm-content').click();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await page.waitForTimeout(300);};
try{
 await page.goto(pathToFileURL(path.resolve('dist/纸间-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
 await setText('# 一页书，读懂一束光\n\n以清楚的文字，记录值得记住的发现。无论科学推导还是文学表达，都应该保有适合自己的阅读节奏。\n\n## 从观察出发\n\n正文中的**数字 45%**与普通文字保持自然衔接，引用与图注则留出另一种声音。\n\n> 真正的发现，始于认真而温柔的观察。\n\n### 把变化写成语言\n\n$$\\begin{aligned}f(x)&=x^2+2x+1\\\\&=(x+1)^2\\end{aligned}$$\n\n| 项目 | 记录 |\n| --- | --- |\n| 波长 | 500 nm |\n| 时间 | 3.5 s |\n\n```python\nprint("hello, world")\n```\n\n:::poem center\n光落在纸上\n也落在**未说完的故事**里\n:::\n\n:::divider double\n\n文字继续向前。');
 await page.locator('.cm-content').click();await page.keyboard.press('Control+End');await page.keyboard.insertText('\n\n一次观察，也是一段故事。[^1]\n\n[^1]: 这是一条用于检查字号与排版的脚注。\n');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=640;c.height=360;const x=c.getContext('2d');x.fillStyle='#f4f3eb';x.fillRect(0,0,640,360);x.strokeStyle='#c9d1c4';x.lineWidth=1;for(let i=60;i<640;i+=80){x.beginPath();x.moveTo(i,30);x.lineTo(i,310);x.stroke();}for(let i=50;i<340;i+=50){x.beginPath();x.moveTo(30,i);x.lineTo(610,i);x.stroke();}x.strokeStyle='#315e53';x.lineWidth=4;x.beginPath();for(let i=0;i<580;i++){const y=180-Math.sin(i/85)*95;if(!i)x.moveTo(i+30,y);else x.lineTo(i+30,y);}x.stroke();const blob=await new Promise(r=>c.toBlob(r)),dt=new DataTransfer();dt.items.add(new File([blob],'observation.png',{type:'image/png'}));document.querySelector('.cm-content').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));});await page.waitForSelector('#preview img');
 await page.click('#assets-button');await page.locator('[data-asset-field="caption"]').first().fill('光与影：观察记录示意图');await page.locator('[data-asset-field="caption"]').first().dispatchEvent('change');await page.locator('[data-asset-field="source"]').first().fill('本地绘制');await page.locator('[data-asset-field="source"]').first().dispatchEvent('change');await page.click('#modal-close');
 await page.click('#theme-button');const ids=await page.locator('[data-theme]').evaluateAll(nodes=>nodes.map(n=>n.dataset.theme));await page.click('#modal-close');
 for(const id of ids){
  await page.click('#theme-button');await page.click(`[data-theme="${id}"]`);
  for(const width of ['375','430','wide']){
   await page.selectOption('#preview-width',width);await page.waitForTimeout(35);
   const info=await page.locator('#preview').evaluate(el=>{const get=s=>{const n=el.querySelector(s),c=getComputedStyle(n);return {font:c.fontFamily,size:c.fontSize,lineHeight:c.lineHeight,color:c.color,background:c.backgroundColor};};return {w:el.clientWidth,scroll:el.scrollWidth,h1:get('h1'),h2:get('h2'),body:get('p'),quote:get('blockquote'),code:get('pre'),poem:get('.poem'),table:get('table'),caption:get('.image-caption'),source:get('.image-source'),footnote:get('.footnotes')};});
   assert.ok(info.scroll<=info.w+2,`${id}/${width}: article overflow`);assert.equal(info.body.size,id.startsWith('journal-')||id==='digest'?'15.5px':id==='press'?'15px':'16px');assert.ok(parseFloat(info.caption.size)>=11);assert.equal(info.source.size,'11px');assert.equal(await page.locator('#preview .math-error').count(),0);assert.ok(await page.locator('#preview .math-display svg').count());assert.equal(await page.locator('#preview .poem strong').innerText(),'未说完的故事');profiles.push({id,width,...info});
  }
 }
 assert.ok(new Set(profiles.map(p=>p.h1.font)).size>=4);assert.ok(new Set(profiles.map(p=>p.quote.font)).size>=5);assert.deepEqual(errors,[]);
 await page.selectOption('#preview-width','375');await page.click('#theme-button');await page.click('[data-theme="academic"]');await page.locator('#preview-scroll').evaluate(n=>n.scrollTop=0);await page.screenshot({path:`test-results/typography-academic-${channel}.png`,fullPage:true});
 console.log(`PASS ${ids.length} themes × three widths: readable text, independent typography, formulas, poems, code and tables`);
}finally{await writeFile(`test-results/theme-typography-${channel}.json`,JSON.stringify({channel,profiles,errors},null,2));await browser.close();}
