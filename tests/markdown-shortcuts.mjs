import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const channel=process.env.SHORTCUT_BROWSER||'chrome',checks=[],errors=[];
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel,headless:true}),context=await browser.newContext({offline:true,viewport:{width:1600,height:1000}}),page=await context.newPage();
await context.addInitScript(()=>{localStorage.setItem('paper-library-open','false');localStorage.setItem('paper-theme-sidebar-open','false');});page.on('pageerror',e=>errors.push(e.message));
const source=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown),settle=()=>page.waitForTimeout(180);
const set=async(text='alpha')=>{await page.keyboard.press('Escape');await page.mouse.move(0,0);await page.locator('.cm-content').focus();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await settle();await page.keyboard.press('Control+a');};
const check=s=>{checks.push(s);console.log(channel+': '+s);};
try{
 await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
 for(let n=1;n<=6;n++){await set('### alpha');await page.keyboard.press('Control+'+n);await settle();assert.equal(await source(),'#'.repeat(n)+' alpha');}check('Ctrl+1 through Ctrl+6 replace the heading level without duplicate prefixes');
 for(const [key,expected]of [['Control+b','**alpha**'],['Control+l','*alpha*'],['Control+u','[alpha]{underline}'],['Control+Alt+x','~~alpha~~'],['Control+e','`alpha`'],['Control+m','$alpha$'],['Control+Alt+q','> alpha'],['Control+Alt+o','1. alpha'],['Control+Alt+u','- alpha'],['Control+Alt+e','\n\n```\nalpha\n```\n\n'],['Control+Alt+m','\n\n$$\nalpha\n$$\n\n'],['Control+Alt+h','\n\n---\n\n']]){await set();await page.keyboard.press(key);await settle();assert.equal(await source(),expected,key);}check('all twelve direct formatting shortcuts produce the requested Markdown');
 for(const [key,heading]of [['Control+k','链接'],['Control+Alt+t','表格']]){await set();await page.keyboard.press(key);await page.waitForSelector('#quick-popover');assert.ok((await page.locator('#quick-popover').innerText()).includes(heading));assert.equal(await source(),'alpha');await page.keyboard.press('Escape');}check('link and table shortcuts open existing insertion controls without replacing selected text');
 await set();const chooser=page.waitForEvent('filechooser');await page.keyboard.press('Control+Alt+l');await chooser;assert.equal(await source(),'alpha');check('image shortcut opens the local image chooser');
 await set('one\ntwo');await page.keyboard.press('Control+Alt+o');await settle();assert.equal(await source(),'1. one\n2. two');await page.keyboard.press('Control+Alt+o');await settle();assert.equal(await source(),'one\ntwo');await page.keyboard.press('Control+Alt+u');await settle();assert.equal(await source(),'- one\n- two');check('list shortcuts handle multiple lines and repeat to remove prefixes');
 await page.click('#search-button');await page.locator('#find-query').fill('query');const before=await source();await page.keyboard.press('Control+2');await page.keyboard.press('Control+b');assert.equal(await source(),before);assert.equal(await page.locator('#find-query').inputValue(),'query');await page.click('#find-close');
 await page.click('#ui-settings-button');await page.keyboard.press('Control+3');assert.equal(await source(),before);await page.keyboard.press('Escape');assert.deepEqual(errors,[]);check('search inputs and dialogs do not trigger Markdown shortcuts; no browser errors');
}finally{await writeFile('test-results/markdown-shortcuts-'+channel+'.json',JSON.stringify({channel,checks,errors},null,2));await browser.close();}
