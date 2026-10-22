import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const channel=process.env.TEST_BROWSER||'chrome',html=option('--html','dist/非水·成章-离线公众号排版器.html'),out=option('--out',`test-results/library-startup-${channel}`);
await mkdir(out,{recursive:true});const browser=await chromium.launch({channel,headless:true});
try{
 const context=await browser.newContext({offline:true,viewport:{width:1600,height:1000}}),page=await context.newPage();
 await context.addInitScript(()=>{window.longTasks=[];window.articleReady=0;new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});const observer=new MutationObserver(()=>{if(document.querySelector('.cm-content')&&document.querySelector('#render-state')?.dataset.duration){observer.disconnect();requestAnimationFrame(()=>window.articleReady=performance.now());}});observer.observe(document,{subtree:true,attributes:true,childList:true});});
 await page.goto(pathToFileURL(path.resolve(html)).href);await page.waitForSelector('.cm-content');await page.locator('.cm-content').focus();await page.keyboard.press('Control+a');await page.keyboard.insertText('# 字数核对\n\n你好[世界]{font=kai color=#2563eb}');await page.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');if(await page.locator('#library').evaluate(n=>n.hidden))await page.click('#library-button');
 const count={main:await page.locator('#word-count').innerText(),library:await page.locator('.article-item.current small').first().innerText()};
 await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('paper-studio-v1',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('articles','readwrite'),store=t.objectStore('articles'),read=store.getAll();read.onsuccess=()=>{const original=read.result[0],now=Date.now(),paragraph='一段正文包含中文，配合 [强调文字]{font=kai color=#2563eb} 与 **加粗**。\n\n';store.clear();for(let i=0;i<1001;i++)store.put({...original,id:'library-bench-'+i,title:'文章 '+i,customTitle:undefined,markdown:'# 文章 '+i+'\n\n'+paragraph.repeat(120),revisions:[],created:now-i*1000,updated:now-i*1000});localStorage.setItem('paper-current','library-bench-0');localStorage.removeItem('paper-recovery');localStorage.setItem('paper-layout-state',JSON.stringify({library:true,theme:false,panel:false,panelTab:'writing',panelWidth:320,outline:false}));};t.oncomplete=()=>{db.close();resolve();};t.onerror=()=>reject(t.error);};}));
 await page.reload();await page.waitForFunction(()=>window.articleReady>0);await page.waitForTimeout(300);
 const observation=await page.evaluate(()=>({articleReadyMS:articleReady,longTasks,rows:document.querySelectorAll('.article-item').length}));
 const report={artifactHash:createHash('sha256').update(await readFile(html)).digest('hex'),channel,browserVersion:browser.version(),scenario:'1001 articles, 120 paragraphs each; local isolated offline context',observationWindow:'navigation through article-ready + 300ms; one local observation, not a universal performance guarantee',count,...observation,maxMainThreadTaskMS:Math.max(0,...observation.longTasks.map(t=>t.duration))};
 await writeFile(out+'/report.json',JSON.stringify(report,null,2));await page.screenshot({path:out+'/app.png'});console.log(JSON.stringify(report));
}finally{await browser.close();}
