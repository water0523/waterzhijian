import {chromium} from 'playwright';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
await mkdir('test-results/sticker-temp',{recursive:true});
process.env.TEMP=process.env.TMP=process.env.TMPDIR=path.resolve('test-results/sticker-temp');
const reports=[];
for(const channel of ['chrome','msedge']){
 const browser=await chromium.launch({channel,headless:true,downloadsPath:process.env.TEMP});
 const context=await browser.newContext({viewport:{width:1440,height:1000},offline:true,acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
 const cdp=await browser.newBrowserCDPSession();const ids=await cdp.send('Target.getBrowserContexts');await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',browserContextId:ids.browserContextIds[0],downloadPath:process.env.TEMP,eventsEnabled:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const takeDownload=async(fn,name)=>{const d=page.waitForEvent('download');await fn();const result=await d;const file=path.resolve(`test-results/${channel}-${name}`);await result.saveAs(file);return file;};
 try{
  await page.goto(pathToFileURL(path.resolve('dist/纸间-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
  await page.locator('.cm-content').click();await page.keyboard.press('Control+a');await page.keyboard.insertText('# 植物的来信\n\n## 把时光，留给一片叶子\n\n窗外的树影移过桌沿，茶杯里还有一点余温。'+ '我们把脚步放慢，把一句话写短，那些藏在间隙里的东西，便渐渐有了形状。'.repeat(7)+'\n\n## 第二封信\n\n这一段文字应当继续保持可编辑。\n\n尾声。');
  await page.waitForTimeout(350);await page.click('#theme-button');await page.click('[data-theme="plain"]');
  await page.locator('.cm-content').click();await page.keyboard.press('Control+Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=240;c.height=280;const x=c.getContext('2d');x.strokeStyle='#375c45';x.lineWidth=7;x.beginPath();x.moveTo(118,240);x.quadraticCurveTo(130,130,155,40);x.stroke();x.fillStyle='#71915b';x.beginPath();x.ellipse(98,96,39,80,-.65,0,Math.PI*2);x.fill();x.fillStyle='#a4b482';x.beginPath();x.ellipse(169,155,35,63,.8,0,Math.PI*2);x.fill();return c.toDataURL();});
  const imageFile=path.resolve(`test-results/${channel}-transparent.png`);await writeFile(imageFile,Buffer.from(data.split(',')[1],'base64'));await page.locator('#image-input').setInputFiles(imageFile);await page.waitForSelector('#preview .image-wrap img');
  await page.locator('#preview .image-wrap img').click();await page.click('#make-sticker');await page.waitForSelector('#preview .sticker-item');
  assert.equal(await page.locator('#preview .image-wrap').count(),0);
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#preview .sticker-item').evaluate(el=>getComputedStyle(el).cssFloat),'right');
  const contour=await page.evaluate(()=>{
    const item=document.querySelector('#preview .sticker-item'),img=item.querySelector('img'),bounds=img.getBoundingClientRect();
    const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
    let transparent=0,opaque=0;const walker=document.createTreeWalker(document.querySelector('#preview p'),NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){const text=walker.currentNode;for(let i=0;i<text.length;i++){const r=document.createRange();r.setStart(text,i);r.setEnd(text,i+1);const box=r.getBoundingClientRect();const x=box.x+box.width/2,y=box.y+box.height/2;if(x>=bounds.left&&x<bounds.right&&y>=bounds.top&&y<bounds.bottom){const alpha=ctx.getImageData(Math.floor((x-bounds.left)/bounds.width*canvas.width),Math.floor((y-bounds.top)/bounds.height*canvas.height),1,1).data[3];if(alpha>20)opaque++;else transparent++;}}}
    return {transparent,opaque};
  });
  assert.ok(contour.transparent>0,JSON.stringify(contour));assert.equal(contour.opaque,0,JSON.stringify(contour));
  await page.screenshot({path:`test-results/${channel}-contour-wrap.png`,fullPage:true});
  await page.selectOption('#sticker-layout','wrap-left');assert.equal(await page.locator('#preview .sticker-item').evaluate(el=>getComputedStyle(el).cssFloat),'left');
  await page.click('#copy-button');await page.selectOption('#publish-sticker-mode','rectangle');await page.click('#continue-copy');await page.waitForTimeout(200);
  const copied=await page.evaluate(async()=>{const [item]=await navigator.clipboard.read();return (await item.getType('text/html')).text();});assert.ok(copied.includes('shape-outside: none'));assert.ok(copied.includes('float: left'));assert.ok(copied.includes('窗外的树影'));
  await page.locator('#preview .sticker-item').click();await page.click('#sticker-region');await page.waitForSelector('[data-region-download]',{timeout:20000});await takeDownload(()=>page.click('[data-region-download="0"]'),'wrap-region.png');await page.click('#modal-close');
  await page.locator('#preview .sticker-item').click();await page.selectOption('#sticker-layout','free');
  await page.locator('#sticker-size').fill('42');await page.locator('#sticker-size').dispatchEvent('input');await page.locator('#sticker-angle').fill('-12');await page.locator('#sticker-angle').dispatchEvent('input');
  const sticker=page.locator('#preview .sticker-item');const box=await sticker.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-35,box.y+box.height/2+145,{steps:12});await page.mouse.up();
  await page.screenshot({path:`test-results/${channel}-sticker-layout.png`,fullPage:true});
  const style=await sticker.getAttribute('style');assert.ok(style.includes('-12deg'));assert.ok((await page.locator('.cm-content').innerText()).includes('第二封信'));
  await page.click('#sticker-region');await page.waitForSelector('[data-region-download]',{timeout:20000});
  const png=await takeDownload(()=>page.click('[data-region-download="0"]'),'sticker-region.png');assert.ok((await readFile(png)).length>5000);
  await page.screenshot({path:`test-results/${channel}-sticker-region-dialog.png`,fullPage:true});await page.click('#modal-close');
  await page.click('#export-toggle');const zip=await takeDownload(()=>page.click('#export-backup'),'sticker.zip');const entries=unzipSync(new Uint8Array(await readFile(zip)));const manifest=JSON.parse(strFromU8(entries['manifest.json']));assert.equal(manifest.articles[0].stickers.length,1);assert.equal(manifest.assets.length,1);
  await page.locator('#import-input').setInputFiles(zip);await page.waitForTimeout(450);assert.equal(await page.locator('#preview .sticker-item').count(),1);const importedStyle=await page.locator('#preview .sticker-item').getAttribute('style');assert.equal(importedStyle,style);
  await page.click('#export-toggle');const html=await takeDownload(()=>page.click('#export-html'),'sticker-export.html');const exported=await readFile(html,'utf8');assert.ok(exported.includes('贴纸排版区域 1'));assert.ok(!exported.includes('class="sticker-item'));assert.ok(exported.includes('这一段文字应当继续保持可编辑'));
  const readPage=await context.newPage();await readPage.goto(pathToFileURL(html).href);await readPage.screenshot({path:`test-results/${channel}-sticker-export.png`,fullPage:true});await readPage.close();
  await page.locator('#preview .sticker-item').click();await page.click('#sticker-restore');assert.equal(await page.locator('#preview .sticker-item').count(),0);assert.equal(await page.locator('#preview .image-wrap img').count(),1);
  assert.deepEqual(errors,[]);reports.push({browser:channel,passed:true,contour,checks:['透明贴纸粘贴后转换','透明区域内可排字、不透明区域无文字中心重叠','左右轮廓环绕切换','公众号普通左右环绕保留正文文字','轮廓环绕局部图离线生成','自由拖动、缩放、旋转','局部图片离线生成及下载','贴纸与原图随 ZIP 备份恢复','HTML 仅合成叠放局部区域','其余正文保留可编辑文本','贴纸恢复为正文图片']});console.log(channel+': sticker checks passed '+JSON.stringify(contour));
 }catch(e){await page.screenshot({path:`test-results/${channel}-sticker-failure.png`,fullPage:true});reports.push({browser:channel,passed:false,error:e.stack,errors});throw e;}
 finally{await writeFile('test-results/stickers-report.json',JSON.stringify(reports,null,2));await browser.close();}
}
