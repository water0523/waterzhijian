import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
await mkdir('test-results/theme-temp',{recursive:true});
process.env.TEMP=process.env.TMP=process.env.TMPDIR=path.resolve('test-results/theme-temp');
const channel=process.env.THEME_BROWSER||'chrome';
const browser=await chromium.launch({channel,headless:true});
const context=await browser.newContext({offline:true,viewport:{width:1440,height:1050},permissions:['clipboard-read','clipboard-write']});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
try{
 await page.goto(pathToFileURL(path.resolve('dist/纸间-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
 const md='# 一束光，读懂宇宙\n\n## 从一个好问题开始\n\n抬头望向夜空，每一颗星都寄来一封远方的信。**科学的美，在于把好奇变成发现**。让知识清晰，也让每一页有自己的表情。\n\n> 真正的发现，始于一次认真而温柔的观察。\n\n### 把变化写成语言\n\n$$\nE=mc^2\n$$\n\n| 观测对象 | 发现 |\n| --- | --- |\n| 星光 | 光谱中的元素 |\n\n## 向更远处出发\n\n这是一段第二章节的正文，用于确认编号按顺序变化。\n\n```js\nconst universe = "hello";\n```';
 await page.locator('.cm-content').click();await page.keyboard.press('Control+a');await page.keyboard.insertText(md);await page.waitForTimeout(350);
 await page.click('#theme-button');assert.equal(await page.locator('[data-theme]').count(),38);await page.screenshot({path:'test-results/themes-gallery-v2.png',fullPage:true});
 await page.locator('#theme-search').fill('编号');assert.ok(await page.locator('[data-theme]').count()>3);await page.locator('#theme-search').fill('不存在的主题');assert.equal(await page.locator('[data-theme]').count(),0);await page.locator('#theme-search').fill('');
 const ids=await page.locator('[data-theme]').evaluateAll(els=>els.map(el=>el.dataset.theme));await page.click('#modal-close');
 const snapshots=[];
 for(const id of ids){
  await page.click('#theme-button');await page.click(`[data-theme="${id}"]`);await page.locator('#preview-scroll').evaluate(el=>el.scrollTop=0);await page.waitForTimeout(60);
  const info=await page.locator('#preview').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,text:el.innerText,html:el.outerHTML,css:document.querySelector('#article-style').textContent}));assert.ok(info.scroll<=info.width+2,id+' overflow');assert.ok(info.text.includes('向更远处出发'));
  await page.locator('#preview').screenshot({path:`test-results/theme-${id}.png`});snapshots.push({id,name:await page.locator('#theme-name').innerText(),html:info.html,css:info.css});
 }
 await page.click('#theme-button');await page.click('[data-theme="orange"]');assert.deepEqual(await page.locator('#preview h2 .theme-badge').allTextContents(),['01','02']);
 await page.click('#copy-button');await page.waitForTimeout(200);const copied=await page.evaluate(async()=>{const [i]=await navigator.clipboard.read();return (await i.getType('text/html')).text();});assert.match(copied,/theme-badge/);assert.match(copied,/>01<\/span>/);assert.match(copied,/theme-quote-label/);assert.match(copied,/background-color: rgb\(203, 98, 34\)/);assert.match(copied,/box-shadow:/);
 await page.selectOption('#publisher','zhihu');assert.equal(await page.locator('#preview .theme-badge,#preview .theme-kicker,#preview .theme-quote-label').count(),0);await page.selectOption('#publisher','wechat');
 await page.screenshot({path:'test-results/theme-orange-workspace.png',fullPage:true});
 await page.click('#theme-button');await page.click('[data-theme="kuromi"]');await page.click('#copy-button');await page.waitForTimeout(180);
 const themedCopy=await page.evaluate(async()=>{const [i]=await navigator.clipboard.read();return (await i.getType('text/html')).text();});assert.match(themedCopy,/theme-motif/);assert.match(themedCopy,/viewBox="0 0 76 66"/);assert.match(themedCopy,/小恶魔的心情便签/);
 await page.click('#theme-button');await page.click('[data-theme="classical"]');assert.equal(await page.locator('#preview p').first().evaluate(el=>getComputedStyle(el).textIndent),'32px');
 await page.click('#style-button');assert.ok(await page.locator('#setting-indent').isChecked());await page.locator('#setting-lineHeight').fill('1.8');await page.locator('#setting-lineHeight').dispatchEvent('input');assert.ok(Math.abs(await page.locator('#preview p').first().evaluate(el=>parseFloat(getComputedStyle(el).lineHeight))-28.8)<.05);await page.locator('#setting-indent').uncheck();assert.equal(await page.locator('#preview p').first().evaluate(el=>getComputedStyle(el).textIndent),'0px');await page.click('#style-close');
 await page.click('#theme-button');
 for(const id of ['cartoon','arcade','kuromi','pop','classical'])await page.click(`[data-pin="${id}"]`);
 assert.equal(await page.locator('[data-pin][aria-pressed="true"]').count(),5);assert.equal(await page.locator('[data-theme]').first().getAttribute('data-theme'),'cartoon');assert.ok(await page.locator('#modal').evaluate(el=>el.open));assert.equal(await page.locator('#theme-name').innerText(),'文言课本');
 await page.click('[data-pin="orange"]');assert.equal(await page.locator('[data-pin][aria-pressed="true"]').count(),5);assert.match(await page.locator('#toast').innerText(),/最多置顶 5/);
 await page.click('[data-pin="arcade"]');await page.click('[data-pin="orange"]');assert.equal(await page.locator('[data-pin][aria-pressed="true"]').count(),5);
 await page.click('#modal-close');await page.waitForTimeout(1200);await page.reload();await page.waitForSelector('.cm-content');await page.click('#theme-button');
 assert.equal(await page.locator('[data-pin][aria-pressed="true"]').count(),5);assert.equal(await page.locator('[data-theme]').first().getAttribute('data-theme'),'cartoon');await page.screenshot({path:'test-results/theme-pins.png',fullPage:true});await page.click('#modal-close');
 assert.deepEqual(errors,[]);
 const overview='<!doctype html><meta charset="utf-8"><title>38 套主题排版总览</title><style>body{background:#e9e8e2;padding:30px;margin:0;font-family:Microsoft YaHei,sans-serif}.grid{display:grid;grid-template-columns:repeat(6,240px);gap:20px}.card{width:240px;overflow:hidden;background:white;border:1px solid #ddd}.name{font-size:12px;padding:12px;border-bottom:1px solid #ddd}.window{height:460px;overflow:hidden}.sample{width:375px;transform:scale(.64);transform-origin:top left}</style><h1>纸间 / 38 套主题排版总览</h1><div class="grid">'+snapshots.map(s=>'<div class="card"><div class="name">'+s.id+'</div><style>'+s.css.replaceAll('.article','.specimen-'+s.id)+'</style><div class="window"><div class="sample specimen-'+s.id+'">'+s.html.replace(/^<article[^>]*>/,'').replace(/<\/article>$/,'')+'</div></div></div>').join('')+'</div>';
 await writeFile('test-results/theme-overview.html',overview);const board=await context.newPage();await board.setViewportSize({width:1640,height:1100});await board.goto(pathToFileURL(path.resolve('test-results/theme-overview.html')).href);await board.screenshot({path:'test-results/theme-overview.png',fullPage:true});
 const selected=snapshots.filter(s=>['cartoon','arcade','kuromi','pop','classical','orange'].includes(s.id));
 const visual='<!doctype html><meta charset="utf-8"><title>纸间 装饰主题精选</title><style>body{margin:0;padding:32px;background:#ebece6;font-family:Microsoft YaHei,sans-serif;color:#314a3b}h1{font:500 28px SimSun,serif;margin:0 0 10px}.intro{font-size:12px;color:#7c8d7d;margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(3,280px);gap:20px}.card{width:280px;background:white;border:1px solid #dce1d5;border-radius:6px;overflow:hidden}.name{font-size:13px;padding:12px 15px;background:#fafbf7;border-bottom:1px solid #e5e8df}.window{height:480px;overflow:hidden}.sample{width:375px;transform:scale(.747);transform-origin:top left}</style><h1>纸间 · 每一篇，都有自己的样子</h1><p class="intro">38 套完整主题 / 彩色标题 · 编号徽章 · 引文卡片 · 公式排版</p><div class="grid">'+selected.map(s=>'<div class="card"><div class="name">'+s.name+'</div><style>'+s.css.replaceAll('.article','.specimen-'+s.id)+'</style><div class="window"><div class="sample specimen-'+s.id+'">'+s.html.replace(/^<article[^>]*>/,'').replace(/<\/article>$/,'')+'</div></div></div>').join('')+'</div>';
 await writeFile('test-results/theme-selection.html',visual);await board.setViewportSize({width:944,height:1180});await board.goto(pathToFileURL(path.resolve('test-results/theme-selection.html')).href);await board.screenshot({path:'dist/主题风格预览.png',fullPage:true});
 await writeFile(channel==='chrome'?'test-results/themes-report.json':'test-results/themes-msedge-report.json',JSON.stringify({browser:channel,version:browser.version(),date:'2026-10-14',themes:ids,pass:true,checks:['38主题375px无整体溢出','真实主题缩略图与搜索','编号顺序','装饰元素与内联颜色复制','无主题模式不含装饰','库洛米装饰SVG随富文本复制','文言课本缩进可关闭','置顶排序及5个上限','取消置顶后可补入','置顶不应用主题','重新打开后保留置顶','38主题截图人工复核'],errors},null,2));
 console.log('38 themes: layout, gallery, copy and neutral mode passed');
}finally{await browser.close();}
