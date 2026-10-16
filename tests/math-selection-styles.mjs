import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';

const channel=process.env.MATH_STYLE_BROWSER||'chrome',checks=[],errors=[],network=[];
await mkdir(`test-results/math-style-${channel}-temp`,{recursive:true});
process.env.TEMP=process.env.TMP=process.env.TMPDIR=path.resolve(`test-results/math-style-${channel}-temp`);
const browser=await chromium.launch({channel,headless:true,downloadsPath:process.env.TEMP});
const context=await browser.newContext({offline:true,viewport:{width:1600,height:1000},permissions:['clipboard-read','clipboard-write'],acceptDownloads:true});
const cdp=await browser.newBrowserCDPSession(),{browserContextIds}=await cdp.send('Target.getBrowserContexts');
await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',browserContextId:browserContextIds[0],downloadPath:process.env.TEMP,eventsEnabled:true});
await context.addInitScript(()=>{localStorage.setItem('paper-library-open','false');localStorage.setItem('paper-theme-sidebar-open','false');});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
page.on('dialog',d=>d.accept());page.setDefaultTimeout(6000);
const check=name=>{checks.push(name);console.log(channel+': '+name);};
const source=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown);
const settle=()=>page.waitForTimeout(260);
const set=async text=>{await page.keyboard.press('Escape');await page.locator('.cm-content').focus();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await settle();};
const select=async(text,occurrence=0)=>{
  await page.keyboard.press('Escape');const doc=await source();let start=-1;
  for(let i=0;i<=occurrence;i++)start=doc.indexOf(text,start+1);
  assert.ok(start>=0,'missing selected expression '+text);
  const before=doc.slice(0,start).split('\n');
  await page.locator('.cm-content').focus();await page.keyboard.press('Control+Home');
  for(let i=1;i<before.length;i++)await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Home');for(let i=0;i<before.at(-1).length;i++)await page.keyboard.press('ArrowRight');
  await page.keyboard.down('Shift');for(let i=0;i<text.length;i++)await page.keyboard.press('ArrowRight');await page.keyboard.up('Shift');await page.waitForTimeout(50);
  assert.equal(await page.evaluate(()=>getSelection().toString()),text,'native editor selection');
};
const choice=async(kind,value,prefix='inline')=>{
  await page.click(`#${prefix}-${kind}-button`);await page.locator(`#quick-popover [data-inline-choice="${value}"]`).click();await settle();
};
const action=async(type,floating=false)=>{await page.locator(`${floating?'#selection-tools':'.format-toolbar'} [data-format="${type}"]`).click();await settle();};
const formula=()=>page.locator('#preview .math-display svg').first();
const noError=async()=>assert.equal(await page.locator('#preview .math-error').count(),0);
const download=async action=>{const pending=page.waitForEvent('download');await action();const file=await pending,filename=path.join(process.env.TEMP,file.suggestedFilename());await file.saveAs(filename);return readFile(filename);};
const original='# 公式的局部样式\n\n'+String.raw`$$
\pi(x)\sim\frac{x}{\ln x}.
$$`;
try{
  await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
  await set(original);const regular=await formula().locator('path').first().getAttribute('d'),relationColor=await formula().locator('path[data-c="223C"]').evaluate(n=>getComputedStyle(n).fill);
  await select(String.raw`\pi(x)`);await page.hover('#inline-color-button');await page.waitForSelector('#quick-popover');
  await page.locator('[data-inline-choice="#2563eb"]').click();await settle();await action('bold',true);
  await noError();assert.match(await source(),/\\textcolor\{#2563eb\}\{\\boldsymbol\{\\pi\(x\)\}\}/);
  assert.ok(await formula().locator('[fill="#2563eb"] path').count());
  assert.notEqual(await formula().locator('path').first().getAttribute('d'),regular,'Greek pi is actually a bold glyph');
  assert.equal(await formula().locator('path[data-c="223C"]').evaluate(n=>getComputedStyle(n).fill),relationColor);
  check('hover palette and floating B color and bold only pi(x), with a changed Greek glyph and unchanged relation');

  await select(String.raw`\frac{x}{\ln x}`);const ordinaryWidth=(await formula().locator('[data-mml-node="mfrac"]').boundingBox()).width;
  await choice('color','#dc2626');await choice('size','24');await choice('highlight','#fff29b');await noError();
  assert.ok((await formula().locator('[data-mml-node="mfrac"]').boundingBox()).width>ordinaryWidth*1.3);
  assert.ok(await formula().locator('[fill="#dc2626"] [data-mml-node="mfrac"]').count());
  assert.ok(await formula().locator('rect[fill="#fff29b"]').count());
  assert.match(await source(),/\\textcolor\{#dc2626\}\{\\bbox\[#fff29b\]\{\\bbox\[font-size:24px\]\{\\frac/);
  check('fraction numerator, denominator and rule share local red color, real size increase and yellow SVG background');

  await page.click('#inline-color-button');assert.equal(await page.locator('[data-inline-choice="#dc2626"]').getAttribute('aria-checked'),'true');
  await page.locator('#inline-color').evaluate(input=>{input.value='#7c3aed';input.dispatchEvent(new Event('change',{bubbles:true}));});await settle();
  assert.equal((await source()).match(/\\textcolor/g).length,2,'no nested duplicate color commands');
  await choice('size','');assert.doesNotMatch(await source(),/font-size/);assert.match(await source(),/#7c3aed/);assert.match(await source(),/#fff29b/);
  const styled=await source();
  for(const type of ['bold','italic','underline','strike']){await action(type);await noError();await action(type);assert.equal(await source(),styled);}
  await action('strike');assert.ok(await formula().locator('[data-mml-node="menclose"] line').count());await action('strike');
  await choice('color','');assert.match(await source(),/#fff29b/);assert.match(await source(),/#2563eb/);assert.doesNotMatch(await source(),/#7c3aed/);
  await page.click('#undo-button');await settle();assert.equal(await source(),styled);await page.click('#redo-button');await settle();assert.doesNotMatch(await source(),/#7c3aed/);
  await choice('effect','clear');await select(String.raw`\pi(x)`);await choice('effect','clear');assert.equal(await source(),original);
  check('successive edits retain selection, detect active styles, replace colors, toggle effects, clear only selected styles and undo/redo separately');

  const multi='# 多行与整式\n\n$$\n'+String.raw`\frac{x+1}{
\ln x}`+'\n$$';
  await set(multi);await select(String.raw`\frac{x+1}{
\ln x}`);await choice('color','#dc2626');await noError();
  await set(original);await select(original.slice(original.indexOf('$$')));await choice('highlight','#bbf7d0');await noError();
  assert.ok(await formula().locator('rect[fill="#bbf7d0"]').count());assert.equal((await source()).match(/\$\$/g).length,2);
  await choice('effect','clear');assert.equal(await source(),original);
  check('multiline expressions and whole display formulas retain delimiters and line breaks');

  for(const fragment of [String.raw`\fr`,String.raw`frac`,String.raw`\frac{x}`,String.raw`{x}{\ln`]){
    await set(original);await select(fragment);await choice('color','#dc2626');assert.equal(await source(),original);await noError();
    assert.match(await page.locator('#toast').innerText(),/完整|结构|括号/);
  }
  await page.keyboard.press('Escape');await select(String.raw`\pi(x)`);
  for(const id of ['inline-style-button','inline-marker-button','inline-role-button']){const before=await source();await page.click('#'+id);assert.equal(await source(),before);assert.match(await page.locator('#toast').innerText(),/公式支持/);}
  await action('wave');assert.equal(await source(),original);
  check('partial commands, incomplete arguments and text-only effects are rejected without changing a valid formula');

  const pair='# 多个公式\n\n行内 $x^2$ 与 $y^2$。\n\n$$\n'+String.raw`\begin{pmatrix}x+1 & y\\z & w\end{pmatrix}`+'\n$$';
  await set(pair);await select('x^2');await choice('color','#dc2626','selection');await action('underline');await noError();
  assert.match(await source(),/\$y\^2\$/);assert.ok(await page.locator('#preview .math-inline').first().locator('[fill="#dc2626"]').count());
  await select('x+1');await action('bold');await choice('color','#2563eb');await noError();
  assert.ok(await formula().locator('[data-mml-node="mtable"]').count());assert.match(await source(),/y\\\\z & w/);
  await set(pair);await select(String.raw`\begin{pmatrix}x+1 & y\\z & w\end{pmatrix}`);await action('bold');assert.equal(await source(),pair);
  check('inline formulas and matrix cells format independently; whole matrix bold remains explicitly guarded');

  await set('# 上下标\n\n'+String.raw`$x^\alpha+y_\beta$`);await select(String.raw`\alpha`);await choice('color','#dc2626');await noError();
  await select(String.raw`\beta`);await action('bold');await action('italic');await noError();
  assert.ok(await page.locator('#preview .math-inline [data-mml-node="msup"] [fill="#dc2626"]').count());
  assert.ok(await page.locator('#preview .math-inline [data-mml-node="msub"] path').count());
  const beforeInvalidSize=await source();await page.click('#inline-size-button');await page.locator('#inline-size').fill('65');await page.locator('#inline-size').press('Enter');assert.equal(await source(),beforeInvalidSize);assert.match(await page.locator('#toast').innerText(),/10–64/);await page.keyboard.press('Escape');
  check('unbraced Greek superscripts and subscripts keep their structure; invalid custom size leaves source unchanged');

  await set('# 手写样式\n\n$$\n'+String.raw`\textcolor{#2563eb}{\boldsymbol{\pi(x)}}\sim\frac{x}{\ln x}.`+'\n$$');
  await select(String.raw`\textcolor{#2563eb}{\boldsymbol{\pi(x)}}`);await choice('color','#dc2626');await action('bold');await noError();
  assert.equal((await source()).match(/\\textcolor/g).length,1);assert.doesNotMatch(await source(),/boldsymbol/);
  await set('# 字母参数\n\n$x$');await select('x');await choice('size','20');await choice('color','#dc2626');await noError();
  assert.equal(await page.evaluate(()=>getSelection().toString()),'x');
  check('existing standard color/bold wrappers and one-character selections remain editable');

  await set(original);await select(String.raw`\pi(x)`);await choice('color','#2563eb');await action('bold');
  await select(String.raw`\frac{x}{\ln x}`);await choice('color','#dc2626');await choice('highlight','#fff29b');await choice('size','24');
  const final=await source();await page.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');await page.reload();await page.waitForSelector('.cm-content');
  assert.equal(await source(),final);await noError();
  await page.screenshot({path:`test-results/math-selection-day-${channel}.png`});
  await page.click('#copy-button');await page.waitForFunction(()=>document.getElementById('copy-button').dataset.state==='success');
  const copied=await page.evaluate(async()=>{const [item]=await navigator.clipboard.read();return(await item.getType('text/html')).text();});
  assert.match(copied,/fill="#2563eb"/);assert.match(copied,/fill="#dc2626"/);assert.match(copied,/fill="#fff29b"/);
  await page.click('#export-toggle');const html=(await download(()=>page.click('#export-html'))).toString('utf8');
  assert.match(html,/fill="#2563eb"/);assert.match(html,/fill="#dc2626"/);assert.match(html,/fill="#fff29b"/);
  await page.click('#export-toggle');const word=unzipSync(await download(()=>page.click('#export-word')));
  assert.match(strFromU8(word['word/document.xml']),/<w:drawing>/);assert.ok(Object.keys(word).some(name=>/^word\/media\/.*\.png$/.test(name)));
  const media=Object.keys(word).find(name=>/^word\/media\/.*\.png$/.test(name));
  const pixels=await page.evaluate(async bytes=>{
    const bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'})),canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();
    const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,result={red:0,blue:0,yellow:0};
    for(let i=0;i<data.length;i+=4){const [r,g,b]=data.slice(i,i+3);if(r>120&&r>g*1.5&&r>b*1.5)result.red++;if(b>120&&b>r*1.5&&b>g*1.2)result.blue++;if(r>200&&g>180&&b<190)result.yellow++;}return result;
  },[...word[media]]);
  assert.ok(pixels.red>20&&pixels.blue>20&&pixels.yellow>100,JSON.stringify(pixels));
  await page.click('#night-button');await settle();await page.screenshot({path:`test-results/math-selection-night-${channel}.png`});await noError();
  check('saved reload, actual publication clipboard, offline HTML, Word formula images and night appearance retain local styles');

  for(const bad of [String.raw`\bbox[background-image:url(https://invalid.example/image.png)]{x}`,String.raw`\bbox[font-size:999px]{x}`]){
    await set('# 安全限制\n\n$$\n'+bad+'\n$$');assert.equal(await page.locator('#preview .math-error').count(),1);
  }
  await set('# 普通正文\n\n普通文字');await select('普通文字');await choice('color','#dc2626');await action('bold');assert.equal(await page.locator('#preview .inline-style').innerText(),'普通文字');
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);check('formula boxes reject CSS/URL injection and excessive sizes; ordinary text formatting and offline operation remain intact');
}catch(error){await page.screenshot({path:`test-results/math-selection-failure-${channel}.png`});throw error;}
finally{await writeFile(`test-results/math-selection-styles-${channel}.json`,JSON.stringify({channel,checks,errors,network},null,2));await browser.close();}
