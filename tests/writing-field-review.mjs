import {chromium} from 'playwright';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const channel=process.env.FIELD_BROWSER||'chrome',phase=process.env.FIELD_PHASE||'before',dir=`test-results/field-${phase}-${channel}`;
await mkdir(dir,{recursive:true});process.env.TEMP=process.env.TMP=process.env.TMPDIR=path.resolve(dir);
const browser=await chromium.launch({channel,headless:true,downloadsPath:process.env.TEMP}),context=await browser.newContext({offline:true,viewport:{width:1600,height:1000},permissions:['clipboard-read','clipboard-write'],acceptDownloads:true});
await context.addInitScript(()=>{localStorage.setItem('paper-library-open','false');localStorage.setItem('paper-theme-sidebar-open','false');});
const page=await context.newPage(),errors=[],network=[],articles=[];
page.setDefaultTimeout(7000);
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});page.on('dialog',d=>d.accept());
const files=(await readdir('体验样稿')).filter(f=>f.endsWith('.md')&&f!=='README.md').sort(),themes=['journal-indigo','digest','press','tech','gewu'];
try{
  await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
  for(let i=0;i<files.length;i++){
    const source=await readFile('体验样稿/'+files[i],'utf8');await page.locator('#import-input').setInputFiles(path.resolve('体验样稿/'+files[i]));await page.waitForFunction(title=>document.querySelector('#document-title').textContent===title,source.split('\n')[0].slice(2));
    await page.click('#theme-button');await page.click('[data-theme="'+themes[i]+'"]');await page.waitForTimeout(150);
    await page.locator('#preview-scroll').evaluate(el=>el.scrollTop=0);await page.screenshot({path:dir+`/${i+1}-opening.png`});
    const info=await page.locator('#preview').evaluate(article=>{
      const box=article.getBoundingClientRect(),styles=el=>{const cs=getComputedStyle(el);return {tag:el.tagName,class:el.className,width:el.clientWidth,scroll:el.scrollWidth,overflow:cs.overflowX,whiteSpace:cs.whiteSpace,font:cs.fontFamily,size:cs.fontSize,color:cs.color};};
      return {text:article.innerText,html:article.outerHTML,css:document.getElementById('article-style').textContent,width:article.clientWidth,scroll:article.scrollWidth,mathErrors:article.querySelectorAll('.math-error').length,leakedContainers:/:::(?:digest|press|gewu|abstract|equation)/.test(article.innerText),horizontal:[...article.querySelectorAll('pre,table,.math-display,.edition-block')].map(styles).filter(e=>e.scroll>e.width+2),code:[...article.querySelectorAll('pre')].map(p=>({text:p.innerText,...styles(p)})),sup:article.querySelector('sup')?.outerHTML};
    });
    articles.push({file:files[i],theme:themes[i],characters:source.length,...info});assert.equal(info.mathErrors,0);assert.equal(info.leakedContainers,false);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown),source);
    if(i===3){await page.locator('#preview pre').last().scrollIntoViewIfNeeded();await page.screenshot({path:dir+'/4-code.png'});await page.locator('.format-toolbar [data-format="link"]').click();await page.click('[data-link-mode="end"]');await page.click('#quick-close');await page.locator('#preview sup').first().scrollIntoViewIfNeeded();await page.screenshot({path:dir+'/4-references.png'});articles.at(-1).endReferences=await page.locator('#preview').evaluate(el=>({nestedSup:el.querySelectorAll('sup sup').length,text:el.querySelector('sup')?.textContent,html:[...el.querySelectorAll('p')].find(p=>p.querySelector('sup'))?.innerHTML}));}
    await page.locator('#preview .edition-block, #preview .journal-block').last().scrollIntoViewIfNeeded().catch(()=>{});await page.screenshot({path:dir+`/${i+1}-detail.png`});
    console.log(files[i],JSON.stringify({characters:source.length,overflow:info.scroll-info.width,horizontal:info.horizontal.map(x=>x.tag+':'+x.class),nestedSup:articles.at(-1).endReferences?.nestedSup}));
  }
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  const board=await context.newPage();await board.setViewportSize({width:1420,height:1000});await board.setContent('<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#e6edf4;padding:20px;font:14px sans-serif}.grid{display:grid;grid-template-columns:repeat(3,430px);gap:22px}.cell{background:white;overflow:hidden}.label{padding:12px;background:#fff;border-bottom:1px solid #ccd6e0}.window{height:940px;overflow:hidden}.article{margin:0!important;box-shadow:none!important}</style><div class="grid">'+articles.map((a,i)=>'<div class="cell"><div class="label">'+a.file+'</div><style>'+a.css.replaceAll('.article','.specimen-'+i)+'</style><div class="window">'+a.html.replace('class="article"','class="article specimen-'+i+'"')+'</div></div>').join('')+'</div>');await board.locator('.preview-code-tools').evaluateAll(nodes=>nodes.forEach(n=>n.remove()));await board.screenshot({path:dir+'/overview.png',fullPage:true});await board.close();
}finally{await writeFile(dir+'/report.json',JSON.stringify({channel,phase,articles,errors,network},null,2));await browser.close();}
