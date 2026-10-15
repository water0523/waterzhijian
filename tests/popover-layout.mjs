import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const channel=process.env.POPOVER_BROWSER||'chrome',checks=[],errors=[],network=[];
await mkdir(`test-results/popover-${channel}-temp`,{recursive:true});process.env.TEMP=process.env.TMP=process.env.TMPDIR=path.resolve(`test-results/popover-${channel}-temp`);
const browser=await chromium.launch({channel,headless:true}),context=await browser.newContext({offline:true,viewport:{width:1440,height:720}}),page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
const check=s=>{checks.push(s);console.log('PASS '+s);};
const visibleAction=async id=>{
 const value=await page.locator(id).evaluate(button=>{const r=button.getBoundingClientRect(),panel=document.getElementById('quick-popover').getBoundingClientRect(),body=document.querySelector('.quick-body'),x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,top:r.top,bottom:r.bottom,height:innerHeight,width:innerWidth,panel:{left:panel.left,right:panel.right,top:panel.top,bottom:panel.bottom},hit:button.contains(document.elementFromPoint(x,y)),scroll:body.scrollHeight>body.clientHeight};});
 assert.ok(value.top>=8&&value.bottom<=value.height-8,`${id} outside viewport: ${JSON.stringify(value)}`);assert.ok(value.panel.left>=7&&value.panel.right<=value.width-7&&value.panel.top>=7&&value.panel.bottom<=value.height-7,'popover outside viewport');assert.ok(value.hit,id+' is obscured');return value;
};
try{
 await page.goto(pathToFileURL(path.resolve('dist/纸间-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
 for(const [name,width,height] of [['desktop',1440,720],['short',1280,520]]){
  await page.setViewportSize({width,height});if(width<=760)await page.click('#mobile-edit');if(name==='compact')await page.click('#night-button');
  await page.locator('.cm-content').focus();await page.keyboard.press('Control+a');await page.keyboard.insertText('# 底部菜单检查\n\n'+Array.from({length:40},(_,i)=>`第 ${i+1} 段：让文字清楚地留在页面里。\n`).join('\n')+'\n这里是要修改的选中文字');await page.keyboard.press('Control+End');await page.keyboard.press('Home');await page.keyboard.press('Shift+End');await page.waitForTimeout(250);
  await page.click('#selection-style-button');await page.waitForTimeout(200);const position=await visibleAction('#inline-apply');
  assert.equal(await page.locator('#quick-popover').evaluate(n=>n.scrollTop),0);const docScroll=await page.evaluate(()=>document.scrollingElement.scrollTop);await page.selectOption('#inline-font','kai');await page.locator('#inline-color + .color-swatches [data-color="#dc2626"]').click();
  await page.locator('#inline-size').fill('64');const action=await visibleAction('#inline-apply');assert.equal(await page.evaluate(()=>document.scrollingElement.scrollTop),docScroll);await page.screenshot({path:`test-results/popover-${name}-${channel}.png`,fullPage:false});await page.mouse.click(action.x,action.y);await page.waitForTimeout(300);
  assert.equal(await page.locator('#quick-popover').count(),0);assert.match(await page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown),/\[这里是要修改的选中文字\]\{font=kai size=64 color=#dc2626\}/);check(name+': bottom selection can choose a color/font and apply without scrolling the page or menu to its end');
 }
 await page.setViewportSize({width:1440,height:720});await page.locator('.cm-content').focus();await page.keyboard.press('Control+End');await page.keyboard.press('Home');await page.keyboard.press('Shift+End');await page.waitForTimeout(100);await page.click('#selection-style-button');await page.setViewportSize({width:1100,height:420});await page.waitForTimeout(200);await visibleAction('#inline-apply');assert.ok(await page.locator('#quick-popover').isVisible());check('an open menu repositions on a smaller viewport while retaining its selection');
 await page.keyboard.press('Escape');await page.locator('.cm-content').focus();await page.waitForTimeout(100);await page.click('.format-toolbar [data-format="link"]');await page.waitForTimeout(200);await visibleAction('#link-insert');check('link insertion shares the visible fixed action area');
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
}finally{await writeFile(`test-results/popover-layout-${channel}.json`,JSON.stringify({channel,checks,errors,network},null,2));await browser.close();}
