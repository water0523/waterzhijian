import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const channel=process.env.TEST_BROWSER||'chrome',dir=`test-results/editor-controls-${channel}`;await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel,headless:true}),context=await browser.newContext({offline:true,viewport:{width:1600,height:1000}}),p=await context.newPage(),checks=[],rows=[],errors=[],network=[];
p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
const check=name=>{checks.push(name);console.log('PASS '+name);},artifact='dist/非水·成章-离线公众号排版器.html',url=pathToFileURL(path.resolve(artifact)).href;
await context.addInitScript(()=>{
 const color=s=>s.match(/[\d.]+/g).map(Number),over=(a,b)=>{const alpha=a[3]??1;return [0,1,2].map(i=>a[i]*alpha+b[i]*(1-alpha));};
 const luminance=c=>c.slice(0,3).map(x=>{const v=x/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
 window.controlMetrics=n=>{
  let bg=[255,255,255];const ancestors=[];for(let e=n;e;e=e.parentElement)ancestors.unshift(e);for(const e of ancestors)bg=over(color(getComputedStyle(e).backgroundColor),bg);
  const style=getComputedStyle(n),fg=over(color(style.color),bg),a=luminance(fg),b=luminance(bg),outline=color(style.outlineColor),ring=luminance(outline);
  return {color:style.color,background:bg,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),outline:style.outlineStyle,outlineWidth:parseFloat(style.outlineWidth),outlineContrast:(Math.max(ring,b)+.05)/(Math.min(ring,b)+.05),focusVisible:n.matches(':focus-visible'),opacity:style.opacity};
 };
});
const metrics=selector=>p.locator(selector).evaluate(n=>controlMetrics(n)),settle=()=>p.waitForTimeout(180),source=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown);
const snapshot=()=>p.evaluate(()=>{const a=JSON.parse(localStorage.getItem('paper-recovery'));delete a.recoveryWriter;return a;});
function readable(value,label){assert.ok(value.contrast>=4.5,`${label}: ${value.contrast.toFixed(2)} (${value.color})`);}
try{
 await p.goto(url);await p.waitForSelector('.cm-content');await p.locator('.cm-content').focus();await p.keyboard.press('Control+a');await p.keyboard.insertText('# 控件测试\n\n正文**样本**与目标。');await p.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');
 const initial=await snapshot(),syntax={};
 for(const skin of ['water','witch-light','witch-immersive']){
  await p.keyboard.press('Alt+6');await p.click('#panel-skin');await p.click(`[data-ui-skin-choice="${skin}"]`);if(skin!=='water')await p.waitForFunction(()=>document.documentElement.dataset.witchAssets==='ready');await p.click('#modal-close');await p.click('#writing-panel-close');
  for(const mode of ['day','night']){
   if((await p.locator('body').getAttribute('data-appearance')||'day')!==mode)await p.click('#night-button');
   for(const palette of ['light','github','solarized','dark','dracula','monokai']){
    await p.selectOption('#editor-theme',palette);const label=`${skin}/${mode}/${palette}`,row={skin,mode,palette,menus:[]};readable(await metrics('#inline-style-button'),label+' immediate palette change');await p.mouse.move(1000,950);await settle();
    for(const selector of ['.format-toolbar>[data-format=bold]','#inline-style-button','.editor-title small','.editor-bottom','#editor-theme']){const value=await metrics(selector);readable(value,label+' '+selector);}
    await p.locator('#inline-style-button').hover();await settle();row.hover=await metrics('#inline-style-button');readable(row.hover,label+' hovered label');
    // Enter a keyboard modality, then focus the real control. Mouse focus is not a focus-visible check.
    await p.locator('#editor-theme').focus();await p.keyboard.press('Tab');await p.locator('.format-toolbar>[data-format=bold]').focus();await settle();const focus=await metrics('.format-toolbar>[data-format=bold]');assert.equal(focus.focusVisible,true);assert.equal(focus.outline,'solid');assert.ok(focus.outlineWidth>=2);readable(focus,label+' focused icon');assert.ok(focus.outlineContrast>=3,label+' focus ring');row.focus=focus;
    for(const id of ['insert-menu-button','toolbar-more']){
     await p.locator('#'+id+'>summary').focus();await p.keyboard.press('Enter');await settle();assert.equal(await p.locator('#'+id).evaluate(n=>n.open),true);
     const buttons=p.locator('#'+id+' .toolbar-menu-content button:visible'),values=await buttons.evaluateAll(nodes=>nodes.filter(n=>!n.disabled).map(n=>({name:n.id||n.textContent,...controlMetrics(n)})));assert.ok(values.length>3);for(const value of values)readable(value,label+' menu '+value.name);
     await buttons.first().hover();await settle();readable(await buttons.first().evaluate(n=>controlMetrics(n)),label+' menu hover');await p.keyboard.press('Tab');await buttons.first().focus();await settle();const focused=await buttons.first().evaluate(n=>controlMetrics(n));readable(focused,label+' menu focus');assert.equal(focused.focusVisible,true);assert.ok(focused.outlineWidth>=2);assert.ok(focused.outlineContrast>=3,label+' menu focus ring');
     row.menus.push({id,values,focused});
     if(id==='toolbar-more'&&['dark','light','solarized'].includes(palette))await p.screenshot({path:`${dir}/${skin}-${mode}-${palette}-menu.png`});
     if(await p.locator('#quick-popover').isVisible())await p.keyboard.press('Escape');await p.keyboard.press('Escape');assert.equal(await p.locator('#'+id).evaluate(n=>n.open),false);assert.equal(await p.locator('#'+id+'>summary').evaluate(n=>n===document.activeElement),true);
    }
    const textStyle=await p.locator('.cm-content').evaluate(n=>({color:getComputedStyle(n).color,background:getComputedStyle(document.querySelector('.cm-editor')).backgroundColor,heading:getComputedStyle(n.querySelector('.cm-line span')||n).color}));if(syntax[palette])assert.deepEqual(textStyle,syntax[palette],label+' source palette');else syntax[palette]=textStyle;
    rows.push(row);
   }
   console.log(`Checked ${skin}/${mode}: six editor palettes`);
  }
 }
 assert.deepEqual(await snapshot(),initial);check('all 36 skin/appearance/editor-palette combinations (72 menu cases) keep controls, editor labels, both menu contents, hover and keyboard focus readable without mutating article or syntax palette');
 // Real formatting from a menu and undo, rather than only checking its colors.
 await p.locator('.cm-content').focus();await p.keyboard.press('Control+Home');await p.keyboard.press('ArrowDown');await p.keyboard.press('ArrowDown');await p.keyboard.press('Home');await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowRight');await p.keyboard.down('Shift');for(let i=0;i<6;i++)await p.keyboard.press('ArrowRight');await p.keyboard.up('Shift');
 await p.waitForSelector('#selection-tools:visible');const selected=await p.locator('#selection-tools').isVisible();assert.equal(selected,true);await p.click('#format-painter-button');assert.equal(await p.locator('#format-painter-button').getAttribute('aria-pressed'),'true');await settle();readable(await metrics('#format-painter-button'),'armed painter');assert.ok(await p.locator('#format-painter-status').isVisible());await p.keyboard.press('Escape');assert.equal(await p.locator('#format-painter-button').getAttribute('aria-pressed'),'false');assert.equal(await source(),initial.markdown);
 await p.locator('.cm-content').focus();await p.keyboard.press('Control+End');await p.keyboard.press('Shift+ArrowLeft');await p.click('#toolbar-more>summary');await p.click('#toolbar-more [data-format=wave]');await p.waitForFunction(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown.includes('{wave}'));assert.notEqual(await source(),initial.markdown);await p.keyboard.press('Escape');await p.locator('.cm-content').focus();await p.keyboard.press('Control+z');await p.waitForFunction(source=>JSON.parse(localStorage.getItem('paper-recovery')).markdown===source,initial.markdown);check('format painter keeps its visible armed state and cancellation; actual menu formatting preserves selection and supports one undo');
 await p.selectOption('#editor-theme','solarized');await p.reload();await p.waitForSelector('.cm-content');assert.equal(await p.locator('#editor-theme').inputValue(),'solarized');readable(await metrics('#inline-style-button'),'reopened palette');assert.equal(await source(),initial.markdown);check('saved independent editor palette reopens with readable controls and unchanged Markdown');assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
}catch(error){await p.screenshot({path:dir+'/failure.png'});throw error;}
finally{await writeFile(dir+'/report.json',JSON.stringify({channel,artifactHash:createHash('sha256').update(await readFile(artifact)).digest('hex'),checks,rows,errors,network},null,2));await browser.close();}
