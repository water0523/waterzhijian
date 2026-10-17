import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const channel=process.env.RESELECT_BROWSER||'chrome',checks=[],errors=[],network=[],dir=`test-results/reselect-${channel}`;
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel,headless:true}),context=await browser.newContext({offline:true,viewport:{width:1600,height:1000}});
await context.addInitScript(()=>{localStorage.setItem('paper-library-open','false');localStorage.setItem('paper-theme-sidebar-open','false');});
const page=await context.newPage();page.setDefaultTimeout(7000);
page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url());});
const source=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown),settle=()=>page.waitForTimeout(240);
const set=async text=>{await page.keyboard.press('Escape');await page.locator('.cm-content').focus();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await settle();};
const select=async text=>{
  const doc=await source(),from=doc.indexOf(text);assert.ok(from>=0,`missing source selection: ${text}`);
  // Always move away first: this is a fresh user selection, not the selection retained after a menu action.
  await page.keyboard.press('Escape');await page.locator('.cm-content').focus();await page.keyboard.press('Control+End');await page.keyboard.press('Control+Home');
  for(let i=0;i<from;i++)await page.keyboard.press('ArrowRight');
  await page.keyboard.down('Shift');for(let i=0;i<text.length;i++)await page.keyboard.press('ArrowRight');await page.keyboard.up('Shift');
  assert.equal(await page.evaluate(()=>getSelection().toString()),text);
};
const id=kind=>kind==='font'?'inline-style-button':`inline-${kind}-button`;
const choose=async(kind,value,{checked}={})=>{
  await page.click('#'+id(kind));await page.waitForSelector('#quick-popover');
  if(checked!==undefined){
    const row=page.locator(`#quick-popover [data-inline-choice="${checked}"]`);
    if(await row.count())assert.equal(await row.getAttribute('aria-checked'),'true',`${kind} must recognize the existing style`);
    else assert.equal(await page.locator('#quick-popover input[type=color]').inputValue(),checked);
  }
  const choice=page.locator(`#quick-popover [data-inline-choice="${value}"]`);
  if(await choice.count())await choice.click();
  else await page.locator('#quick-popover input[type=color]').evaluate((input,color)=>{input.value=color;input.dispatchEvent(new Event('change',{bubbles:true}));},value);
  await settle();
};
const action=async type=>{await page.locator(`.format-toolbar [data-format="${type}"]`).click();await settle();};
const style=async text=>page.locator('#preview').evaluate((root,text)=>{
  const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while(node=walk.nextNode())if(node.textContent.includes(text)){
    const s=getComputedStyle(node.parentElement),ancestors=[];
    for(let el=node.parentElement;el&&el!==root;el=el.parentElement){const css=getComputedStyle(el);if(css.backgroundColor!=='rgba(0, 0, 0, 0)'||css.backgroundImage!=='none'||css.textDecorationLine!=='none')ancestors.push({background:css.backgroundColor,image:css.backgroundImage,line:css.textDecorationLine});}
    const unique=key=>[...new Set(ancestors.map(a=>a[key]))].filter(v=>v!=='none'&&v!=='rgba(0, 0, 0, 0)').sort();
    const painted=[...unique('background').map(background=>({background,image:'none',line:'none'})),...unique('image').map(image=>({background:'rgba(0, 0, 0, 0)',image,line:'none'})),...unique('line').map(line=>({background:'rgba(0, 0, 0, 0)',image:'none',line}))];
    return{font:s.fontFamily,size:s.fontSize,color:s.color,weight:s.fontWeight,italic:s.fontStyle,dots:s.textEmphasisStyle,ancestors:painted};
  }
  throw Error('missing rendered text: '+text);
},text);
const plain='# 重选格式\n\n前缀 核心文字 后缀\n\n另一段保持原样。';
const record=name=>{checks.push(name);console.log(`${channel}: ${name}`);};
try{
  await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
  await page.click('#theme-button');await page.click('[data-theme="plain"]');await set(plain);const baseline=await style('核心文字'),other=await style('另一段');

  for(const [kind,first,next,pattern] of [['font','kai','song',/font=kai/],['size','20','24',/size=20/],['color','#2563eb','#dc2626',/color=#2563eb/],['highlight','#fff29b','#bbf7d0',/highlight=#fff29b/],['marker','#bbf7d0','#a371d8',/marker=#bbf7d0/],['role','term','date',/role=term/]]){
    await set(plain);await select('前缀 核心文字 后缀');await choose(kind,first);
    const outside=await style('前缀');await select('核心文字');await choose(kind,next,{checked:first});
    assert.deepEqual(await style('前缀'),outside);assert.deepEqual(await style('后缀'),outside);assert.deepEqual(await style('另一段'),other);
    // Changing the selected part must remove the old value from its ancestors.
    const changed=await style('核心文字');if(kind==='font')assert.match(changed.font,/SimSun/);if(kind==='size')assert.equal(changed.size,'24px');if(kind==='color')assert.equal(changed.color,'rgb(220, 38, 38)');
    if(kind==='highlight')assert.ok(changed.ancestors.every(s=>s.background!=='rgb(255, 242, 155)'));if(kind==='marker')assert.ok(changed.ancestors.every(s=>!s.image.includes('187, 247, 208')));
    await select('核心文字');await choose(kind,'',{checked:next});assert.deepEqual(await style('核心文字'),baseline);assert.deepEqual(await style('前缀'),outside);assert.deepEqual(await style('后缀'),outside);
    await select((await source()).split('\n\n')[1]);await choose(kind,'');assert.equal(await source(),plain);assert.doesNotMatch(await source(),pattern);
  }
  record('fresh partial reselection recognizes, replaces and removes all six property formats while preserving surrounding text');

  const combined='# 组合格式\n\n[前缀 核心文字 后缀]{font=kai size=20 color=#2563eb highlight=#fff29b marker=#bbf7d0 bold italic underline strike dots role=term}\n\n另一段保持原样。';
  await set(combined);const edges=await style('前缀');await select('核心文字');await choose('font','song',{checked:'kai'});const beforeReset=await source();
  await select('核心文字');await choose('font','',{checked:'song'});const afterReset=await style('核心文字');assert.match(afterReset.font,/JetBrains Mono/);assert.equal(afterReset.size,'20px');assert.equal(afterReset.weight,'700');assert.equal(afterReset.color,'rgb(37, 99, 235)');
  await page.click('#undo-button');await settle();assert.equal(await source(),beforeReset);await page.click('#redo-button');await settle();
  await select('核心文字');await choose('effect','clear');assert.deepEqual(await style('核心文字'),baseline);assert.deepEqual(await style('前缀'),edges);assert.deepEqual(await style('后缀'),edges);assert.deepEqual(await style('另一段'),other);
  record('single-property reset preserves other properties; complete clear and one-step undo/redo work after reselection');

  for(const type of ['bold','italic','underline','wave','strike']){
    const markup=type==='bold'?'**':type==='italic'?'*':type==='strike'?'~~':null;
    const doc='# 修饰重选\n\n'+(markup?`${markup}前缀 核心文字 后缀${markup}`:`[前缀 核心文字 后缀]{${type}}`);
    await set(doc);const edge=await style('前缀');await select('核心文字');await action(type);assert.deepEqual(await style('核心文字'),baseline);assert.deepEqual(await style('前缀'),edge);assert.deepEqual(await style('后缀'),edge);
    await select('核心文字');await action(type);assert.deepEqual(await style('核心文字'),edge);await select('核心文字');await choose('effect','clear');assert.deepEqual(await style('核心文字'),baseline);
  }
  for(const type of ['dots','gold']){
    await set(`# 修饰重选\n\n[前缀 核心文字 后缀]{${type}}`);const edge=await style('前缀');await select('核心文字');await choose('effect',type,{checked:type});assert.deepEqual(await style('核心文字'),baseline);assert.deepEqual(await style('前缀'),edge);
  }
  record('native Markdown and custom bold, italic, underline, wave, strike, dots and gold can be removed from partial selections');

  for(const selected of ['核心文字','[核心文字]{font=song marker=#a371d8 bold}']){
    await set('# 历史嵌套\n\n[前缀 [核心文字]{font=song marker=#a371d8 bold} 后缀]{font=kai highlight=#fff29b marker=#bbf7d0 bold}');
    const edge=await style('前缀');await select(selected);await choose('marker','',{checked:'#a371d8'});assert.ok((await style('核心文字')).ancestors.every(s=>s.image==='none'));
    await select('核心文字');await choose('effect','clear');assert.deepEqual(await style('核心文字'),baseline);assert.deepEqual(await style('前缀'),edge);assert.deepEqual(await style('后缀'),edge);
  }
  await set('# 跨相邻格式\n\n[甲段]{font=kai highlight=#fff29b} 与 [乙段]{font=song highlight=#bbf7d0}');await select((await source()).split('\n\n')[1]);await choose('highlight','');assert.doesNotMatch(await source(),/highlight=/);assert.match(await source(),/font=kai/);assert.match(await source(),/font=song/);
  record('legacy nested wrappers, selections including markers and mixed adjacent styles clear old ancestors correctly');

  await set('# 旧版默认笔触\n\n[前缀 [核心文字]{marker} 后缀]{marker=#bbf7d0}');await select('核心文字');await choose('marker','',{checked:'#f5d878'});assert.ok((await style('核心文字')).ancestors.every(s=>s.image==='none'));
  await set('# 原生与自定义混合\n\n[**前缀核心文字后缀**]{font=kai color=#2563eb}');const nativeEdge=await style('前缀核心文字后缀');await select('核心文字');await choose('effect','clear');assert.deepEqual(await style('核心文字'),baseline);assert.deepEqual(await style('前缀'),nativeEdge);assert.deepEqual(await style('后缀'),nativeEdge);assert.equal(await page.locator('#preview').innerText().then(s=>s.includes('前缀核心文字后缀')),true);
  await set('# 表格重选\n\n| 项目 | 次列 |\n| --- | --- |\n| [前缀 核心文字 后缀]{font=kai highlight=#fff29b} | 另一项 |');await select('核心文字');await choose('highlight','',{checked:'#fff29b'});assert.ok((await style('核心文字')).ancestors.every(s=>s.background!=='rgb(255, 242, 155)'));assert.match((await style('前缀')).font,/KaiTi/);assert.equal(await page.locator('#preview td').count(),2);
  record('legacy default half-highlight, native/custom combinations and individual table cells keep accurate replacement and removal');

  await set('# 保留结构\n\n[前缀 核心文字 `代码` $x^2$ [链接](https://example.com) \\[转义\\] 后缀]{font=kai highlight=#fff29b}');await select('核心文字');await choose('effect','clear');const doc=await source();assert.ok(doc.includes('`代码`'));assert.ok(doc.includes('$x^2$'));assert.ok(doc.includes('\\[')&&doc.includes('\\]'));assert.equal(await page.locator('#preview a').getAttribute('href'),'https://example.com');assert.equal(await page.locator('#preview a').innerText(),'链接');assert.equal(await page.locator('#preview code').innerText(),'代码');assert.equal(await page.locator('#preview .math-error').count(),0);assert.deepEqual(await style('核心文字'),baseline);
  await select('代码');await page.click('#inline-style-button');assert.equal(await page.locator('#quick-popover').count(),0);assert.equal(await source(),doc);
  await page.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');await page.reload();await page.waitForSelector('.cm-content');assert.equal(await source(),doc);await select('后缀');await choose('font','',{checked:'kai'});assert.equal((await style('后缀')).font,baseline.font);
  await page.screenshot({path:`${dir}/day.png`});await page.click('#night-button');await settle();await page.screenshot({path:`${dir}/night.png`});
  record('links, escaped text, code and formulas remain intact; saved formatting stays editable after reopening');
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
}catch(error){await page.screenshot({path:`${dir}/failure.png`});throw error;}
finally{await writeFile(`${dir}/report.json`,JSON.stringify({channel,checks,errors,network},null,2));await browser.close();}
