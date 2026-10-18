import './workspace-driver.mjs';
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const channel=process.env.UI_SKIN_BROWSER||'chrome',dir='test-results/sky-workspace-'+channel;
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel,headless:true}),context=await browser.newContext({offline:true,viewport:{width:1920,height:1100}}),page=await context.newPage(),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
await context.addInitScript(()=>{localStorage.setItem('paper-library-open','true');localStorage.setItem('paper-theme-sidebar-open','true');});
const url=pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href,check=s=>{checks.push(s);console.log(channel+': '+s);};
try{
 await page.goto(url);await page.waitForSelector('.cm-content');await page.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');
 const sample=await readFile('动漫手记示例/樱粉魔法.md','utf8');await page.locator('.cm-content').click();await page.keyboard.press('Control+a');await page.keyboard.insertText(sample);await page.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');await page.click('#theme-button');await page.click('[data-theme="anime-sakura"]');await page.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');
 await page.locator('.cm-content').focus();await page.keyboard.press('Control+Home');await page.evaluate(()=>{document.querySelector('.cm-scroller').scrollTop=0;document.getElementById('preview-scroll').scrollTop=0;});await page.waitForTimeout(250);
 const geometry=()=>page.evaluate(()=>['.app-header','#library','#theme-sidebar','.editor-pane','.preview-pane'].map(q=>{const r=document.querySelector(q).getBoundingClientRect();return [q,r.x,r.y,r.width,r.height];}));
 await page.keyboard.press('Alt+6');const baseline=await geometry();
 for(const skin of ['water','witch-light','witch-immersive']){
  await page.click('#ui-settings-button');await page.click('[data-ui-skin-choice="'+skin+'"]');if(skin!=='water')await page.waitForFunction(()=>document.documentElement.dataset.witchAssets==='ready');await page.click('#modal-close');await page.evaluate(()=>document.getElementById('toast').className='');await page.waitForTimeout(200);
  {const actual=await geometry();for(let i=0;i<actual.length;i++)for(let j=1;j<5;j++)assert.ok(Math.abs(actual[i][j]-baseline[i][j])<=2,JSON.stringify({actual,baseline}));}assert.equal(await page.locator('.witch-journey-banner').count(),0);
  for(const id of ['#local-button','#copy-button','#command-palette-button','#fullscreen-button','#panel-skin','#writing-panel-close'])assert.ok(await page.locator(id).evaluate(n=>{const r=n.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return n===hit||n.contains(hit);}),id+' must remain reachable');
  await page.screenshot({path:dir+'/'+skin+'-day.png'});await page.click('#night-button');await page.waitForTimeout(250);{const actual=await geometry();for(let i=0;i<actual.length;i++)for(let j=1;j<5;j++)assert.ok(Math.abs(actual[i][j]-baseline[i][j])<=2,JSON.stringify({actual,baseline}));}await page.screenshot({path:dir+'/'+skin+'-night.png'});await page.click('#night-button');
 }
 check('all three skins share docked panel geometry with desktop libraries, have day/night screenshots and unobstructed essential controls');
 await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(100);await page.click('#theme-sidebar-toggle');if(await page.locator('#theme-sidebar').isHidden())await page.click('#theme-sidebar-toggle');assert.ok(await page.locator('#theme-sidebar-close').isVisible());await page.click('#theme-sidebar-close');assert.ok((await page.locator('#editor').boundingBox()).height>300);await page.screenshot({path:dir+'/desktop-1280.png'});
 await page.setViewportSize({width:1024,height:720});await page.waitForTimeout(100);assert.ok((await page.locator('#editor').boundingBox()).height>270);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:dir+'/desktop-1024.png'});check('compact desktops preserve writing height without a second banner or horizontal overflow');
 await page.setViewportSize({width:1920,height:1100});await page.click('#fullscreen-button');await page.waitForFunction(()=>Boolean(document.fullscreenElement));assert.equal(await page.locator('.witch-sky-scene').isVisible(),true);await page.click('#fullscreen-button');await page.waitForFunction(()=>!document.fullscreenElement);check('the full desktop including sky and controls enters and exits native fullscreen');
 const lightContext=await browser.newContext({offline:true,viewport:{width:1440,height:900}});await lightContext.addInitScript(()=>localStorage.setItem('paper-ui-skin','witch-light'));const light=await lightContext.newPage();await light.goto(url);await light.waitForFunction(()=>document.documentElement.dataset.witchAssets==='ready');assert.equal(await light.locator('[data-witch-image=hat][src]').count(),0);assert.equal(await light.locator('script[type="application/x-feishui-image"][data-loaded]').count(),2);assert.ok(await light.locator('.witch-sky-scene img').evaluate(n=>n.complete&&n.naturalWidth>0));await lightContext.close();check('reopening light mode decodes only the sky and shared atlas, leaving the immersive hat unused');
 assert.deepEqual(errors,[]);
}catch(error){await page.screenshot({path:dir+'/failure.png'});throw error;}
finally{await writeFile(dir+'/report.json',JSON.stringify({channel,checks,errors},null,2));await browser.close();}
