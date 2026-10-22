import {chromium} from 'playwright';
import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
const channel=process.env.TEST_BROWSER||'chrome',dir=`test-results/math-writing-${channel}`;
await mkdir(dir,{recursive:true});
await build({stdin:{contents:`import {latexEntries,latexPreviewSource} from './src/latex-completion';import {renderMath} from './src/math-engine';window.catalogCheck={count:latexEntries.length,duplicates:latexEntries.filter((e,i,a)=>a.findIndex(x=>x.command===e.command)!==i).map(e=>e.command),errors:latexEntries.flatMap(e=>{const r=renderMath(latexPreviewSource(e),false);return r.error?[{command:e.command,error:r.error,source:latexPreviewSource(e)}]:[]})};`,resolveDir:process.cwd()},bundle:true,format:'iife',outfile:dir+'/catalog.js'});
await writeFile(dir+'/catalog.html','<!doctype html><meta charset="UTF-8"><script src="catalog.js"></script>');
const browser=await chromium.launch({channel,headless:true}),context=await browser.newContext({offline:true,viewport:{width:1600,height:1000},acceptDownloads:true}),page=await context.newPage(),checks=[],errors=[],network=[];
page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
const check=text=>{checks.push(text);console.log('PASS '+text);};
const source=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown);
const set=async text=>{await page.keyboard.press('Escape');await page.locator('.cm-content').focus();await page.keyboard.press('Control+a');if(text)await page.keyboard.insertText(text);else await page.keyboard.press('Backspace');await page.waitForTimeout(230);};
const row=command=>page.locator('.cm-tooltip-autocomplete li').filter({has:page.locator(`[data-latex-preview="${command}"]`)});
const complete=async prefix=>{await set('$');await page.keyboard.type(prefix,{delay:15});await page.waitForSelector('.cm-tooltip-autocomplete');};
const choose=async command=>{await row(command).locator('[data-rendered=true]').waitFor();await row(command).click();await page.waitForTimeout(100);};
try{
 await page.goto(pathToFileURL(path.resolve(dir+'/catalog.html')).href);await page.waitForFunction(()=>window.catalogCheck);
 const catalog=await page.evaluate(()=>catalogCheck);assert.ok(catalog.count>=275);assert.deepEqual(catalog.duplicates,[]);assert.deepEqual(catalog.errors,[]);check(`${catalog.count} unique candidates all render with the real offline math engine`);
 await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
 await set('');await page.keyboard.press('Control+m');await page.keyboard.insertText('速度');assert.equal(await source(),'$速度$');
 await set('');await page.keyboard.press('Control+Alt+m');await page.keyboard.insertText(String.raw`\frac{路程}{时间}`);assert.equal(await source(),'\n\n$$\n'+String.raw`\frac{路程}{时间}`+'\n$$\n\n');
 await set('x+y');await page.keyboard.press('Control+a');await page.keyboard.press('Control+m');assert.equal(await source(),'$x+y$');
 await set('');await page.keyboard.press('Control+Alt+f');await page.keyboard.insertText('x');assert.equal(await source(),'$x$');check('default inline/block shortcuts put an empty caret inside delimiters, wrap selections and retain the previous inline alias');

 await complete('\\fr');assert.ok(await row('frac').locator('svg path').count()>0);assert.equal(await page.locator('.cm-tooltip-autocomplete .cm-completionDetail').count(),0);assert.equal(await source(),'$\\fr');await choose('frac');assert.equal(await source(),'$\\frac{a}{b}');
 await page.keyboard.insertText('路程');await page.keyboard.press('Tab');await page.keyboard.insertText('时间');await page.keyboard.press('Tab');await page.keyboard.insertText('$');assert.equal(await source(),'$\\frac{路程}{时间}$');
 await complete('\\sqar');await choose('sqrt');assert.equal(await source(),'$\\sqrt{x}');
 await complete('\\schr');await choose('schrodinger');assert.match(await source(),/i\\hbar\\frac\{\\partial \\psi\}/);
 await complete('\\b');await row('beta').locator('[data-rendered=true]').waitFor();assert.ok(await row('beta').locator('svg path').count()>0);await page.keyboard.press('Escape');
 check('fraction fields accept Chinese, Tab navigation, square-root alias, physics snippets and Greek previews use SVG glyphs without changing source before selection');

 const chinese='# 中文公式\n\n$速度=\\frac{路程}{时间}$\n\n$$\n\\text{中文说明}\\quad x_{\\text{初始}}=2\n$$';await set(chinese);
 assert.equal(await page.locator('#preview .math-error').count(),0);
 const texts=await page.locator('#preview mjx-container text').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,font:n.getAttribute('font-family'),width:n.getBoundingClientRect().width})));
 assert.ok(texts.map(t=>t.text).join('').includes('速度路程时间'));assert.ok(texts.every(t=>t.font.includes('SimSun')&&t.width>0));
 await page.locator('#preview').screenshot({path:dir+'/chinese.png',animations:'disabled'});
 await page.keyboard.press('Control+Shift+p');await page.locator('#command-palette input').fill('导出 PDF');await page.keyboard.press('Enter');await page.waitForSelector('#export-html');
 const download=page.waitForEvent('download');await page.click('#export-html');const file=await download;const output=path.resolve(dir+'/chinese.html');await file.saveAs(output);const html=await readFile(output,'utf8');assert.match(html,/SimSun,STSong,Songti SC/);for(const text of ['速','度','路','程','时','间','中','文'])assert.ok(html.includes('>'+text+'</text>'));
 check('direct Han text, text annotations and subscripts render and remain in standalone HTML SVG with explicit CJK fonts');
 await page.keyboard.press('Control+Shift+p');await page.locator('#command-palette input').fill('导出 PDF');await page.keyboard.press('Enter');await page.waitForSelector('#export-word');
 const wordDownload=page.waitForEvent('download');await page.click('#export-word');const word=await wordDownload;const wordPath=path.resolve(dir+'/chinese.docx');await word.saveAs(wordPath);
 const parts=unzipSync(await readFile(wordPath)),media=Object.keys(parts).filter(name=>/^word\/media\/.*\.png$/.test(name));assert.ok(media.length>=2);
 for(const [index,name] of media.entries()){const data=Buffer.from(parts[name]);assert.equal(data.toString('ascii',1,4),'PNG');assert.ok(data.readUInt32BE(16)>0&&data.readUInt32BE(20)>0);await writeFile(`${dir}/word-formula-${index}.png`,data);}
 check('Word export embeds nonempty PNG images for both Chinese formulas');

 for(const skin of ['water','witch-light','witch-immersive']){
  await page.keyboard.press('Alt+6');await page.click('#panel-skin');await page.click(`[data-ui-skin-choice="${skin}"]`);if(skin!=='water')await page.waitForFunction(()=>document.documentElement.dataset.witchAssets==='ready');await page.click('#modal-close');await page.click('#writing-panel-close');
  for(const night of [false,true]){
   if((await page.locator('body').getAttribute('data-appearance')==='night')!==night)await page.click('#night-button');
   await complete('\\diff');await row('diff').locator('[data-rendered=true]').waitFor();await page.waitForTimeout(150);
   const bounds=await page.locator('.cm-tooltip-autocomplete').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=1600&&bounds.y+bounds.height<=1000);
   assert.ok(await page.locator('.cm-tooltip-autocomplete>ul').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
   await page.screenshot({path:`${dir}/${skin}-${night?'night':'day'}.png`,animations:'disabled'});await page.keyboard.press('Escape');
  }
 }
 await page.keyboard.press('Alt+2');await page.locator('#latex-completion-toggle').uncheck();await page.click('#writing-panel-close');await set('$');await page.keyboard.type('\\fr');await page.waitForTimeout(200);assert.equal(await page.locator('.cm-tooltip-autocomplete').count(),0);
 await page.keyboard.press('Alt+2');await page.locator('#latex-completion-toggle').check();await page.click('#writing-panel-close');
 await set('```tex\n');await page.keyboard.type('\\fr');await page.waitForTimeout(200);assert.equal(await page.locator('.cm-tooltip-autocomplete').count(),0);
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);check('all three skins in day/night have contained previews; the assistant toggle and fenced-code boundary remain effective offline');
} catch(error){await page.screenshot({path:dir+'/failure.png'});throw error;}
finally{await writeFile(dir+'/report.json',JSON.stringify({channel,checks,errors,network},null,2));await browser.close();}
