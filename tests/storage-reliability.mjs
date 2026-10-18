import './workspace-driver.mjs';
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8,zipSync,strToU8} from 'fflate';
const channel=process.env.STORAGE_BROWSER||'chrome',checks=[],errors=[];
await mkdir(`test-results/storage-${channel}-temp`,{recursive:true});process.env.TEMP=process.env.TMP=process.env.TMPDIR=path.resolve(`test-results/storage-${channel}-temp`);
const browser=await chromium.launch({channel,headless:true,downloadsPath:process.env.TEMP});
const context=await browser.newContext({offline:true,viewport:{width:1440,height:1000},acceptDownloads:true});
const cdp=await browser.newBrowserCDPSession(),{browserContextIds}=await cdp.send('Target.getBrowserContexts');await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',browserContextId:browserContextIds[0],downloadPath:process.env.TEMP});
const url=pathToFileURL(path.resolve('dist/纸间-离线公众号排版器.html')).href;
const open=async()=>{const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.goto(url);await p.waitForSelector('.cm-content');return p;};
const saved=p=>p.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');
const text=async(p,md,wait=true)=>{await p.locator('.cm-content').click();await p.keyboard.press('Control+a');await p.keyboard.insertText(md);if(wait)await saved(p);};
const records=p=>p.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('paper-studio-v1',1);r.onsuccess=()=>{const db=r.result,t=db.transaction(['articles','assets']),a=t.objectStore('articles').getAll(),b=t.objectStore('assets').getAll();t.oncomplete=()=>{resolve({articles:a.result,assets:b.result});db.close();};t.onerror=()=>reject(t.error);};}));
const library=async p=>{if(await p.locator('#library').isHidden())await p.click('#library-button');};
const select=async(p,id)=>{await library(p);await p.locator(`.article-item[data-id="${id}"] strong`).click();};
const fail=async p=>p.evaluate(()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('simulated full','QuotaExceededError');};});
const check=name=>{checks.push(name);console.log('PASS '+name);};
const download=async(p,click,name)=>{const pending=p.waitForEvent('download');await click();const d=await pending;const file=path.resolve(`test-results/${channel}-${name}`);await d.saveAs(file);return new Uint8Array(await readFile(file));};
try{
 const a=await open();await saved(a);await text(a,'# 并发原稿\n\n共同起点。');const original=(await records(a)).articles[0].id;
 const b=await open();await text(a,'# 并发原稿\n\n甲窗口独立写下的内容。');await text(b,'# 并发原稿\n\n乙窗口独立写下的内容。');
 let state=await records(a);assert.equal(state.articles.length,2);assert.ok(state.articles.find(v=>v.id===original).markdown.includes('甲窗口'));const conflict=state.articles.find(v=>v.id!==original);assert.match(conflict.title,/冲突副本/);assert.match(conflict.markdown,/乙窗口/);assert.equal(await b.locator('#document-title').innerText(),'并发原稿');check('two stale windows save independent articles instead of silently overwriting');
 await text(b,'# 并发原稿\n\n乙窗口继续写在冲突副本。');state=await records(b);assert.equal(state.articles.length,2);assert.match(state.articles.find(v=>v.id===conflict.id).markdown,/继续写/);check('continued editing stays attached to the new conflict copy');
 await b.reload();await b.waitForSelector('.cm-content');assert.equal(await b.locator('#document-title').innerText(),'并发原稿');await select(b,original);
 const same='# 并发原稿\n\n双方恰好写下相同段落。';await text(a,same);await text(b,same);assert.equal((await records(a)).articles.length,2);check('identical stale writes merge history without multiplying copies');
 // Simulate an older release that retains unknown fields but edits the body.
 await b.evaluate(id=>new Promise(resolve=>{const req=indexedDB.open('paper-studio-v1',1);req.onsuccess=()=>{const db=req.result,tx=db.transaction('articles','readwrite'),store=tx.objectStore('articles'),r=store.get(id);r.onsuccess=()=>store.put({...r.result,markdown:'# 并发原稿\n\n旧版本客户端的正文。',updated:Date.now()});tx.oncomplete=()=>{db.close();resolve();};};}),original);
 await text(a,'# 并发原稿\n\n新版客户端自己的后续。');state=await records(a);assert.ok(state.articles.some(v=>v.id===original&&v.markdown.includes('旧版本客户端')));assert.ok(state.articles.some(v=>v.markdown.includes('新版客户端')));check('older clients changing content with the same revision token are still detected');
 await a.reload();await a.waitForSelector('.cm-content');await select(a,original);await b.reload();await b.waitForSelector('.cm-content');await select(b,original);
 // Keep a write transaction busy while a save is in flight, then edit again.
 await b.evaluate(()=>{window.releaseStorage=false;const r=indexedDB.open('paper-studio-v1',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('articles','readwrite'),s=tx.objectStore('articles');const loop=()=>{if(window.releaseStorage)return;s.get('test-transaction-lock').onsuccess=loop;};loop();tx.oncomplete=()=>db.close();};});
 await text(a,'# 并发原稿\n\n保存排队时的第一段。',false);await a.waitForTimeout(1100);await text(a,'# 并发原稿\n\n保存排队后继续输入的新段落。',false);await b.evaluate(()=>window.releaseStorage=true);await saved(a);assert.match((await records(a)).articles.find(v=>v.id===original).markdown,/继续输入的新段落/);check('typing during an in-flight save commits the latest generation and keeps the editor attached');
 await b.reload();await b.waitForSelector('.cm-content');await select(b,original);
 await text(a,'# 并发原稿\n\n原窗口的新基线。');
 await a.evaluate(()=>{window.releaseStorage=false;const r=indexedDB.open('paper-studio-v1',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('articles','readwrite'),s=t.objectStore('articles');const loop=()=>{if(!window.releaseStorage)s.get('hold-for-conflict').onsuccess=loop;};loop();t.oncomplete=()=>db.close();};});
 await text(b,'# 冲突排队中的标题\n\n第一版。',false);await b.waitForTimeout(1100);await text(b,'# 等待期间的新标题\n\n等待期间继续写下的文字。',false);await a.evaluate(()=>window.releaseStorage=true);await saved(b);
 state=await records(b);assert.match(state.articles.find(v=>v.id===original).markdown,/原窗口的新基线/);const late=state.articles.find(v=>v.markdown.includes('等待期间继续写下'));assert.ok(late);assert.match(late.title,/等待期间的新标题/);assert.match(await b.locator('#document-title').innerText(),/等待期间的新标题/);check('a late conflict rebinds pending text and a newer title to the same protected copy');
 await a.reload();await a.waitForSelector('.cm-content');await select(a,original);await b.reload();await b.waitForSelector('.cm-content');await select(b,original);
 // Keep both drafts uncommitted and open a third window: live text is private.
 await fail(a);await text(a,'# 并发原稿\n\n甲的尚未提交文字。',false);await library(a);await a.click('#new-article');await text(a,'# 第二篇未提交\n\n切换后仍需找回。',false);await a.waitForFunction(()=>document.getElementById('save-state').textContent.includes('保存失败'));
 const c=await open();assert.doesNotMatch(await c.locator('#preview').innerText(),/尚未提交|切换后仍需找回/);check('opening another window does not steal or recover a still-live draft');
 await text(b,'# 并发原稿\n\n乙后来提交了新的原稿。');await a.close();await c.close();
 const recovered=await open();await saved(recovered);state=await records(recovered);
 assert.ok(state.articles.find(v=>v.id===original).markdown.includes('乙后来提交'));
 assert.ok(state.articles.some(v=>v.markdown.includes('甲的尚未提交')&&v.id!==original));assert.ok(state.articles.some(v=>v.markdown.includes('切换后仍需找回')));check('crashed window recovers every pending article and preserves a newer stored original');
 const count=state.articles.length;await recovered.reload();await recovered.waitForSelector('.cm-content');await saved(recovered);assert.equal((await records(recovered)).articles.length,count);check('committed recovery entries are cleared and do not create duplicate drafts on reload');
 // Text checkpoints still work when the main database cannot accept writes.
 await fail(recovered);await text(recovered,'# 故障中的稿件\n\n事务失败也有独立恢复记录。',false);await recovered.waitForFunction(()=>document.getElementById('save-state').textContent.includes('保存失败'));
 assert.ok(await recovered.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('paper-draft-')).some(k=>localStorage.getItem(k).includes('事务失败'))));await recovered.close();
 const d=await open();await saved(d);assert.match(await d.locator('#preview').innerText(),/事务失败/);check('failed database transaction keeps an independent checkpoint until actual recovery commits');
 // Corrupt recovery entries do not prevent opening or remove the damaged data.
 await d.evaluate(()=>localStorage.setItem('paper-draft-corrupt','{broken'));await d.reload();await d.waitForSelector('.cm-content');assert.match(await d.locator('#preview').innerText(),/事务失败/);assert.equal(await d.evaluate(()=>localStorage.getItem('paper-draft-corrupt')),'{broken');check('corrupt checkpoints are reported and retained without blocking saved articles');
 await d.evaluate(()=>localStorage.removeItem('paper-draft-corrupt'));
 const e=await open(),f=await open();await select(e,original);await select(f,original);await fail(e);await fail(f);await text(e,'# 同时误关甲\n\n甲需要找回的独立段落。',false);await text(f,'# 同时误关乙\n\n乙需要找回的独立段落。',false);await e.close();await f.close();await d.reload();await d.waitForSelector('.cm-content');await saved(d);state=await records(d);const draftA=state.articles.find(v=>v.markdown.includes('甲需要找回的独立段落')),draftB=state.articles.find(v=>v.markdown.includes('乙需要找回的独立段落'));assert.ok(draftA);assert.ok(draftB);assert.ok(!JSON.stringify(draftA.revisions).includes('乙需要找回的独立段落'));assert.ok(!JSON.stringify(draftB.revisions).includes('甲需要找回的独立段落'));check('two crashed writers with the same baseline recover both drafts with independent histories');
 await library(d);await d.click('#new-article');await text(d,'# 插图的两个版本\n\n插图说明。');
 const png=await d.evaluate(()=>{const c=document.createElement('canvas');c.width=60;c.height=40;c.getContext('2d').fillRect(0,0,60,40);return c.toDataURL();});
 await d.locator('#image-input').setInputFiles({name:'shared.png',mimeType:'image/png',buffer:Buffer.from(png.split(',')[1],'base64')});await d.waitForSelector('#preview img');await saved(d);
 const setCaption=async value=>{await d.click('#assets-button');await d.locator('[data-asset-field="caption"]').fill(value);await d.locator('[data-asset-field="caption"]').dispatchEvent('change');await d.click('#modal-close');await saved(d);};
 await setCaption('原稿图注');await d.click('#assets-button');await d.locator('[data-asset-field="width"]').fill('48');await d.locator('[data-asset-field="width"]').dispatchEvent('change');await d.click('#modal-close');await saved(d);
 await d.click('#writing-tools-button');await d.click('#writing-checkpoint');await saved(d);
 const sourceId=(await records(d)).articles.find(v=>v.title==='插图的两个版本').id;await library(d);await d.locator(`.article-item[data-id="${sourceId}"] summary`).click();await d.locator(`.article-item[data-id="${sourceId}"] [data-action="duplicate"]`).click();await saved(d);await setCaption('副本独立图注');
 const withImages=(await records(d));assert.equal(withImages.assets.length,1);await select(d,sourceId);assert.match(await d.locator('#preview').innerText(),/原稿图注/);assert.doesNotMatch(await d.locator('#preview').innerText(),/副本独立图注/);check('article copies share binary originals while captions and size remain independent');
 await setCaption('原稿新图注');await d.locator(`.article-item[data-id="${sourceId}"] summary`).click();await d.locator(`.article-item[data-id="${sourceId}"] [data-action="history"]`).click();
 const history=(await records(d)).articles.find(v=>v.id===sourceId).revisions;const target=[...history].reverse().findIndex(r=>Object.values(r.assetSettings||{}).some(a=>a.caption==='原稿图注'&&a.width===48));assert.ok(target>=0);await d.locator(`[data-revision="${target}"]`).click();await saved(d);assert.match(await d.locator('#preview').innerText(),/原稿图注/);await d.click('#assets-button');assert.equal(await d.locator('[data-asset-field="width"]').inputValue(),'48');await d.click('#modal-close');check('history restoration includes image caption and width as well as text and theme');
 await d.click('#export-toggle');const zip=await download(d,()=>d.click('#export-backup'),'storage-backup.zip');const entries=unzipSync(zip),manifest=JSON.parse(strFromU8(entries['manifest.json']));assert.equal(Object.values(manifest.articles[0].assetSettings)[0].caption,'原稿图注');assert.equal(manifest.assets.length,1);
 await d.locator('#import-input').setInputFiles({name:'roundtrip.zip',mimeType:'application/zip',buffer:Buffer.from(zip)});await saved(d);assert.match(await d.locator('#preview').innerText(),/原稿图注/);await d.click('#assets-button');assert.equal(await d.locator('[data-asset-field="width"]').inputValue(),'48');await d.click('#modal-close');check('ZIP roundtrip remaps article and historical image appearance identifiers');
 const before=(await records(d)).articles.length;Object.values(manifest.articles[0].assetSettings)[0].width=999;entries['manifest.json']=strToU8(JSON.stringify(manifest));await d.locator('#import-input').setInputFiles({name:'bad-image-settings.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync(entries))});await d.waitForTimeout(300);assert.equal((await records(d)).articles.length,before);assert.match(await d.locator('#toast').innerText(),/排版设置/);check('invalid imported image appearance rejects the entire backup without partial writes');
 assert.deepEqual(errors,[]);check('all storage paths complete without uncaught script errors');
 await d.screenshot({path:`test-results/storage-${channel}.png`,fullPage:true});
}finally{await writeFile(`test-results/storage-reliability-${channel}.json`,JSON.stringify({browser:channel,version:browser.version(),checks,errors},null,2));await browser.close();}
