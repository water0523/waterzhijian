import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
const channel=process.env.BLOCK_STYLE_BROWSER||'chrome',checks=[],errors=[],network=[];
await mkdir(`test-results/block-style-${channel}-temp`,{recursive:true});process.env.TEMP=process.env.TMP=process.env.TMPDIR=path.resolve(`test-results/block-style-${channel}-temp`);
const browser=await chromium.launch({channel,headless:true,downloadsPath:process.env.TEMP}),context=await browser.newContext({offline:true,viewport:{width:1600,height:1000},permissions:['clipboard-read','clipboard-write'],acceptDownloads:true});
const cdp=await browser.newBrowserCDPSession(),{browserContextIds}=await cdp.send('Target.getBrowserContexts');await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',browserContextId:browserContextIds[0],downloadPath:process.env.TEMP,eventsEnabled:true});
await context.addInitScript(()=>{localStorage.setItem('paper-library-open','false');localStorage.setItem('paper-theme-sidebar-open','false');});
const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});page.on('dialog',d=>d.accept());
const source=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown),settle=()=>page.waitForTimeout(230);
const set=async text=>{await page.keyboard.press('Escape');await page.locator('.cm-content').focus();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await settle();};
const select=async(from,to)=>{
  const doc=await source(),lines=doc.slice(0,from).split('\n');await page.keyboard.press('Escape');await page.locator('.cm-content').focus();await page.keyboard.press('Control+Home');
  for(let i=1;i<lines.length;i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Home');for(let i=0;i<lines.at(-1).length;i++)await page.keyboard.press('ArrowRight');
  await page.keyboard.down('Shift');for(let i=from;i<to;i++)await page.keyboard.press('ArrowRight');await page.keyboard.up('Shift');await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>getSelection().toString()),doc.slice(from,to));
};
const body=async()=>{const doc=await source();await select(doc.indexOf('\n\n')+2,doc.length);};
const menuId=(kind,prefix='inline')=>kind==='font'?(prefix==='inline'?'inline-style-button':'selection-style-button'):`${prefix}-${kind}-button`;
const choose=async(kind,value,prefix='inline',hover=false)=>{const id=menuId(kind,prefix);if(hover)await page.hover('#'+id);else await page.click('#'+id);await page.waitForSelector('#quick-popover');const row=page.locator('#quick-popover [data-inline-choice="'+value+'"]');if(/^#[\da-f]{6}$/i.test(value)&&!await row.count())await page.locator('#quick-popover input[type=color]').evaluate((input,color)=>{input.value=color;input.dispatchEvent(new Event('change',{bubbles:true}));},value);else await row.click();await settle();};
const action=async(type,floating=false)=>{await page.locator(`${floating?'#selection-tools':'.format-toolbar'} [data-format="${type}"]`).click();await settle();};
const css=text=>page.locator('#preview').evaluate((root,text)=>{
  const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=walk.nextNode())if(node.textContent.includes(text)){const parent=node.parentElement.matches('span.preview-text-run:not(.inline-style)')?node.parentElement.parentElement:node.parentElement,s=getComputedStyle(parent);return{font:s.fontFamily,size:s.fontSize,color:s.color,weight:s.fontWeight,italic:s.fontStyle,bg:s.backgroundColor,image:s.backgroundImage,line:s.textDecorationLine,lineStyle:s.textDecorationStyle,dots:s.textEmphasisStyle};}throw Error('missing text '+text);
},text);
const check=name=>{checks.push(name);console.log(channel+': '+name);};
const download=async action=>{const pending=page.waitForEvent('download');await action();const file=await pending,location=path.join(process.env.TEMP,file.suggestedFilename());await file.saveAs(location);return readFile(location);};
const original='# 选区之外不变\n\n未选前缀 甲段选中。\n\n第二段内容。\n\n乙段选中。 未选后缀\n\n完全没选中的另一段正文。';
const pick=async()=>{const doc=await source();await select(doc.indexOf('甲段选中'),doc.indexOf(' 未选后缀'));};
try{
  await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');await page.click('#theme-button');await page.click('[data-theme="plain"]');
  await set(original);const outside=await css('未选前缀'),other=await css('完全没选中');await pick();
  await choose('font','kai','inline',true);await choose('size','20','selection');await choose('color','#2563eb');await choose('highlight','#fff29b');await choose('marker','#bbf7d0');
  for(const text of ['甲段选中','第二段内容','乙段选中']){const s=await css(text);assert.match(s.font,/KaiTi/);assert.equal(s.size,'20px');assert.equal(s.color,'rgb(37, 99, 235)');assert.equal(s.bg,'rgb(255, 242, 155)');assert.match(s.image,/187, 247, 208/);}
  assert.deepEqual(await css('未选前缀'),outside);assert.deepEqual(await css('未选后缀'),outside);assert.deepEqual(await css('完全没选中'),other);
  assert.equal(await page.locator('#preview p').last().locator('.inline-style').count(),0);
  check('font, size, color, highlight and half-highlight affect only selected fragments, never other same-format paragraphs');

  for(const type of ['bold','italic','underline','strike']){await action(type,type==='bold');const s=await css('甲段选中');if(type==='bold')assert.equal(s.weight,'700');if(type==='italic')assert.equal(s.italic,'italic');if(type==='underline')assert.match(s.line,/underline/);if(type==='strike')assert.match(s.line,/line-through/);}
  await action('wave');assert.equal((await css('甲段选中')).lineStyle,'wavy');await action('wave');await action('underline');
  await choose('effect','dots');assert.match((await css('甲段选中')).dots,/dot/);
  await choose('effect','gold');assert.match((await css('甲段选中')).image,/linear-gradient/);assert.doesNotMatch(await source(),/marker=/);await choose('marker','#a371d8');assert.doesNotMatch(await source(),/ gold/);
  await choose('role','term');assert.equal(await page.locator('#preview .literary-term').count(),3);await choose('role','');assert.equal(await page.locator('#preview .literary-term').count(),0);
  assert.deepEqual(await css('未选前缀'),outside);assert.deepEqual(await css('完全没选中'),other);
  check('bold, italic, underline, wave, strike, dots, gold and literary roles apply and remove on the same retained selection');

  await page.click('#inline-size-button');await page.locator('#inline-size').fill('15.5');await page.locator('#inline-size').press('Enter');await settle();assert.equal((await css('第二段内容')).size,'15.5px');
  const beforeInvalid=await source();await page.click('#inline-size-button');await page.locator('#inline-size').fill('65');await page.locator('#inline-size').press('Enter');assert.equal(await source(),beforeInvalid);assert.match(await page.locator('#toast').innerText(),/10–64/);await page.keyboard.press('Escape');
  await page.click('#inline-color-button');await page.locator('#inline-color').evaluate(input=>{input.value='#663399';input.dispatchEvent(new Event('change',{bubbles:true}));});await settle();assert.equal((await css('第二段内容')).color,'rgb(102, 51, 153)');
  await choose('size','');assert.equal((await css('第二段内容')).size,outside.size);assert.equal((await css('第二段内容')).color,'rgb(102, 51, 153)');assert.match((await css('第二段内容')).font,/KaiTi/);
  const combined=await source();await choose('effect','clear');assert.equal(await source(),original);await page.click('#undo-button');await settle();assert.equal(await source(),combined);await page.click('#redo-button');await settle();assert.equal(await source(),original);
  check('custom values, per-property reset, complete clear and independent undo/redo preserve all unselected text and paragraph breaks');

  for(const [markup,key] of [['**','bold'],['*','italic'],['~~','strike'],['***','bold']]){
    const doc='# 原生格式\n\n'+markup+'前缀 甲段'+markup+'\n\n'+markup+'乙段 后缀'+markup;await set(doc);await select(doc.indexOf('甲段'),doc.indexOf('乙段')+2);await action(key);
    const left=await css('前缀'),right=await css('后缀'),selected=await css('甲段');
    if(key==='bold'){assert.equal(left.weight,'700');assert.equal(right.weight,'700');assert.notEqual(selected.weight,'700');}
    if(key==='italic'){assert.equal(left.italic,'italic');assert.equal(right.italic,'italic');assert.equal(selected.italic,'normal');}
    if(key==='strike'){assert.match(left.line,/line-through/);assert.match(right.line,/line-through/);assert.doesNotMatch(selected.line,/line-through/);}
    await page.click('#undo-button');await settle();assert.equal(await source(),doc);
  }
  await set('# 混合强调\n\n普通与 **旧重点**。\n\n第二段。');await body();await action('bold');assert.equal((await css('普通与')).weight,'700');assert.equal((await css('旧重点')).weight,'700');await action('bold');assert.notEqual((await css('旧重点')).weight,'700');assert.notEqual((await css('第二段')).weight,'700');
  check('native Markdown bold, italic, strike and triple emphasis toggle correctly while their unselected edges retain original formatting');

  const styled='# 已有样式\n\n[保留前缀 甲段]{font=kai size=20 color=#dc2626 highlight=#fff29b bold}\n\n[乙段 保留后缀]{font=kai size=20 color=#dc2626 highlight=#fff29b bold}';
  await set(styled);const prior=await css('保留前缀');await select(styled.indexOf('甲段'),styled.indexOf('乙段')+2);await choose('color','#2563eb');await choose('marker','#bbf7d0');await choose('effect','clear');
  assert.deepEqual(await css('保留前缀'),prior);assert.deepEqual(await css('保留后缀'),prior);assert.equal((await css('甲段')).color,outside.color);assert.equal((await css('乙段')).weight,outside.weight);
  check('editing and clearing parts of existing multi-property spans preserves every style on the unselected prefixes and suffixes');

  for(const doc of ['# 同类\n\n> 引用甲\n>\n> 引用乙','# 同类\n\n- 列表甲\n- 列表乙','# 同类\n\n## 标题甲\n\n## 标题乙','# 同类\n\n:::gewu-analysis\n组件甲\n\n组件乙\n:::']){
    await set(doc);const start=doc.indexOf('甲')-2,end=doc.indexOf('乙')+1;await select(start,end);await choose('highlight','#bbf7d0');assert.equal((await css(doc.slice(start,start+3))).bg,'rgb(187, 247, 208)');await choose('highlight','');assert.equal(await source(),doc);
  }
  check('same-format quote paragraphs, list items, heading levels and one themed component support selected-only styling');

  const mixed=[
    '正文甲\n\n## 标题乙','正文甲\n\n> 引用乙','正文甲\n\n- 列表乙','## 标题甲\n\n### 标题乙',
    '正文甲\n\n```text\n代码\n```\n\n正文乙','正文甲\n\n$$\nx^2\n$$\n\n正文乙','正文甲\n\n---\n\n正文乙',
    '正文甲\n\n:::gewu-analysis\n组件乙\n:::',':::gewu-analysis\n组件甲\n:::\n\n:::gewu-analysis\n组件乙\n:::'
  ];
  for(const text of mixed){const doc='# 不跨格式\n\n'+text;await set(doc);await body();for(const type of ['bold','italic','underline','wave','strike']){await action(type);assert.equal(await source(),doc);assert.match(await page.locator('#toast').innerText(),/不同格式/);}for(const kind of ['font','size','color','highlight','marker','effect','role']){await page.click('#'+menuId(kind));assert.equal(await page.locator('#quick-popover').count(),0);assert.equal(await source(),doc);assert.match(await page.locator('#toast').innerText(),/不同格式/);}}
  check('every text tool rejects mixed block formats and separate themed regions without modifying source');

  const protectedDoc='# 保留公式\n\n**前缀 甲段**\n\n**乙段 $x^2$ 后缀**';await set(protectedDoc);await select(protectedDoc.indexOf('甲段'),protectedDoc.indexOf('乙段')+2);const glyph=await page.locator('#preview .math-inline svg').innerHTML();await action('bold');assert.equal(await page.locator('#preview .math-error').count(),0);assert.equal(await page.locator('#preview .math-inline svg').innerHTML(),glyph);assert.match(await source(),/\$x\^2\$/);
  check('restoring an unselected native-emphasis ancestor preserves adjacent formula glyphs and exact formula source');

  await set(original);await pick();await choose('font','kai');await choose('size','20');await choose('color','#2563eb');await choose('highlight','#fff29b');await choose('marker','#bbf7d0');await action('bold');await action('underline');
  const final=await source();await page.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');await page.reload();await page.waitForSelector('.cm-content');assert.equal(await source(),final);assert.deepEqual(await css('完全没选中'),other);await page.screenshot({path:`test-results/multiblock-styles-day-${channel}.png`});
  await page.click('#copy-button');await page.waitForFunction(()=>document.getElementById('copy-button').dataset.state==='success');const copied=await page.evaluate(async()=>{const [item]=await navigator.clipboard.read();return(await item.getType('text/html')).text();});assert.match(copied,/font-family: KaiTi/);assert.match(copied,/font-weight: 700/);assert.match(copied,/linear-gradient/);assert.doesNotMatch(copied,/\{font=kai/);
  await page.click('#export-toggle');const html=(await download(()=>page.click('#export-html'))).toString('utf8');assert.match(html,/font-family: KaiTi/);assert.match(html,/linear-gradient/);
  await page.click('#export-toggle');const word=unzipSync(await download(()=>page.click('#export-word'))),xml=strFromU8(word['word/document.xml']);assert.match(xml,/w:eastAsia="KaiTi"/);assert.match(xml,/w:fill="fff29b"/i);assert.match(xml,/<w:b\/>/);assert.match(xml,/未选前缀/);await page.click('#night-button');await settle();await page.screenshot({path:`test-results/multiblock-styles-night-${channel}.png`});
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);check('reload, actual clipboard, offline HTML, editable Word and day/night retain selected styles without changing other paragraphs');
}catch(error){await page.screenshot({path:`test-results/multiblock-styles-failure-${channel}.png`});throw error;}
finally{await writeFile(`test-results/multiblock-styles-${channel}.json`,JSON.stringify({channel,checks,errors,network},null,2));await browser.close();}
