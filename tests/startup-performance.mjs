import {chromium} from 'playwright';
import {mkdir,writeFile,access} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const channel=process.env.STARTUP_BROWSER||'chrome',iterations=Number(process.env.STARTUP_RUNS||3),checks=[],errors=[],runs=[];
await mkdir('test-results',{recursive:true});
const after=path.resolve('dist/非水·成章-离线公众号排版器.html'),before=path.resolve('test-results/startup-before.html');
const variants=[['after',after]];try{await access(before);variants.unshift(['before',before]);}catch{}
const browser=await chromium.launch({channel,headless:true});
const observe=()=>{
 window.boot={ready:0,longTasks:[]};new PerformanceObserver(list=>window.boot.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
 let scheduled=false;const observer=new MutationObserver(()=>{
  if(!scheduled&&document.querySelector('.cm-content')&&document.querySelector('#render-state')?.dataset.duration){scheduled=true;observer.disconnect();requestAnimationFrame(()=>{window.boot.ready=performance.now();});}
 });observer.observe(document,{subtree:true,childList:true,attributes:true});
};
try{
 for(const scenario of ['fresh','reopen','sidebar'])for(let i=0;i<iterations;i++)for(const [variant,file] of variants){
  const context=await browser.newContext({offline:true,viewport:{width:1600,height:1000}});await context.addInitScript(observe);
  if(scenario==='sidebar')await context.addInitScript(()=>localStorage.setItem('paper-theme-sidebar-open','true'));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(file).href);await page.waitForFunction(()=>window.boot.ready>0);
  if(scenario==='reopen'){await page.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');await page.reload();await page.waitForFunction(()=>window.boot.ready>0);}
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const metrics=await page.evaluate(()=>({ready:window.boot.ready,paint:performance.getEntriesByName('first-contentful-paint')[0]?.startTime||0,longestTask:Math.max(0,...window.boot.longTasks.map(t=>t.duration)),blocking:window.boot.longTasks.reduce((sum,t)=>sum+Math.max(0,t.duration-50),0),cards:document.querySelectorAll('[data-sidebar-card]').length,previews:document.querySelectorAll('#sidebar-theme-results .theme-sample').length,source:JSON.parse(localStorage.getItem('paper-recovery')).markdown}));
  if(variant==='after'){assert.ok(metrics.source.includes('一束光'));assert.equal(metrics.cards,scenario==='sidebar'?42:0);assert.ok(metrics.previews<10,'only visible and nearby previews should be generated');}
  delete metrics.source;runs.push({scenario,variant,...metrics});await context.close();
 }
 const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)],summary=[];
 for(const scenario of ['fresh','reopen','sidebar'])for(const [variant] of variants){const selected=runs.filter(r=>r.scenario===scenario&&r.variant===variant);summary.push({scenario,variant,ready:Math.round(median(selected.map(r=>r.ready))),paint:Math.round(median(selected.map(r=>r.paint))),longestTask:Math.round(median(selected.map(r=>r.longestTask))),blocking:Math.round(median(selected.map(r=>r.blocking))),previews:median(selected.map(r=>r.previews))});}
 console.log(JSON.stringify(summary,null,2));checks.push('fresh, saved-document reload and open-sidebar launches measured with isolated offline contexts');
 const context=await browser.newContext({offline:true,viewport:{width:1600,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(after).href);await page.waitForSelector('.cm-content');await page.waitForFunction(()=>document.querySelector('#render-state').dataset.duration);
 const original=await page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown);assert.equal(await page.locator('#theme-sidebar .theme-sample').count(),0);await page.click('#theme-sidebar-toggle');await page.waitForSelector('[data-sidebar-theme=rational] .theme-sample');
 for(const id of ['digest','press','gewu']){await page.locator('[data-sidebar-theme='+id+']').scrollIntoViewIfNeeded();await page.waitForSelector('[data-sidebar-card='+id+'] .'+id+'-masthead');await page.locator('[data-sidebar-theme='+id+']').hover();assert.equal(await page.locator('body').getAttribute('data-theme-peek'),id);}
 await page.locator('#theme-name').hover();assert.equal(await page.locator('body').getAttribute('data-theme-peek'),null);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown),original);
 await page.fill('#sidebar-theme-search','press');await page.waitForSelector('[data-sidebar-card=press] .press-masthead');assert.equal(await page.locator('[data-sidebar-card]').count(),1);await page.locator('[data-sidebar-theme=press]').click();await page.locator('#theme-name').hover();assert.equal(await page.locator('#theme-name').innerText(),'深度新闻周刊');
 await page.click('#theme-sidebar-close');await page.click('#theme-sidebar-toggle');assert.equal(await page.locator('[data-sidebar-card=press] .press-masthead').count(),1);await page.click('#night-button');await page.waitForTimeout(250);await page.screenshot({path:'test-results/startup-sidebar-'+channel+'.png'});
 checks.push('closed theme library does no preview work; opening, scrolling, search, hover, apply and reopening retain real theme previews');assert.deepEqual(errors,[]);checks.push('all launch and theme operations preserve article text without runtime errors');await context.close();
 await writeFile('test-results/startup-performance-'+channel+'.json',JSON.stringify({channel,version:browser.version(),iterations,summary,runs,checks,errors},null,2));
}finally{await browser.close();}
