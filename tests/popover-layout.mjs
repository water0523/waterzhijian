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
 const value=await page.locator(id).evaluate(button=>{const r=button.getBoundingClientRect(),panel=document.getElementById('quick-popover').getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return{x,y,top:r.top,bottom:r.bottom,height:innerHeight,width:innerWidth,panel:{left:panel.left,right:panel.right,top:panel.top,bottom:panel.bottom},hit:button.contains(document.elementFromPoint(x,y))};});
 assert.ok(value.top>=8&&value.bottom<=value.height-8,`${id} outside viewport: ${JSON.stringify(value)}`);assert.ok(value.panel.left>=7&&value.panel.right<=value.width-7&&value.panel.top>=7&&value.panel.bottom<=value.height-7,'popover outside viewport');assert.ok(value.hit,id+' is obscured');return value;
};
try{
 await page.goto(pathToFileURL(path.resolve('dist/纸间-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
 for(const [name,width,height] of [['desktop',1440,720],['short',1280,520]]){
  await page.setViewportSize({width,height});await page.locator('.cm-content').focus();await page.keyboard.press('Control+a');await page.keyboard.insertText('# 底部菜单检查\n\n'+Array.from({length:40},(_,i)=>`第 ${i+1} 段：让文字清楚地留在页面里。\n`).join('\n')+'\n这里是要修改的选中文字');await page.keyboard.press('Control+End');await page.keyboard.press('Home');await page.keyboard.press('Shift+End');await page.waitForTimeout(250);
  const docScroll=await page.evaluate(()=>document.scrollingElement.scrollTop);
  for(const [id,value]of[['selection-style-button','kai'],['selection-size-button','32'],['selection-color-button','#dc2626'],['selection-highlight-button','#fff29b'],['selection-effect-button','gold'],['selection-marker-button','#bbf7d0'],['selection-role-button','term']]){
   await page.click('#'+id);await page.waitForTimeout(120);const choice=`#quick-popover [data-inline-choice="${value}"]`;await page.locator(choice).scrollIntoViewIfNeeded();await page.waitForTimeout(70);const action=await visibleAction(choice);assert.equal(await page.locator('#inline-apply').count(),0);await page.mouse.click(action.x,action.y);assert.equal(await page.locator('#quick-popover').count(),0);assert.equal(await page.evaluate(()=>document.scrollingElement.scrollTop),docScroll);await page.waitForTimeout(220);
  }
  assert.match(await page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown),/\[这里是要修改的选中文字\]\{font=kai size=32 color=#dc2626 highlight=#fff29b role=term marker=#bbf7d0\}/);await page.screenshot({path:`test-results/popover-${name}-${channel}.png`,fullPage:false});check(name+': all seven bottom-selection dropdowns apply immediately without an offscreen confirmation or page scroll');
 }
 await page.click('#selection-style-button');await page.setViewportSize({width:1100,height:420});await page.waitForTimeout(200);const selected='#quick-popover [data-picker-font="kai"]';await page.locator(selected).scrollIntoViewIfNeeded();await visibleAction(selected);assert.equal(await page.locator(selected).getAttribute('aria-checked'),'true');await page.click(selected);assert.equal(await page.locator('#quick-popover').count(),0);check('an open dropdown repositions and retains the current choice when the desktop window shrinks');
 await page.locator('.cm-content').focus();await page.click('.format-toolbar [data-format="link"]');await page.waitForTimeout(200);await visibleAction('#link-insert');check('link insertion keeps its visible fixed action area after the dropdown refactor');
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
}finally{await writeFile(`test-results/popover-layout-${channel}.json`,JSON.stringify({channel,checks,errors,network},null,2));await browser.close();}
