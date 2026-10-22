import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const channel=process.env.TEST_BROWSER||'chrome',dir=`test-results/skin-illustration-${channel}`;
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel,headless:true}),checks=[];
const url=pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href;
const record=text=>{checks.push(text);console.log('PASS '+text);};
async function session(skin){
 const context=await browser.newContext({offline:true,viewport:{width:1600,height:1000}});
 await context.addInitScript(skin=>{localStorage.setItem('paper-ui-skin',skin);localStorage.setItem('paper-library-open','false');localStorage.setItem('paper-theme-sidebar-open','false');},skin);
 const page=await context.newPage(),errors=[],network=[];page.setDefaultTimeout(8000);
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.goto(url);await page.waitForSelector('.cm-content');
 return {page,context,errors,network};
}
async function portraitReady(page){
 await page.waitForFunction(()=>{const img=document.querySelector('.witch-library-art img');return img?.complete&&img.naturalWidth===1697;},{},{timeout:4000});
 const geometry=await page.locator('.witch-library-art').evaluate(n=>{const box=n.getBoundingClientRect(),sprite=n.querySelector('.witch-portrait').getBoundingClientRect();return {height:box.height,overlap:Math.min(box.bottom,sprite.bottom)-Math.max(box.top,sprite.top)};});
 assert.ok(geometry.height>=24&&geometry.overlap>=20,JSON.stringify(geometry));
}
try{
 // The library is closed at the moment the skin loads, as in a saved session.
 const first=await session('witch-immersive');const {page}=first;
 await page.waitForFunction(()=>document.documentElement.dataset.witchAssets==='ready');
 assert.ok(await page.locator('#library').evaluate(n=>n.hidden));
 await page.click('#library-button');await portraitReady(page);
 record('cold immersive startup with a closed library still shows the portrait when opened');
 const imageURL=await page.locator('.witch-library-art img').getAttribute('src');
 for(let i=0;i<9;i++)await page.click('#new-article');
 assert.equal(await page.locator('#article-list [data-id]').count(),10);
 for(const viewport of [{width:1600,height:1000},{width:1280,height:800},{width:1100,height:720}]){
  await page.setViewportSize(viewport);
  for(const night of [false,true]){
   if((await page.locator('body').getAttribute('data-appearance')==='night')!==night)await page.click('#night-button');
   if(await page.locator('#library').evaluate(n=>n.hidden))await page.click('#library-button');
   await portraitReady(page);await page.waitForTimeout(200);
   await page.locator('#library').screenshot({path:`${dir}/library-${viewport.width}-${night?'night':'day'}.png`,animations:'disabled'});
   // Trigger normal typing/autosave and a library list refresh.
   if(viewport.width>=1200){await page.locator('.cm-content').focus();await page.keyboard.press('Control+End');await page.keyboard.insertText('测试');await page.waitForTimeout(350);await portraitReady(page);}
   await page.click('#library-close');await page.click('#library-button');await portraitReady(page);
   assert.equal(await page.locator('.witch-library-art img').getAttribute('src'),imageURL);
  }
 }
 assert.deepEqual(first.errors,[]);assert.deepEqual(first.network,[]);await first.context.close();
 record('portrait survives ten articles, day/night, 1600/1280/1100 windows, saving and reopening with one cached atlas URL');

 const second=await session('witch-light');
 await second.page.waitForFunction(()=>document.documentElement.dataset.witchAssets==='ready');
 await second.page.keyboard.press('Alt+6');await second.page.click('#panel-skin');await second.page.click('[data-ui-skin-choice="witch-immersive"]');
 await second.page.waitForFunction(()=>document.documentElement.dataset.witchAssets==='ready');await second.page.click('#modal-close');
 await second.page.click('#writing-panel-close');await second.page.click('#library-button');await portraitReady(second.page);
 assert.deepEqual(second.errors,[]);assert.deepEqual(second.network,[]);await second.context.close();
 record('switching from light to immersive while the library is hidden loads the real portrait');

 const third=await session('water');
 assert.equal(await third.page.locator('[data-witch-image][src]').count(),0);
 await third.page.click('#library-button');assert.equal(await third.page.locator('.witch-library-art').isVisible(),false);
 assert.deepEqual(third.errors,[]);assert.deepEqual(third.network,[]);await third.context.close();
 record('default startup still assigns no witch images and all checks stay offline');
} finally {await writeFile(dir+'/report.json',JSON.stringify({channel,checks},null,2));await browser.close();}
