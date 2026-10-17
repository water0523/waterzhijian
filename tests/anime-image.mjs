import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
await mkdir('test-results/anime-images',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({offline:true,viewport:{width:1800,height:1100}}),page=await context.newPage(),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(()=>{localStorage.setItem('paper-library-open','false');localStorage.setItem('paper-theme-sidebar-open','false');});
try{
 await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
 for(const id of ['anime-sakura','anime-matcha']){
  await page.click('#samples-button');await page.click('[data-sample="'+id+'"]');await page.waitForFunction(id=>JSON.parse(localStorage.getItem('paper-recovery')).theme===id,id);await page.waitForSelector('#preview .anime-chat');
  await page.click('#export-toggle');await page.click('#export-longimage');await page.selectOption('#longimage-scale','1');await page.click('#longimage-start');await page.waitForSelector('#longimage-copy',{timeout:30000});
  const result=await page.locator('#longimage-result-image').evaluate(async img=>{const blob=await(await fetch(img.src)).blob(),bitmap=await createImageBitmap(blob),canvas=new OffscreenCanvas(bitmap.width,bitmap.height),x=canvas.getContext('2d');x.drawImage(bitmap,0,0);bitmap.close();const d=x.getImageData(0,0,canvas.width,canvas.height).data;let ink=0,colors=0;for(let i=0;i<d.length;i+=4){if(d[i]<140&&d[i+1]<140&&d[i+2]<140&&d[i+3]>0)ink++;if(Math.max(d[i],d[i+1],d[i+2])-Math.min(d[i],d[i+1],d[i+2])>35)colors++;}return{width:canvas.width,height:canvas.height,ink,colors,bytes:[...new Uint8Array(await blob.arrayBuffer())]};});
  assert.equal(result.width,430);assert.ok(result.height>2500);assert.ok(result.ink>10000);assert.ok(result.colors>20000);await writeFile('test-results/anime-images/'+id+'.png',new Uint8Array(result.bytes));results.push({id,...result,bytes:undefined});await page.click('#modal-close');console.log('PASS '+id+' full PNG contains colors, text, formulas, illustration and cards.');
 }
 assert.deepEqual(errors,[]);
}finally{await writeFile('test-results/anime-images/report.json',JSON.stringify({results,errors},null,2));await browser.close();}
