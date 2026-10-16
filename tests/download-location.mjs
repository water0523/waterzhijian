import {chromium} from 'playwright';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
const root=path.resolve('test-results/download-location');await mkdir(root,{recursive:true});
process.env.TEMP=process.env.TMP=process.env.TMPDIR=root;
const file=path.resolve('dist/非水·成章-离线公众号排版器.html'),html=await readFile(file,'utf8');
const checks=[],errors=[],network=[];
const check=name=>{checks.push(name);console.log(name);};
async function setup(context,page){
  page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>{localStorage.setItem('paper-library-open','false');localStorage.setItem('paper-theme-sidebar-open','false');});
}
async function set(page){await page.locator('.cm-content').focus();await page.keyboard.press('Control+a');await page.keyboard.insertText('# 文件夹定位测试\n\n正文与上标引用<sup>2</sup>。');await page.waitForTimeout(260);}
async function exported(page,kind){await page.click('#export-toggle');const wait=page.waitForEvent('download');await page.click('#export-'+kind);return await wait;}
async function reveal(page){await page.click('[data-download-reveal]');await page.waitForFunction(()=>document.querySelector('#download-location-notice p')?.textContent.includes('已请求打开文件'));}
for(const channel of ['chrome','msedge']){
  const browser=await chromium.launch({channel,headless:true,downloadsPath:root}),context=await browser.newContext({offline:true,acceptDownloads:true,viewport:{width:1600,height:1000}}),page=await context.newPage();
  await setup(context,page);page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  try{
    await page.goto(pathToFileURL(file).href);await page.waitForSelector('.cm-content');await set(page);
    const md=await exported(page,'md');assert.match(md.suggestedFilename(),/文件夹定位测试\.md$/);assert.match(await readFile(await md.path(),'utf8'),/^# 文件夹定位测试/);
    const notice=page.locator('#download-location-notice');await notice.waitFor();assert.match(await notice.innerText(),/已交给浏览器下载/);assert.equal(await notice.locator('[data-download-reveal]').innerText(),'启用文件夹定位');
    await page.screenshot({path:`test-results/download-location-day-${channel}.png`});
    await notice.locator('[data-download-reveal]').click();assert.match(await page.locator('#modal-body').innerText(),/允许访问文件网址/);
    const wait=page.waitForEvent('download');await page.click('#download-get-helper');const helper=await wait,archive=unzipSync(new Uint8Array(await readFile(await helper.path()))),prefix='非水成章-下载定位助手/';
    const manifest=JSON.parse(strFromU8(archive[prefix+'manifest.json']));assert.deepEqual(manifest.permissions,['downloads']);assert.equal(Object.keys(archive).length,4);
    for(const name of ['manifest.json','background.js','content.js','使用说明.txt'])assert.deepEqual(archive[prefix+name],new Uint8Array(await readFile('folder-helper/'+name)));
    assert.equal(await notice.locator('strong').innerText(),md.suggestedFilename());await page.click('#modal-close');
    await notice.locator('.download-location-close').click();assert.equal(await notice.isVisible(),false);
    await page.click('#export-toggle');await page.click('#export-download-location');assert.match(await page.locator('#modal-body').innerText(),/Ctrl\+J/);await page.click('#modal-close');
    await page.click('#export-toggle');await page.click('#export-pdf');assert.match(await page.locator('#modal-body').innerText(),/无法读取实际路径/);
    const popupWait=page.waitForEvent('popup');await page.click('#pdf-standard');const popup=await popupWait;await popup.waitForSelector('#print-download-folder');assert.match(await popup.locator('.print-controls').innerText(),/这里只打开默认下载文件夹/);
    await popup.click('#print-download-folder');await page.bringToFront();await page.waitForSelector('#download-get-helper');await page.click('#modal-close');await popup.close();
    await exported(page,'md');await page.click('#night-button');await page.screenshot({path:`test-results/download-location-night-${channel}.png`});
    check(channel+': unmodified downloads, non-blocking notice, helper ZIP, setup, dismissal, export entry and honest PDF fallback work without an extension');
  }finally{await browser.close();}
}

const helperPath=path.resolve('folder-helper'),downloads=path.join(root,'saved'),custom=path.join(downloads,'custom-destination'),profile=path.join(root,'edge-profile-'+Date.now());await mkdir(downloads,{recursive:true});await mkdir(custom,{recursive:true});await mkdir(path.join(profile,'Default'),{recursive:true});
await writeFile(path.join(profile,'Default','Preferences'),JSON.stringify({download:{default_directory:downloads,prompt_for_download:false,directory_upgrade:true}}));
const context=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,acceptDownloads:true,viewport:{width:1600,height:1000},args:['--disable-extensions-except='+helperPath,'--load-extension='+helperPath]});
try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),extensionId=new URL(worker.url()).host;
  const cdp=await context.browser().newBrowserCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'default',eventsEnabled:true});
  await worker.evaluate(()=>{globalThis.__revealed=[];globalThis.__defaultOpened=0;chrome.downloads.show=id=>__revealed.push(id);chrome.downloads.showDefaultFolder=()=>{__defaultOpened++;};});
  const page=await context.newPage();await setup(context,page);
  await context.route('https://water0523.github.io/waterzhijian/',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
  await page.goto('https://water0523.github.io/waterzhijian/');await page.waitForSelector('.cm-content');await set(page);
  const first=await exported(page,'md');try{await page.waitForFunction(()=>document.querySelector('#download-location-notice p')?.textContent==='下载完成');}catch(error){console.log(await worker.evaluate(()=>chrome.downloads.search({limit:3})));console.log(await page.locator('#download-location-notice').innerText());throw error;}
  const firstItem=await worker.evaluate(async()=>{const items=await chrome.downloads.search({limit:10,orderBy:['-startTime']});return items.find(i=>i.url.startsWith('blob:https://water0523.github.io/'));});
  await access(firstItem.filename);assert.equal(path.dirname(firstItem.filename),downloads);
  await page.click('[data-download-reveal]');await page.waitForFunction(()=>document.querySelector('#download-location-notice p')?.textContent.includes('已请求打开'));
  assert.deepEqual(await worker.evaluate(()=>__revealed),[firstItem.id]);
  await worker.evaluate(()=>{globalThis.__rename=(item,suggest)=>suggest(item.filename.endsWith('.md')?{filename:'浏览器更名后的副本.md',conflictAction:'uniquify'}:{});chrome.downloads.onDeterminingFilename.addListener(__rename);});
  const second=await exported(page,'md');await page.waitForFunction(()=>document.querySelector('#download-location-notice p')?.textContent==='下载完成');
  const secondItem=await worker.evaluate(async()=>{const items=await chrome.downloads.search({limit:10,orderBy:['-startTime']});return items.find(i=>i.url.startsWith('blob:https://water0523.github.io/'));});
  assert.notEqual(secondItem.id,firstItem.id);assert.notEqual(secondItem.filename,firstItem.filename);assert.match(path.basename(secondItem.filename),/浏览器更名后的副本/);await access(secondItem.filename);
  await worker.evaluate(()=>chrome.downloads.onDeterminingFilename.removeListener(__rename));
  await reveal(page);assert.deepEqual(await worker.evaluate(()=>__revealed),[firstItem.id,secondItem.id]);
  check('real Edge extension matches each real blob download to its own ID and renamed duplicate file');

  await worker.evaluate(()=>{globalThis.__destination=(item,suggest)=>suggest(item.filename.endsWith('.docx')?{filename:'custom-destination/文件夹定位测试.docx',conflictAction:'uniquify'}:{});chrome.downloads.onDeterminingFilename.addListener(__destination);});
  const word=await exported(page,'word');await page.waitForFunction(()=>document.querySelector('#download-location-notice p')?.textContent==='下载完成');
  const wordItem=await worker.evaluate(async()=>{const items=await chrome.downloads.search({limit:10,orderBy:['-startTime']});return items.find(i=>i.filename.endsWith('.docx'));});
  assert.equal(path.dirname(wordItem.filename),custom);await access(wordItem.filename);
  await worker.evaluate(()=>chrome.downloads.onDeterminingFilename.removeListener(__destination));
  const xml=strFromU8(unzipSync(new Uint8Array(await readFile(wordItem.filename)))['word/document.xml']);assert.match(xml,/文件夹定位测试/);
  await reveal(page);assert.equal(await worker.evaluate(()=>__revealed.at(-1)),wordItem.id);
  await page.click('#export-toggle');await page.click('#export-download-location');assert.match(await page.locator('#download-helper-state').innerText(),/已连接/);await page.click('#download-open-default');await page.waitForFunction(()=>document.querySelector('#download-helper-state')?.textContent.includes('已请求打开默认'));assert.equal(await worker.evaluate(()=>__defaultOpened),1);await page.click('#modal-close');
  await page.screenshot({path:'test-results/download-location-connected-edge.png'});
  check('Word remains valid; a custom download directory uses its actual file ID, and default-folder opening is a separate action');

  const sourceURL=await worker.evaluate(async()=>{const items=await chrome.downloads.search({limit:10,orderBy:['-startTime']});return items.find(i=>i.filename.endsWith('.docx')).url;});
  const send=(message,delay=0)=>page.evaluate(({message,delay})=>new Promise(resolve=>{const request=crypto.randomUUID(),channel='feishui-download-location-v1';const listener=e=>{if(e.data?.channel===channel&&e.data.request===request&&e.data.direction==='extension'){removeEventListener('message',listener);resolve(e.data);}};addEventListener('message',listener);setTimeout(()=>postMessage({channel,direction:'page',request,...message},'*'),delay);}),{message,delay});
  assert.equal((await send({action:'status',url:'file:///C:/Windows/not-a-download.pdf'})).ok,false);
  assert.equal((await send({action:'status',url:'blob:https://evil.example/00000000-0000-0000-0000-000000000000'})).ok,false);
  assert.equal((await send({action:'status',url:sourceURL.slice(0,-1)+(sourceURL.endsWith('f')?'e':'f')})).state,'pending');
  const before=await worker.evaluate(()=>__revealed.length);assert.equal((await send({action:'reveal',url:sourceURL},5500)).ok,false);assert.equal(await worker.evaluate(()=>__revealed.length),before);
  await worker.evaluate(async url=>{const [item]=await chrome.downloads.search({urlRegex:'^'+url.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$'});await chrome.downloads.removeFile(item.id);},sourceURL);
  await page.click('[data-download-reveal]');await page.waitForFunction(()=>document.querySelector('#download-location-notice p')?.textContent.includes('移动或删除'));assert.equal(await worker.evaluate(()=>__revealed.length),before);
  check('arbitrary paths, foreign origins, unmatched blobs, missing files and non-gesture reveal requests never reach the OS reveal call');

  const settings=await context.newPage();await settings.goto('edge://extensions/');
  const accessEnabled=await settings.evaluate(extensionId=>new Promise(resolve=>chrome.developerPrivate.updateExtensionConfiguration({extensionId,fileAccess:true},()=>resolve(!chrome.runtime.lastError))),extensionId);await settings.close();
  assert.equal(accessEnabled,true,'test profile must allow local-file extension access');
  assert.equal(await worker.evaluate(()=>new Promise(resolve=>chrome.extension.isAllowedFileSchemeAccess(resolve))),true);
  const local=await context.newPage();await setup(context,local);await local.goto(pathToFileURL(file).href);await local.waitForSelector('.cm-content');await set(local);await exported(local,'md');try{await local.waitForFunction(()=>document.querySelector('#download-location-notice p')?.textContent==='下载完成');}catch(error){console.log(await local.locator('#download-location-notice').innerText());console.log(await worker.evaluate(()=>chrome.downloads.search({limit:1,orderBy:['-startTime']})));throw error;}
  await reveal(local);assert.ok(await worker.evaluate(()=>__revealed.length)>before);
  check('real helper injection and exact download matching also work in the offline local HTML after allowing file access in the disposable profile');
}finally{await context.close();await writeFile('test-results/download-location.json',JSON.stringify({checks,errors,network},null,2));}
assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
