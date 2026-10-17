import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({offline:true,viewport:{width:1800,height:1100}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(()=>{localStorage.setItem('paper-library-open','false');localStorage.setItem('paper-theme-sidebar-open','false');});
try{
 await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');await page.click('#samples-button');await page.click('[data-sample="exam-math"]');await page.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');
 await page.click('#export-toggle');await page.click('#export-longimage');await page.selectOption('#longimage-scale','1');await page.click('#longimage-start');await page.waitForSelector('#longimage-copy',{timeout:30000});
 const result=await page.locator('#longimage-result-image').evaluate(async img=>{const blob=await(await fetch(img.src)).blob(),bitmap=await createImageBitmap(blob),canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();const d=ctx.getImageData(0,0,canvas.width,canvas.height).data;let ink=0;for(let i=0;i<d.length;i+=4)if(d[i]<120&&d[i+1]<120&&d[i+2]<120&&d[i+3]>0)ink++;return {width:canvas.width,height:canvas.height,ink,bytes:[...new Uint8Array(await blob.arrayBuffer())]};});
 assert.equal(result.width,794);assert.ok(result.height>1500);assert.ok(result.ink>10000);assert.deepEqual(errors,[]);await writeFile('test-results/exam-longimage.png',new Uint8Array(result.bytes));await writeFile('test-results/exam-longimage.json',JSON.stringify({...result,bytes:undefined,errors},null,2));console.log('PASS actual A4-width exam PNG includes the full mathematics paper, formulas, answer space, answers and analysis.');
}finally{await browser.close();}
