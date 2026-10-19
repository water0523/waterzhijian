import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const channel=process.env.TEST_BROWSER||'chrome',dir=`test-results/format-painter-${channel}`,checks=[],errors=[],network=[];
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel,headless:true}),context=await browser.newContext({offline:true,viewport:{width:1600,height:1000}});
await context.addInitScript(()=>{localStorage.setItem('paper-library-open','false');localStorage.setItem('paper-theme-sidebar-open','false');});
const page=await context.newPage();page.setDefaultTimeout(8000);
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
const source=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown),settle=()=>page.waitForTimeout(260),brush=page.locator('#format-painter-button');
const record=name=>{checks.push(name);console.log('PASS '+name);};
const set=async text=>{await page.keyboard.press('Escape');await page.locator('.cm-content').focus();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await settle();};
const cmSelect=async text=>{
  const from=(await source()).indexOf(text);assert.ok(from>=0);
  await page.locator('.cm-content').focus();await page.keyboard.press('Control+Home');
  for(let i=0;i<from;i++)await page.keyboard.press('ArrowRight');
  await page.keyboard.down('Shift');for(let i=0;i<text.length;i++)await page.keyboard.press('ArrowRight');await page.keyboard.up('Shift');await settle();
};
const previewSelect=async text=>{
  await page.locator('#preview').evaluate((root,text)=>{
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
    while(node=walker.nextNode()){const from=node.data.indexOf(text);if(from<0)continue;const r=document.createRange();r.setStart(node,from);r.setEnd(node,from+text.length);getSelection().removeAllRanges();getSelection().addRange(r);return;}
    throw Error('Missing preview text '+text);
  },text);await page.waitForSelector('#selection-tools[data-origin="preview"]:visible');
};
const previewDrag=async text=>{
  const coords=await page.locator('#preview').evaluate((root,text)=>{
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
    while(node=walker.nextNode()){const from=node.data.indexOf(text);if(from<0)continue;node.parentElement.scrollIntoView({block:'nearest'});const a=document.createRange(),b=document.createRange();a.setStart(node,from);a.setEnd(node,from+1);b.setStart(node,from+text.length-1);b.setEnd(node,from+text.length);const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return {x:x.left+.5,y:x.top+x.height/2,endX:y.right-.5,endY:y.top+y.height/2};}
    throw Error('Missing drag text '+text);
  },text);
  await page.mouse.move(coords.x,coords.y);await page.mouse.down();await page.mouse.move(coords.endX,coords.endY,{steps:8});
  // Nothing is committed while the pointer is still down.
  const before=await source();await settle();assert.equal(await source(),before);await page.mouse.up();await settle();
};
const style=async text=>page.locator('#preview').evaluate((root,text)=>{
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while(node=walker.nextNode())if(node.data.includes(text)){
    const css=getComputedStyle(node.parentElement),effects=[];
    for(let e=node.parentElement;e&&e!==root;e=e.parentElement){const c=getComputedStyle(e);effects.push({background:c.backgroundColor,image:c.backgroundImage,decoration:c.textDecorationLine,border:c.borderBottomStyle});}
    return {font:css.fontFamily,size:css.fontSize,color:css.color,weight:css.fontWeight,italic:css.fontStyle,dots:css.textEmphasisStyle,effects};
  }
  throw Error('Missing style text '+text);
},text);
const fixture='# 格式刷\n\n[样本]{font=kai size=22 color=#2563eb marker=#a371d8 bold italic underline ornament=outline}\n\n[前缀 目标文字 后缀]{font=song size=18 color=#dc2626 highlight=#fff29b strike dots gold role=term}\n\n别处保持原样。';
try{
  await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
  await page.click('#theme-button');await page.click('[data-theme="plain"]');
  assert.equal(await brush.evaluate(b=>b.nextElementSibling?.dataset.format),'bold');assert.equal(await brush.locator('svg').count(),1);
  await brush.click();assert.equal(await brush.getAttribute('aria-pressed'),'false');
  await set(fixture);const originalEdge=await style('前缀');await cmSelect('样本');await brush.click();
  assert.equal(await source(),fixture);assert.equal(await brush.getAttribute('aria-pressed'),'true');assert.ok(await page.locator('#format-painter-status').isVisible());
  await previewDrag('目标文字');const painted=await source();assert.notEqual(painted,fixture);assert.equal(await brush.getAttribute('aria-pressed'),'false');
  assert.ok(painted.includes('[样本]{font=kai size=22 color=#2563eb marker=#a371d8 bold italic underline ornament=outline}'));
  assert.deepEqual(await style('前缀'),originalEdge);assert.deepEqual(await style('后缀'),originalEdge);
  const target=await style('目标文字');assert.match(target.font,/KaiTi/);assert.equal(target.size,'22px');assert.equal(target.color,'rgb(37, 99, 235)');assert.equal(target.weight,'700');assert.equal(target.italic,'italic');
  assert.ok(target.effects.some(e=>e.image.includes('163, 113, 216')));assert.ok(target.effects.every(e=>e.background!=='rgb(255, 242, 155)'&&!e.decoration.includes('line-through')));assert.equal(target.dots,'none');
  assert.equal(await page.evaluate(()=>getSelection().toString()),'目标文字');
  await page.click('#undo-button');await settle();assert.equal(await source(),fixture);await page.click('#redo-button');await settle();assert.equal(await source(),painted);
  record('Markdown sample paints preview mouse selection once, replaces stale properties, protects edges and source, preserves selection and supports one undo/redo');

  const continuous='# 连续刷\n\n[样本]{font=kai size=22 color=#2563eb marker=#a371d8 bold}\n\n前缀 [目标甲]{color=#dc2626 highlight=#fff29b} 后缀\n\n目标乙\n\n目标丙\n\n未刷文字\n\n> 引用文字';
  await set(continuous);await previewSelect('样本');const brushPosition=await brush.boundingBox();await brush.dblclick();
  const lockedPosition=await brush.boundingBox();assert.equal(lockedPosition.x,brushPosition.x);assert.equal(lockedPosition.y,brushPosition.y);
  assert.equal(await page.locator('body').getAttribute('data-format-painter'),'locked');assert.equal(await source(),continuous);assert.match(await page.locator('#format-painter-status').innerText(),/已锁定/);
  const pinned=await style('样本');await previewDrag('目标甲');const firstStroke=await source();assert.deepEqual(await style('目标甲'),pinned);assert.equal(await page.locator('body').getAttribute('data-format-painter'),'locked');
  await cmSelect('目标乙');const secondStroke=await source();assert.notEqual(secondStroke,firstStroke);assert.deepEqual(await style('目标乙'),pinned);assert.equal(await page.locator('body').getAttribute('data-format-painter'),'locked');
  await cmSelect('未刷文字\n\n> 引用文字');assert.equal(await source(),secondStroke);assert.equal(await page.locator('body').getAttribute('data-format-painter'),'locked');
  await previewDrag('目标丙');const thirdStroke=await source();assert.deepEqual(await style('目标丙'),pinned);assert.match(await page.locator('#format-painter-status').innerText(),/已刷 3 处/);assert.ok(thirdStroke.includes('[样本]{font=kai size=22 color=#2563eb marker=#a371d8 bold}'));assert.ok(thirdStroke.includes('未刷文字\n\n> 引用文字'));
  await page.keyboard.press('Control+z');await settle();assert.equal(await source(),secondStroke);assert.equal(await brush.getAttribute('aria-pressed'),'false');
  await page.click('#undo-button');await settle();assert.equal(await source(),firstStroke);await page.click('#redo-button');await settle();assert.equal(await source(),secondStroke);
  record('native double click pins one sample across three preview/Markdown strokes, rejects incompatible targets without unlocking and keeps each stroke independently undoable');

  await previewSelect('样本');await brush.click();assert.equal(await page.locator('body').getAttribute('data-format-painter'),'ready');await brush.dblclick();assert.equal(await page.locator('body').getAttribute('data-format-painter'),'locked');await page.keyboard.press('Escape');assert.equal(await brush.getAttribute('aria-pressed'),'false');
  await previewSelect('样本');await brush.dblclick();await brush.click();assert.equal(await brush.getAttribute('aria-pressed'),'false');
  await previewSelect('样本');await brush.dblclick();await page.click('#format-painter-status button');assert.equal(await brush.getAttribute('aria-pressed'),'false');
  await previewSelect('样本');await brush.dblclick();await page.locator('.cm-content').focus();await page.keyboard.insertText('手动修改');await settle();assert.equal(await brush.getAttribute('aria-pressed'),'false');
  record('double click upgrades an armed brush; Escape, single click, cancel button and unrelated editing exit locked mode');

  await set('# 双向取样\n\n**样本**\n\n目标甲。\n\n目标乙。');await previewSelect('样本');await brush.click();await cmSelect('目标甲。\n\n目标乙。');
  const cross=await source();assert.match(cross,/\[目标甲。\]\{bold\}\n\n\[目标乙。\]\{bold\}/);assert.ok(cross.includes('**样本**'));assert.equal(await brush.getAttribute('aria-pressed'),'false');
  record('preview sample paints keyboard selection across ordinary paragraphs and keeps Markdown heading structure');

  await set('# 清除局部样式\n\n普通样本\n\n[前缀 目标文字 后缀]{font=kai color=#2563eb highlight=#fff29b marker=#a371d8 bold italic underline ornament=pill}');
  const baseline=await style('普通样本'),edge=await style('前缀');await previewSelect('普通样本');await brush.click();await previewDrag('目标文字');
  const cleared=await style('目标文字');for(const key of ['font','size','color','weight','italic','dots'])assert.equal(cleared[key],baseline[key]);assert.deepEqual(await style('前缀'),edge);assert.deepEqual(await style('后缀'),edge);
  assert.ok(cleared.effects.every(e=>e.background==='rgba(0, 0, 0, 0)'&&e.image==='none'&&e.decoration==='none'));
  record('ordinary sample removes old target formatting without changing unselected styled edges');

  await set('# 原生强调\n\n普通样本\n\n**前缀 目标文字 后缀**');await previewSelect('普通样本');await brush.click();await previewDrag('目标文字');assert.notEqual((await style('目标文字')).weight,'700');assert.equal((await style('前缀')).weight,'700');assert.equal((await style('后缀')).weight,'700');
  await set('# 更多修饰\n\n[样本]{font=times size=24 color=#095074 highlight=#bbf7d0 wave strike dots gold role=date ornament=ribbon}\n\n目标文字');const decorated=await style('样本');await previewSelect('样本');await brush.click();await previewDrag('目标文字');assert.deepEqual(await style('目标文字'),decorated);
  await page.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');const persisted=await source();await page.reload();await page.waitForSelector('.cm-content');assert.equal(await source(),persisted);assert.equal(await brush.getAttribute('aria-pressed'),'false');
  record('native emphasis edges remain intact; highlight, waves, strike, dots, gold, literary roles and ornaments copy together and persist after reopening');

  await set('# 安全边界\n\n**甲**与乙\n\n目标正文\n\n> 引用文字\n\n$E=mc^2$\n\n`代码`');
  await cmSelect('**甲**与乙');const safe=await source();await brush.click();assert.equal(await brush.getAttribute('aria-pressed'),'false');assert.equal(await source(),safe);
  await cmSelect('代码');await brush.click();assert.equal(await brush.getAttribute('aria-pressed'),'false');
  await cmSelect('甲');await brush.click();await cmSelect('$E=mc^2$');assert.equal(await source(),safe);assert.equal(await brush.getAttribute('aria-pressed'),'true');await page.keyboard.press('Escape');
  await cmSelect('甲');await brush.click();await cmSelect('目标正文\n\n> 引用文字');assert.equal(await source(),safe);assert.equal(await brush.getAttribute('aria-pressed'),'true');await page.keyboard.press('Escape');assert.equal(await brush.getAttribute('aria-pressed'),'false');
  await cmSelect('甲');await brush.click();await brush.click();assert.equal(await brush.getAttribute('aria-pressed'),'false');
  await cmSelect('甲');await brush.click();await page.click('#format-painter-status button');assert.equal(await brush.getAttribute('aria-pressed'),'false');
  await cmSelect('甲');await brush.click();await page.locator('.cm-content').focus();await page.keyboard.insertText('改文');await settle();assert.equal(await brush.getAttribute('aria-pressed'),'false');
  await cmSelect('改文');await brush.click();await page.click('#library-button');await page.click('#new-article');await settle();assert.equal(await brush.getAttribute('aria-pressed'),'false');
  record('mixed source and incompatible structures are rejected; Escape, repeat click, explicit cancel, typing and article switch disarm safely');

  for(const skin of ['water','witch-light','witch-immersive']){
    await page.keyboard.press('Alt+6');await page.click('#panel-skin');await page.click(`[data-ui-skin-choice="${skin}"]`);if(skin!=='water')await page.waitForFunction(()=>document.documentElement.dataset.witchAssets==='ready');await page.click('#modal-close');await page.click('#writing-panel-close');
    for(const night of [false,true]){
      if((await page.locator('body').getAttribute('data-appearance')==='night')!==night)await page.click('#night-button');
      await set('# 界面示例\n\n[样本]{color=#2563eb marker=#a371d8 bold}\n\n这里选中文字，应用同一套格式。');await previewSelect('样本');await brush.dblclick();
      assert.equal(await brush.evaluate(b=>b.nextElementSibling?.dataset.format),'bold');assert.ok(await page.locator('#format-painter-status').isVisible());
      assert.equal(await page.locator('body').getAttribute('data-format-painter'),'locked');assert.match(await page.locator('#format-painter-status').innerText(),/已锁定/);
      assert.ok(await brush.evaluate(b=>{const s=getComputedStyle(b);return parseFloat(s.width)>=32&&s.color!==s.backgroundColor;}));
      await page.screenshot({path:`${dir}/${skin}-${night?'night':'day'}.png`});await page.keyboard.press('Escape');
    }
  }
  record('format painter icon and persistent locked/cancel status fit all three desktop skins in day and night');
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
}catch(error){await page.screenshot({path:`${dir}/failure.png`});throw error;}
finally{await writeFile(`${dir}/report.json`,JSON.stringify({channel,version:browser.version(),checks,errors,network},null,2));await browser.close();}
