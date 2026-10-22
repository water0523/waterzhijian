import {chromium} from 'playwright';
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const channel=process.env.TEST_BROWSER||'chrome',dir=`test-results/commands-${channel}`;await mkdir(dir,{recursive:true});
const bundle=await build({entryPoints:['src/command-palette.ts'],bundle:true,write:false,format:'iife',globalName:'Palette'});
await writeFile(dir+'/fixture.html','<!doctype html><meta charset="UTF-8"><button id="owner">打开</button><script>'+bundle.outputFiles[0].text+'</script><script>window.runs=[];window.failures=[];window.catalogReads=0;window.palette=Palette.mountCommandPalette(()=>{catalogReads++;return [...Array.from({length:130},(_,i)=>({id:"a"+i,title:"文章 "+i+" 数学笔记",group:"文章",run:()=>runs.push(i)})),{id:"theme",title:"使用主题 数学",group:"主题",run:()=>runs.push("theme")},{id:"fail",title:"失败命令",group:"工具",run:async()=>{throw Error("expected")}}]},m=>failures.push(m));document.getElementById("owner").onclick=palette.open;</script>');
const browser=await chromium.launch({channel,headless:true}),context=await browser.newContext({offline:true,viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(pathToFileURL(path.resolve(dir+'/fixture.html')).href);await page.evaluate(()=>localStorage.setItem('paper-command-recents','{"bad":true}'));await page.click('#owner');
 const input=page.locator('#command-palette input');assert.equal(await page.locator('[data-command]').count(),70);await page.click('#command-more');assert.equal(await page.locator('[data-command]').count(),132);
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'owner');await page.click('#owner');await input.press('ArrowUp');assert.equal(await page.locator('[aria-selected=true] span').innerText(),'失败命令');assert.equal(await page.evaluate(()=>catalogReads),2);await input.press('Escape');
 await page.click('#owner');await input.fill('数学 129');assert.equal(await page.locator('[data-command]').count(),1);await input.press('Enter');assert.deepEqual(await page.evaluate(()=>runs),[129]);
 await page.click('#owner');await input.fill('数学');await page.selectOption('#command-palette select','主题');assert.equal(await page.locator('[data-command]').count(),1);await input.focus();
 await input.evaluate(n=>{n.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));n.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true}));});assert.ok(await page.locator('dialog').evaluate(d=>d.open));assert.deepEqual(await page.evaluate(()=>runs),[129]);await input.evaluate(n=>n.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));await input.press('Enter');assert.deepEqual(await page.evaluate(()=>runs),[129,'theme']);
 await page.click('#owner');await input.fill('不存在');await input.press('ArrowDown');await input.press('Enter');assert.ok(await page.locator('dialog').evaluate(d=>d.open));assert.equal(await input.getAttribute('aria-activedescendant'),null);
 await input.fill('失败');await input.press('Enter');await page.waitForFunction(()=>failures.length===1);assert.ok(!(await page.evaluate(()=>JSON.parse(localStorage.getItem('paper-command-recents')))).includes('fail'));assert.deepEqual(errors,[]);
 console.log('PASS long catalogs, progressive browsing, keyboard wrap, stable catalog, combined search/category, IME, corrupt history, empty results, failure reporting and focus return');
 await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');await page.keyboard.press('Control+Shift+p');await page.selectOption('#command-palette select','面板');await page.locator('#command-palette input').fill('素材 管理');assert.equal(await page.locator('#command-palette [data-command]').count(),1);await page.locator('#command-palette input').press('Enter');await page.waitForSelector('#writing-panel:not([hidden])');
 await page.keyboard.press('Control+Shift+p');await page.selectOption('#command-palette select','主题');await page.screenshot({path:dir+'/app.png'});assert.deepEqual(errors,[]);console.log('PASS real offline app filters and executes panel commands');
}finally{await browser.close();}
