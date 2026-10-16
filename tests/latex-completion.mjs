import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const channel=process.env.LATEX_BROWSER||'chrome',checks=[],errors=[],network=[];
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel,headless:true});
const page=await browser.newPage({offline:true,viewport:{width:1600,height:1000}});
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
const check=s=>{checks.push(s);console.log('PASS '+s);};
const source=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown);
const set=async text=>{await page.locator('.cm-content').click();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await page.waitForTimeout(180);};
const type=async text=>{await page.keyboard.type(text,{delay:25});await page.waitForTimeout(200);};
const menu=page.locator('.cm-tooltip-autocomplete');
const option=label=>menu.locator('li').filter({has:page.getByText(label,{exact:true})});
const labels=()=>menu.locator('.cm-completionLabel').allTextContents();
const visible=()=>menu.waitFor({state:'visible'});
const pick=async label=>{await visible();await option(label).click();await page.waitForTimeout(100);};
const absent=async()=>{await page.waitForTimeout(260);assert.equal(await menu.isVisible(),false);};
const assistant=async()=>{await page.click('#writing-tools-button');await page.waitForSelector('#latex-completion-toggle');};
try{
 await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
 await assistant();assert.equal(await page.locator('#latex-completion-toggle').isChecked(),true);await page.keyboard.press('Escape');
 await set('# 公式补全\n\n$');await type('\\fr');await visible();assert.ok((await labels()).includes('\\frac{a}{b}'));assert.equal(await source(),'# 公式补全\n\n$\\fr');
 await page.keyboard.press('Tab');await page.keyboard.type('x');await page.keyboard.press('Tab');await page.keyboard.type('y');await page.keyboard.press('Tab');await page.keyboard.type('$');await page.waitForTimeout(350);
 assert.equal(await source(),'# 公式补全\n\n$\\frac{x}{y}$');assert.equal(await page.locator('#preview .math-inline svg').count(),1);assert.equal(await page.locator('#preview .math-error').count(),0);
 check('default-on prefix suggestions keep source unchanged until accepted; Tab inserts a fraction with editable numerator/denominator and renders it');
 await set('# 希腊字母\n\n$');await type('\\b');await visible();assert.ok((await labels()).includes('\\beta'));assert.ok((await labels()).length>1);
 const first=await menu.locator('[aria-selected=true] .cm-completionLabel').innerText();await page.keyboard.press('ArrowDown');const second=await menu.locator('[aria-selected=true] .cm-completionLabel').innerText();assert.notEqual(second,first);await page.keyboard.press('ArrowUp');assert.equal(await menu.locator('[aria-selected=true] .cm-completionLabel').innerText(),first);await pick('\\beta');await page.keyboard.type('$');await page.waitForTimeout(250);assert.equal(await source(),'# 希腊字母\n\n$\\beta$');
 await set('# 大写字母\n\n$');await type('\\Ga');await visible();assert.deepEqual(await labels(),['\\Gamma']);await page.keyboard.press('Enter');await page.keyboard.type('$');await page.waitForTimeout(250);assert.equal(await source(),'# 大写字母\n\n$\\Gamma$');
 check('Greek choices include beta, distinguish case, support mouse, arrows and Enter');
 await set('# 求和\n\n$');await type('\\sum');await page.keyboard.press('Enter');await page.keyboard.type('k=0');await page.keyboard.press('Tab');await page.keyboard.type('m');await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');await page.keyboard.type('n');await page.keyboard.press('Tab');await page.keyboard.type('x_k');await page.keyboard.press('Tab');await page.keyboard.type('$');await page.waitForTimeout(350);assert.equal(await source(),'# 求和\n\n$\\sum_{k=0}^{n} {x_k}$');assert.equal(await page.locator('#preview .math-inline svg').count(),1);
 await set('# 根号\n\n$');await type('\\sqar');await visible();assert.deepEqual(await labels(),['\\sqrt{x}']);await page.keyboard.press('Tab');await page.keyboard.type('z');await page.keyboard.press('Tab');await page.keyboard.type('$');await page.waitForTimeout(250);assert.equal(await source(),'# 根号\n\n$\\sqrt{z}$');
 for(const command of ['sin','cos','partial','infty','neq']){await set('# 命令\n\n$');await type('\\'+command);await visible();await pick('\\'+command);await page.keyboard.type('$');await page.waitForTimeout(220);assert.equal(await source(),'# 命令\n\n$\\'+command+'$');assert.equal(await page.locator('#preview .math-inline svg').count(),1);}
 check('sum fields support forward/back Tab navigation; root typo alias resolves to valid sqrt; functions, calculus and relation symbols render');
 for(const [command,fields,expected] of [
  ['int',['0','1','x^2','x'],'\\int_{0}^{1} x^2\\,d{x}'],
  ['lim',['h','0','g(h)'],'\\lim_{h\\to 0} {g(h)}'],
  ['begin',['1','2','3','4'],'\\begin{pmatrix}\n1 & 2 \\\\\n3 & 4\n\\end{pmatrix}']
 ]){
  await set('# 多步骤公式\n\n$$\n');await type('\\'+command);await visible();await page.keyboard.press('Enter');
  for(const field of fields){await page.keyboard.type(field);await page.keyboard.press('Tab');}
  await page.keyboard.insertText('\n$$');await page.waitForTimeout(350);assert.equal(await source(),'# 多步骤公式\n\n$$\n'+expected+'\n$$');assert.equal(await page.locator('#preview .math-display svg').count(),1);assert.equal(await page.locator('#preview .math-error').count(),0);
 }
 check('integral, limit and multiline matrix snippets fill every field and render valid display math');
 await set('# 不自动替换\n\n$');await type('\\fr');await visible();await page.keyboard.press('Escape');await absent();assert.equal(await source(),'# 不自动替换\n\n$\\fr');
 await type('a');await visible();await page.keyboard.press('Enter');await page.keyboard.press('Control+z');await page.waitForTimeout(220);assert.equal(await source(),'# 不自动替换\n\n$\\fra');
 for(const literal of ['# 代码\n\n```tex\n\\','正文 `\\fr`','正文 \\\\']){await set(literal);if(literal.endsWith('`'))await page.keyboard.press('ArrowLeft');await type('fr');await absent();}
 await set('# 未知命令\n\n$');await type('\\zzzz');await absent();
 check('Escape cancels, completion can be undone, and literal code/escaped slashes/unknown commands are left alone');
 await assistant();await page.locator('#latex-completion-toggle').uncheck();assert.equal(await page.evaluate(()=>localStorage.getItem('paper-latex-completion')),'false');await page.keyboard.press('Escape');
 await set('# 关闭测试\n\n$');await type('\\fr');await absent();await page.click('#new-article');await set('# 新稿\n\n$');await type('\\b');await absent();await page.waitForTimeout(1200);await page.reload();await page.waitForSelector('.cm-content');await assistant();assert.equal(await page.locator('#latex-completion-toggle').isChecked(),false);await page.keyboard.press('Escape');await set('# 重开仍关闭\n\n$');await type('\\sq');await absent();
 await assistant();await page.locator('#latex-completion-toggle').check();await page.keyboard.press('Escape');await set('# 重新开启\n\n$');await type('\\sq');await visible();assert.ok((await labels()).includes('\\sqrt{x}'));await page.keyboard.press('Escape');
 check('writing assistant toggles immediately, persists on reload, remains disabled across new articles, and re-enables correctly');
 for(const appearance of ['day','night']){if(appearance==='night')await page.click('#night-button');await set('# 科学，也可以写得从容\n\n$');await type('\\b');await visible();const bounds=await menu.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=1600&&bounds.y+bounds.height<=1000);await page.screenshot({path:'test-results/latex-completion-'+appearance+'-'+channel+'.png'});await page.keyboard.press('Escape');}
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);check('desktop day/night candidates stay inside the window and work fully offline without runtime errors');
}finally{await writeFile('test-results/latex-completion-'+channel+'.json',JSON.stringify({channel,version:browser.version(),checks,errors,network},null,2));await browser.close();}
