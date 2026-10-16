import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
const channel=process.env.FONT_BROWSER||'chrome',checks=[],errors=[],network=[];
await mkdir(`test-results/font-${channel}-temp`,{recursive:true});process.env.TEMP=process.env.TMP=process.env.TMPDIR=path.resolve(`test-results/font-${channel}-temp`);
const browser=await chromium.launch({channel,headless:true,downloadsPath:process.env.TEMP}),context=await browser.newContext({offline:true,viewport:{width:1600,height:1000},permissions:['clipboard-read','clipboard-write'],acceptDownloads:true});
const cdp=await browser.newBrowserCDPSession(),{browserContextIds}=await cdp.send('Target.getBrowserContexts');await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',browserContextId:browserContextIds[0],downloadPath:process.env.TEMP,eventsEnabled:true});
await context.addInitScript(()=>{localStorage.setItem('paper-library-open','false');localStorage.setItem('paper-theme-sidebar-open','false');});
const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});page.on('dialog',d=>d.accept());
const source=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown),settle=()=>page.waitForTimeout(260);
const set=async text=>{await page.keyboard.press('Escape');await page.locator('.cm-content').focus();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await settle();};
const select=async(from,to)=>{
  const doc=await source(),lines=doc.slice(0,from).split('\n');await page.keyboard.press('Escape');await page.locator('.cm-content').focus();await page.keyboard.press('Control+Home');
  for(let i=1;i<lines.length;i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Home');for(let i=0;i<lines.at(-1).length;i++)await page.keyboard.press('ArrowRight');
  await page.keyboard.down('Shift');for(let i=from;i<to;i++)await page.keyboard.press('ArrowRight');await page.keyboard.up('Shift');await page.waitForTimeout(60);
  assert.equal(await page.evaluate(()=>getSelection().toString()),doc.slice(from,to));
};
const all=async()=>{const doc=await source();await select(doc.indexOf('\n\n')+2,doc.length);};
const choose=async(font,prefix='inline',hover=false)=>{
  const id=prefix==='inline'?'inline-style-button':'selection-style-button';if(hover)await page.hover('#'+id);else await page.click('#'+id);
  await page.locator('#quick-popover [data-inline-choice="'+font+'"]').click();await settle();
};
const skeleton=()=>page.locator('#preview').evaluate(el=>({text:el.textContent.replace(/\s+/g,' '),tags:[...el.querySelectorAll('h1,h2,h3,p,li,blockquote,strong,em,a,pre,code,.math-inline,.math-display,.poem')].map(n=>n.tagName+'.'+n.className),links:[...el.querySelectorAll('a')].map(n=>n.getAttribute('href'))}));
const check=name=>{checks.push(name);console.log(channel+': '+name);};
const download=async action=>{const event=page.waitForEvent('download');await action();const file=await event,location=path.join(process.env.TEMP,file.suggestedFilename());await file.saveAs(location);return readFile(location);};
try{
  await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');await page.click('#theme-button');await page.click('[data-theme="plain"]');
  const original='# 标题不变\n\n前缀甲 甲段选区。\n\n第二段含**重点**与*斜体*。\n第三段软换行。\n\n丁段选区。 后缀乙';
  await set(original);const before=await skeleton();await select(original.indexOf('甲段选区'),original.indexOf(' 后缀乙'));
  await choose('kai','inline',true);assert.deepEqual(await skeleton(),before);const spans=await page.locator('#preview [data-inline-font="kai"]').count();assert.ok(spans>=6);assert.equal(await page.locator('#preview h1 .inline-style').count(),0);
  assert.match(await source(),/前缀甲 \[甲段选区。\]\{font=kai\}/);assert.match(await source(),/\[丁段选区。\]\{font=kai\} 后缀乙/);
  assert.match(await source(),/\*\*\[重点\]\{font=kai\}\*\*/);check('hover font menu styles partial edge paragraphs and soft-wrapped middle paragraph without changing Markdown structure');
  const kai=await source();await choose('song','selection');assert.equal(await page.locator('#preview [data-inline-font="kai"]').count(),0);assert.equal(await page.locator('#preview [data-inline-font="song"]').count(),spans);const song=await source();
  await choose('');assert.equal(await source(),original);await page.click('#undo-button');await settle();assert.equal(await source(),song);await page.click('#undo-button');await settle();assert.equal(await source(),kai);await page.click('#redo-button');await settle();assert.equal(await source(),song);await page.click('#redo-button');await settle();assert.equal(await source(),original);
  check('floating font menu updates the retained selection, removes fonts without nested wrappers and supports one-step undo/redo');

  const complex='# 跨结构\n\n## 章节标题\n\n- **列表：**第一条\n- 第二条\n\n> 引用文字\n> 连续两行\n\n一段**跨行\n加粗**与[链接](https://example.com)和 `code`，公式 $E=mc^2$。\n\n```md\n# 代码标题\n$code$\n```\n\n$$\n\\frac{x}{\\ln x}\n$$\n\n:::poem center\n第一句诗\n第二句诗\n:::';
  await set(complex);const structures=await skeleton();await all();await page.click('#inline-style-button');assert.equal(await page.locator('#quick-popover').count(),0);assert.match(await page.locator('#toast').innerText(),/不同格式/);assert.equal(await source(),complex);
  await select(complex.indexOf('引用文字'),complex.indexOf('连续两行')+4);await choose('fang');assert.deepEqual(await skeleton(),structures);assert.equal(await page.locator('#preview blockquote [data-inline-font="fang"]').count(),2);await choose('');assert.equal(await source(),complex);
  check('mixed block formats are rejected; same-format quote lines change fonts without altering surrounding structure, code or formulas');

  const existing='# 已有字体\n\n[左边保留 开始甲]{font=kai color=#dc2626}\n\n中间段落\n\n[结束乙 右边保留]{font=kai underline}';
  await set(existing);await select(existing.indexOf('开始甲'),existing.indexOf('结束乙')+'结束乙'.length);await choose('song');
  assert.equal(await page.locator('#preview [data-inline-font="song"]').allTextContents().then(v=>v.join('|')),'开始甲|中间段落|结束乙');assert.equal(await page.locator('#preview [data-inline-font="kai"]').allTextContents().then(v=>v.join('|')),'左边保留 | 右边保留');
  const colored=page.locator('#preview p').first();assert.equal(await colored.evaluate(n=>getComputedStyle(n.querySelector('.inline-style')).color),'rgb(220, 38, 38)');assert.ok(await page.locator('#preview [data-inline-underline="single"]').count());const styled=await source();
  await choose('');assert.equal(await page.locator('#preview [data-inline-font="song"]').count(),0);assert.equal(await page.locator('#preview [data-inline-font="kai"]').count(),2);await page.click('#undo-button');await settle();assert.equal(await source(),styled);
  check('partial existing font spans keep unselected text in its original font, retain colors/underline and reset only selected text');

  const legacy='# 强调旧稿\n\n**[旧甲]{font=kai color=#dc2626}**\n\n[旧乙 **重点**]{font=kai underline}\n\n转义 \\*号与 &amp; 符号';
  await set(legacy);const legacyView=await skeleton();await all();await choose('song');assert.deepEqual(await skeleton(),legacyView);assert.equal(await page.locator('#preview [data-inline-font="kai"]').count(),0);await choose('');assert.equal(await source(),legacy.replace('font=kai color=#dc2626','color=#dc2626').replace('font=kai underline','underline'));
  check('legacy bold styled spans, nested emphasis, escaped punctuation and entities keep their text and independent styles');

  await set('# 重复文字\n\n同样文字\n\n同样文字\n\n同样文字');const repeated=await source(),second=repeated.indexOf('同样文字',repeated.indexOf('同样文字')+1);await select(second,repeated.length);await choose('song');assert.equal(await page.locator('#preview p').first().locator('.inline-style').count(),0);assert.equal(await page.locator('#preview [data-inline-font="song"]').count(),2);
  check('repeated paragraphs use exact source positions without changing an earlier unselected occurrence');

  await set(original);await select(original.indexOf('甲段选区'),original.indexOf(' 后缀乙'));await choose('kai');const saved=await source();await page.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');await page.reload();await page.waitForSelector('.cm-content');assert.equal(await source(),saved);assert.match(await page.locator('#preview [data-inline-font="kai"]').first().evaluate(n=>getComputedStyle(n).fontFamily),/KaiTi/);
  await page.screenshot({path:`test-results/multiblock-font-day-${channel}.png`});await page.click('#copy-button');await page.waitForFunction(()=>document.getElementById('copy-button').dataset.state==='success');const copied=await page.evaluate(async()=>{const [item]=await navigator.clipboard.read();return(await item.getType('text/html')).text();});assert.match(copied,/font-family: KaiTi/);assert.doesNotMatch(copied,/\{font=kai\}/);
  await page.click('#export-toggle');const html=await download(()=>page.click('#export-html'));assert.match(html.toString('utf8'),/font-family: KaiTi/);await page.click('#export-toggle');const word=unzipSync(await download(()=>page.click('#export-word'))),xml=strFromU8(word['word/document.xml']);assert.match(xml,/w:eastAsia="KaiTi"/);assert.match(xml,/甲段选区/);assert.match(xml,/后缀乙/);
  await page.click('#night-button');await settle();await page.screenshot({path:`test-results/multiblock-font-night-${channel}.png`});
  check('saved reload, native clipboard, standalone HTML and editable Word retain cross-paragraph fonts in both appearances');

  const code='# 只选代码\n\n```md\n第一行\n第二行\n```';await set(code);await select(code.indexOf('第一行'),code.indexOf('第二行')+3);await page.click('#inline-style-button');assert.equal(await source(),code);assert.match(await page.locator('#toast').innerText(),/代码.*公式/);
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);check('code-only selections remain source text and all operations stay offline without runtime errors');
}catch(error){await page.screenshot({path:`test-results/multiblock-font-failure-${channel}.png`});throw error;}
finally{await writeFile(`test-results/multiblock-font-${channel}.json`,JSON.stringify({channel,checks,errors,network},null,2));await browser.close();}
