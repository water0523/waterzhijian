import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const channel=process.env.PREVIEW_STYLE_BROWSER||'chrome',checks=[],errors=[],network=[],dir=`test-results/preview-format-${channel}`;
await mkdir(dir,{recursive:true});const browser=await chromium.launch({channel,headless:true}),context=await browser.newContext({offline:true,viewport:{width:1600,height:1000},permissions:['clipboard-read','clipboard-write']});
await context.addInitScript(()=>{localStorage.setItem('paper-library-open','false');localStorage.setItem('paper-theme-sidebar-open','false');});
const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
const source=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown),settle=()=>page.waitForTimeout(260),record=name=>{checks.push(name);console.log(channel+': '+name);};
const set=async text=>{await page.keyboard.press('Escape');await page.locator('.cm-content').focus();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await settle();};
const select=async(text,occurrence=0,endText)=>{
  await page.keyboard.press('Escape');
  await page.locator('#preview').evaluate((root,{text,occurrence,endText})=>{
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let node,total='';
    while(node=walker.nextNode()){nodes.push({node,from:total.length,to:total.length+node.length});total+=node.data;}
    let from=-1;for(let i=0;i<=occurrence;i++)from=total.indexOf(text,from+1);if(from<0)throw Error('missing preview selection '+text);
    const to=endText?total.indexOf(endText,from)+endText.length:from+text.length;if(to<=from)throw Error('bad selection end');
    const a=nodes.find(n=>n.from<=from&&n.to>from),b=nodes.find(n=>n.from<to&&n.to>=to),range=document.createRange();range.setStart(a.node,from-a.from);range.setEnd(b.node,to-b.from);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
  },{text,occurrence,endText});
  await page.waitForSelector('#selection-tools[data-origin="preview"]:visible');
};
const choose=async(kind,value,checked)=>{
  await page.click('#selection-'+(kind==='font'?'style':kind)+'-button');await page.waitForSelector('#quick-popover');
  if(checked!==undefined)assert.equal(await page.locator(`#quick-popover [data-inline-choice="${checked}"]`).getAttribute('aria-checked'),'true');
  await page.locator(`#quick-popover [data-inline-choice="${value}"]`).click();await settle();
  assert.equal(await page.locator('#selection-tools').getAttribute('data-origin'),'preview');
};
const action=async type=>{await page.locator(`#selection-tools [data-format="${type}"]`).click();await settle();assert.equal(await page.locator('#selection-tools').getAttribute('data-origin'),'preview');};
const selected=()=>page.evaluate(()=>getSelection()?.toString());
const css=async(text,occurrence=0)=>page.locator('#preview').evaluate((root,{text,occurrence})=>{
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node,count=0;
  while(node=walker.nextNode())if(node.data.includes(text)&&count++===occurrence){const style=getComputedStyle(node.parentElement),backgrounds=[],images=[],lines=[];for(let el=node.parentElement;el&&el!==root;el=el.parentElement){const s=getComputedStyle(el);if(s.backgroundColor!=='rgba(0, 0, 0, 0)')backgrounds.push(s.backgroundColor);if(s.backgroundImage!=='none')images.push(s.backgroundImage);if(s.textDecorationLine!=='none')lines.push(s.textDecorationLine);}return{font:style.fontFamily,size:style.fontSize,color:style.color,weight:style.fontWeight,italic:style.fontStyle,backgrounds,images,lines};}
  throw Error('missing rendered text '+text);
},{text,occurrence});
try{
  await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');await page.click('#theme-button');await page.click('[data-theme="plain"]');
  const original='# 预览选择\n\n前缀 核心文字 后缀\n\n相同核心文字保持原样。';await set(original);const baseline=await css('核心文字'),other=await css('相同核心文字');
  // Exercise a real drag in normal preview, without entering text-edit mode.
  const rect=await page.locator('#preview [data-edit-from]').filter({hasText:'前缀 核心文字 后缀'}).evaluate(el=>{const node=el.firstChild,range=document.createRange();range.setStart(node,3);range.setEnd(node,7);const r=range.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};});
  await page.mouse.move(rect.x+1,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width-1,rect.y+rect.height/2,{steps:12});await page.mouse.up();await page.waitForSelector('#selection-tools[data-origin="preview"]:visible');assert.equal(await selected(),'核心文字');assert.equal(await page.locator('#preview [contenteditable]').count(),0);
  await choose('font','kai');assert.match((await css('核心文字')).font,/KaiTi/);assert.equal(await selected(),'核心文字');await choose('size','20');await choose('color','#2563eb');await choose('highlight','#fff29b');await choose('marker','#bbf7d0');await action('bold');await action('italic');await action('underline');await action('strike');
  const styled=await source();assert.match(styled,/font=kai size=20 color=#2563eb highlight=#fff29b bold italic underline strike marker=#bbf7d0/);assert.deepEqual(await css('相同核心文字'),other);assert.equal((await css('前缀')).font,baseline.font);assert.equal((await css('后缀')).font,baseline.font);assert.equal(await selected(),'核心文字');
  await select('核心文字');await choose('highlight','#bfdbfe','#fff29b');assert.deepEqual((await css('核心文字')).backgrounds,['rgb(191, 219, 254)']);await choose('marker','','#bbf7d0');assert.deepEqual((await css('核心文字')).images,[]);await choose('effect','clear');assert.equal(await source(),original);assert.deepEqual(await css('核心文字'),baseline);
  record('real preview drag, all common formats, preserved visible selection, replacement and clear work without text-edit mode');
  await page.locator('#preview p').first().click();await settle();assert.equal(await page.locator('#selection-tools').isVisible(),false);await page.click('#inline-style-button');assert.equal(await page.locator('#quick-popover').count(),0);assert.equal(await source(),original);

  await set('# 重复文字\n\n第一处核心文字。\n\n第二处核心文字。');await select('核心文字',1);await choose('font','kai');assert.equal((await css('核心文字',0)).font,baseline.font);assert.match((await css('核心文字',1)).font,/KaiTi/);assert.equal((await source()).match(/font=kai/g).length,1);
  const saved=await source();await page.click('#undo-button');await settle();assert.doesNotMatch(await source(),/font=kai/);await page.click('#redo-button');await settle();assert.equal(await source(),saved);
  await select('核心文字',1);await choose('font','','kai');await select('第一处',0,'第二处核心文字。');await choose('highlight','#bbf7d0');assert.deepEqual((await css('第一处')).backgrounds,['rgb(187, 247, 208)']);assert.deepEqual((await css('第二处')).backgrounds,['rgb(187, 247, 208)']);await choose('effect','clear');assert.doesNotMatch(await source(),/highlight=/);
  record('repeated words target the correct occurrence; cross-paragraph formatting, undo and redo retain the selected-only rule');

  await set('# 格式区域\n\n正文文字。\n\n## 章节标题');await select('正文文字',0,'章节标题');const incompatible=await source();await page.click('#selection-style-button');assert.equal(await page.locator('#quick-popover').count(),0);assert.equal(await source(),incompatible);assert.match(await page.locator('#toast').innerText(),/不同格式/);
  await set('# 精确映射\n\n[前缀 **嵌套核心** 与 [链接文字](https://example.com) 后缀]{font=kai highlight=#fff29b}\n\n转义 \\* 与 &amp; 保留。\n\n| 项目 | 项目 |\n| --- | --- |\n| [单元格核心]{font=kai highlight=#fff29b} | 单元格核心 |');
  await select('嵌套核心');await choose('effect','clear');assert.equal((await css('嵌套核心')).font,baseline.font);assert.notEqual((await css('嵌套核心')).weight,'700');await select('链接文字');await choose('highlight','','#fff29b');assert.equal(await page.locator('#preview a').getAttribute('href'),'https://example.com');
  await select('*');await choose('color','#dc2626');assert.ok((await source()).includes('\\*'));await select('&');await choose('highlight','#bfdbfe');assert.ok((await source()).includes('&amp;'));assert.ok((await page.locator('#preview').innerText()).includes('转义 * 与 & 保留。'));
  await select('单元格核心');await choose('font','','kai');assert.equal((await css('单元格核心')).font,baseline.font);assert.match(await source(),/\| 单元格核心 \|/);assert.equal(await page.locator('#preview td').count(),2);
  record('incompatible blocks are rejected; nested emphasis, links, escaped symbols, entities and repeated table cells map exactly');

  await set('# 可编辑预览\n\n修改前 核心文字 后缀');await page.click('#preview-edit-button');await page.locator('#preview [contenteditable]').filter({hasText:'修改前 核心文字 后缀'}).fill('修改后 核心文字 后缀');await select('核心文字');await choose('marker','#bfdbfe');assert.ok((await source()).includes('修改后 [核心文字]{marker=#bfdbfe} 后缀'));await page.click('#preview-edit-button');
  await page.click('#header-preview-button');await select('核心文字');const beforeFont=await source();await choose('font','song');assert.match((await css('核心文字')).font,/SimSun/);const afterFont=await source();await page.keyboard.press('Control+z');await settle();assert.equal(await source(),beforeFont);assert.equal(await selected(),'核心文字');await page.keyboard.press('Control+Shift+z');await settle();assert.equal(await source(),afterFont);assert.equal(await selected(),'核心文字');await page.screenshot({path:`${dir}/preview-only.png`});await page.click('#header-preview-button');
  await page.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');const final=await source();await page.reload();await page.waitForSelector('.cm-content');assert.equal(await source(),final);await select('核心文字');await choose('marker','','#bfdbfe');assert.equal((await css('核心文字')).images.length,0);
  await page.click('#copy-button');await page.waitForFunction(()=>document.getElementById('copy-button').dataset.state==='success');const copied=await page.evaluate(async()=>{const [item]=await navigator.clipboard.read();return(await item.getType('text/html')).text();});assert.match(copied,/font-family: SimSun/);assert.doesNotMatch(copied,/preview-text-run|data-edit-|data-origin|selection-tools|contenteditable/);
  await select('核心文字');await page.screenshot({path:`${dir}/day.png`});await page.click('#night-button');await settle();await select('核心文字');await choose('highlight','#bbf7d0');await page.screenshot({path:`${dir}/night.png`});
  record('text-edit mode, preview-only layout, saving, reopening, clean clipboard output and day/night controls work together');
  for(const theme of ['digest','press','journal-indigo','journal-jade','gewu']){
    await page.click('#theme-button');await page.click(`[data-theme="${theme}"]`);
    const wrapper=theme==='gewu'?':::gewu-preface\n':theme.startsWith('journal-')?':::abstract\n':'';
    await set('# 首字与主题\n\n'+wrapper+'开篇文字带着首字效果，后面保持原样。'+(wrapper?'\n:::':''));
    const initial=page.locator('#preview .text-initial,#preview .journal-initial');assert.equal(await initial.count(),1);
    await select('开篇文字');await choose('color','#2563eb');assert.equal((await source()).match(/color=#2563eb/g).length,1);assert.equal(await selected(),'开篇文字');assert.equal(await initial.evaluate(el=>getComputedStyle(el).color),'rgb(37, 99, 235)');assert.ok((await page.locator('#preview').textContent()).includes('开篇文字带着首字效果，后面保持原样。'));await choose('font','kai');assert.match(await initial.evaluate(el=>getComputedStyle(el).fontFamily),/KaiTi/);
    await choose('size','20');assert.equal(await initial.count(),0);assert.equal((await css('开篇文字')).size,'20px');await choose('effect','clear');assert.equal(await initial.count(),1);assert.doesNotMatch(await source(),/color=|font=kai|size=20/);
  }
  record('five drop-cap themes map and retain visible selections without losing initials or adding formatting to adjacent text');
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
}catch(error){await page.screenshot({path:`${dir}/failure.png`});throw error;}
finally{await writeFile(`${dir}/report.json`,JSON.stringify({channel,checks,errors,network},null,2));await browser.close();}
