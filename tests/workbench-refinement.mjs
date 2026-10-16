import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
const channel=process.env.WORKBENCH_BROWSER||'chrome',checks=[],errors=[],network=[];
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel,headless:true}),context=await browser.newContext({offline:true,viewport:{width:1600,height:1000},acceptDownloads:true}),page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});page.on('dialog',d=>d.accept());
const check=s=>{checks.push(s);console.log('PASS '+s);},state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery'))),name=()=>page.locator('#document-title').innerText();
const set=async text=>{await page.locator('.cm-content').click();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await page.waitForTimeout(350);};
const saved=()=>page.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');
try{
 await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
 assert.equal(await page.locator('#title-mode,input#document-title').count(),0);assert.equal(await page.locator('#library').isVisible(),true);assert.equal(await page.locator('#theme-sidebar').isVisible(),false);assert.equal(await page.locator('.brand-image').evaluate(n=>n.complete&&n.naturalWidth>0),true);
 check('default document sidebar, supplied logo and read-only H1 title replace custom naming controls');
 const rich='# 第一个 **标题** 与 [链接](https://example.org)\n\n正文。\n\n# 第二个标题';await set(rich);assert.equal(await name(),'第一个 标题 与 链接');assert.equal((await state()).markdown,rich);assert.equal((await state()).titleMode,'auto');
 await set('```md\n# 代码标题\n```\n\n> # 引用标题\n\n## 小节\n\n真正的标题\n======');assert.equal(await name(),'真正的标题');
 await set('# 可撤销的标题\n\n正文。');const before=(await state()).markdown;await page.keyboard.press('Control+Home');await page.keyboard.press('Shift+End');await page.keyboard.press('Backspace');await page.waitForTimeout(300);assert.equal(await name(),'未命名文章');await page.keyboard.press('Control+z');await page.waitForTimeout(300);assert.equal(await name(),'可撤销的标题');assert.equal((await state()).markdown,before);
 check('plain first top-level H1 tracks rich headings, deletion and undo while excluding code, quotes and H2');
 await set('# 旧稿的正文标题\n\n原稿文字，逐字保留。');await saved();const original=(await state()).id;
 await page.evaluate(async id=>{await new Promise((resolve,reject)=>{const req=indexedDB.open('paper-studio-v1',1);req.onsuccess=()=>{const db=req.result,tx=db.transaction('articles','readwrite'),store=tx.objectStore('articles'),get=store.get(id);get.onsuccess=()=>{const a=get.result;a.title='旧的自定义文件名';a.titleMode='manual';store.put(a);};tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);});for(const key of Object.keys(localStorage))if(key==='paper-recovery'||key.startsWith('paper-draft-'))localStorage.removeItem(key);},original);
 await page.reload();await page.waitForSelector('.cm-content');assert.equal(await name(),'旧稿的正文标题');assert.equal((await state()).markdown,'# 旧稿的正文标题\n\n原稿文字，逐字保留。');
 await set('# 修改后的正文标题\n\n原稿文字，逐字保留。');await saved();await page.reload();await page.waitForSelector('.cm-content');assert.equal(await name(),'修改后的正文标题');assert.equal((await state()).titleMode,'auto');
 check('legacy manual records reopen under the sole H1 policy, preserve source, and persist subsequent edits');
 await page.locator('.article-item.current summary').click();await page.locator('.article-item.current [data-action=duplicate]').click();await page.waitForTimeout(250);assert.notEqual((await state()).id,original);assert.equal(await name(),'修改后的正文标题');assert.equal(await page.locator('.article-item').count(),2);
 await page.click('#export-toggle');const pending=page.waitForEvent('download');await page.click('#export-backup');const d=await pending,zip=path.resolve('test-results/refined-'+channel+'.zip');await d.saveAs(zip);const files=unzipSync(await readFile(zip)),manifest=JSON.parse(strFromU8(files['manifest.json']));assert.equal(manifest.articles[0].title,'修改后的正文标题');assert.equal(manifest.articles[0].titleMode,'auto');
 await page.setInputFiles('#import-input',{name:'legacy.zip',mimeType:'application/zip',buffer:await readFile(zip)});await page.waitForTimeout(450);assert.equal(await name(),'修改后的正文标题');
 check('duplicates and actual ZIP export/import derive their names from H1 while retaining independent article ids');
 await page.click('#recent-tab');assert.equal(await page.locator('#recent-tab').getAttribute('aria-pressed'),'true');await page.click('[data-folder="*"]');await page.click('#new-folder');await page.fill('#folder-name','专题文章');await page.click('#folder-save');await page.click('#new-article');assert.equal(await name(),'未命名文章');await set('# 专题笔记\n\n这是一段新内容。');assert.equal((await state()).folder,'专题文章');assert.ok((await page.locator('#library-stats').innerText()).includes('4 篇文章'));await page.click('#active-tab');assert.equal(await page.locator('.article-item').count(),4);
 await page.fill('#library-search','专题笔记');assert.equal(await page.locator('.article-item').count(),1);await page.fill('#library-search','');
 check('document/recent/folder navigation, creation, search and real library statistics update together');
 const unchanged=(await state()).markdown;await page.click('#header-preview-button');assert.equal(await page.locator('body').getAttribute('data-workspace-view'),'preview');assert.equal(await page.locator('#view-preview').getAttribute('aria-pressed'),'true');await page.click('#view-compare');assert.equal(await page.locator('#header-preview-button').getAttribute('aria-pressed'),'false');
 await page.click('#preview-wide');assert.equal(await page.locator('#preview-width').inputValue(),'wide');await page.selectOption('#preview-width','375');assert.equal(await page.locator('#preview-narrow').getAttribute('aria-pressed'),'true');await page.click('#preview-narrow');assert.equal(await page.locator('#preview-width').inputValue(),'430');
 await page.click('#local-button');assert.equal(await page.locator('#local-save-article').isVisible(),true);await page.keyboard.press('Escape');assert.equal((await state()).markdown,unchanged);
 check('header preview, native preview tools, width icons/dropdown and local backup menu preserve the article');
 await page.click('#theme-sidebar-toggle');await page.locator('[data-sidebar-theme=press]').hover();await page.waitForTimeout(150);assert.equal(await page.locator('body').getAttribute('data-theme-peek'),'press');await page.mouse.move(800,40);assert.equal(await page.locator('body').getAttribute('data-theme-peek'),null);await page.click('#theme-sidebar-toggle');
 for(const appearance of ['day','night']){
  if(appearance==='night')await page.click('#night-button');await page.waitForTimeout(200);
  for(const width of [1600,1440,1280,1024]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);const metrics=await page.evaluate(()=>{const a=document.querySelector('.document-heading').getBoundingClientRect(),b=document.querySelector('.header-actions').getBoundingClientRect();return{titleRight:a.right,actionsLeft:b.left,actionsRight:b.right};});assert.ok(metrics.titleRight<=metrics.actionsLeft+1,'title and actions overlap '+width);assert.ok(metrics.actionsRight<=width);assert.ok(await page.locator('#copy-button').isVisible());}
  await page.setViewportSize({width:1600,height:1000});await page.screenshot({path:'test-results/refined-'+appearance+'-'+channel+'.png'});
 }
 check('theme hover preview still restores; day/night desktop layouts retain readable title and all header controls');
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);check('all workbench operations stay offline without runtime errors');
}finally{await writeFile('test-results/workbench-refinement-'+channel+'.json',JSON.stringify({channel,version:browser.version(),checks,errors,network},null,2));await browser.close();}
