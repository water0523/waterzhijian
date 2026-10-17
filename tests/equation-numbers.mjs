import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';

const channel=process.env.EQUATION_BROWSER||'chrome',dir=`test-results/equation-numbers-${channel}`;
await mkdir(dir,{recursive:true});process.env.TEMP=process.env.TMP=process.env.TMPDIR=path.resolve(dir);
const browser=await chromium.launch({channel,headless:true,downloadsPath:process.env.TEMP});
const options={offline:true,viewport:{width:1600,height:1000},acceptDownloads:true,permissions:['clipboard-read','clipboard-write']};
const context=await browser.newContext(options),page=await context.newPage(),checks=[],errors=[],network=[];
const cdp=await browser.newBrowserCDPSession(),{browserContextIds}=await cdp.send('Target.getBrowserContexts');
await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',browserContextId:browserContextIds[0],downloadPath:process.env.TEMP,eventsEnabled:true});
await context.addInitScript(()=>{localStorage.setItem('paper-library-open','false');localStorage.setItem('paper-theme-sidebar-open','false');});
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});page.on('dialog',d=>d.accept());
const url=pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href;
const recovery=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')));
const saved=()=>page.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');
const set=async text=>{await page.locator('.cm-content').focus();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await page.waitForTimeout(250);await saved();};
const check=name=>{checks.push(name);console.log(channel+': '+name);};
const settings=async()=>{if(await page.locator('#style-panel').isHidden())await page.click('#style-button');};
const toggle=async on=>{await settings();await page.locator('#setting-equationNumbers').setChecked(on);await saved();await page.click('#style-close');};
const ids=(p=page,selector='#preview')=>p.locator(selector+' .math-display').evaluateAll(nodes=>nodes.map(n=>[...n.querySelectorAll('[id^="mjx-eqn:"]')].map(t=>t.id.slice(8)).filter(Boolean)));
const download=async action=>{const pending=page.waitForEvent('download');await action();const d=await pending,file=path.join(process.env.TEMP,d.suggestedFilename());await d.saveAs(file);return {bytes:await readFile(file),file};};
const tex=s=>'$$\n'+s+'\n$$';
const cases=[
  [String.raw`\pi(x)\sim\frac{x}{\ln x}.`,['1']],
  [String.raw`E=mc^2\tag{A}`,['A']],
  [String.raw`a=b\tag*{S1}`,['S1']],
  [String.raw`x=2\notag`,[]],
  [String.raw`y=3\nonumber`,[]],
  [String.raw`\begin{align}a&=b\\c&=d\notag\\e&=f\end{align}`,['2','3']],
  [String.raw`\begin{equation}g=h\end{equation}`,['4']],
  [String.raw`\begin{equation*}i=j\end{equation*}`,[]],
  [String.raw`\begin{align*}k&=l\\m&=n\end{align*}`,[]],
  [String.raw`\begin{flalign*}o&=p&&\end{flalign*}`,[]],
  [String.raw`\begin{aligned}q&=r\\s&=t\end{aligned}`,['5']],
  [String.raw`\begin{pmatrix}1&2\\3&4\end{pmatrix}`,['6']],
  [String.raw`u=v`,['7']],
  [String.raw`w=z`,['8']],
  [String.raw`\badUnknownFormula{x}`,null],
  [String.raw`a_n=n^2`,['9']]
];
const mixed='# 全文公式编号\n\n行内 $\\beta$ 保持原样。代码 `$$x=1$$` 不参与编号。\n\n'+cases.map(([s],i)=>{
  const block=tex(s);return i===11?':::equation\n'+block+'\n:::':i===12?':::equation 推导结论\n'+block+'\n:::':i===13?':::gewu-equation 物理模型\n'+block+'\n:::':block;
}).join('\n\n')+'\n\n```tex\n$$x=1$$\n```';
try{
  await page.goto(url);await page.waitForSelector('.cm-content');
  const prose='# 安静的正文\n\n没有公式时，开关也可以预先打开。';await set(prose);await page.click('#theme-button');await page.click('[data-theme="plain"]');await saved();
  await page.reload();await page.waitForSelector('.cm-content');await settings();assert.equal(await page.locator('#setting-equationNumbers').isChecked(),false);await page.click('#style-close');
  await toggle(true);assert.deepEqual(await page.evaluate(()=>Object.keys(globalThis.__feishuiOfflineModules||{})),[]);assert.equal((await recovery()).markdown,prose);
  check('default off; enabling on prose saves an article setting without changing text or starting any optional engine');

  await set(mixed);assert.deepEqual(await ids(),cases.filter(c=>c[1]).map(c=>c[1]));assert.equal(await page.locator('#preview .math-error').count(),1);assert.equal(await page.locator('#preview .math-inline [id^="mjx-eqn:"]').count(),0);assert.equal(await page.locator('#preview [id="mjx-eqn:"]').count(),0);
  assert.equal(await page.locator('#preview .journal-equation > .journal-block-title').count(),1);assert.equal(await page.locator('#preview .journal-equation > .journal-block-title').innerText(),'推导结论');assert.equal((await recovery()).markdown,mixed);
  check('plain, aligned, matrix and nested component formulas share a counter; manual tags, tag*, notag, nonumber and starred environments are respected; errors and inline/code formulas consume no numbers');

  await page.reload();await page.waitForSelector('.cm-content');assert.deepEqual(await ids(),cases.filter(c=>c[1]).map(c=>c[1]));await settings();assert.ok(await page.locator('#setting-equationNumbers').isChecked());await page.click('#style-close');
  await page.click('#theme-button');await page.click('[data-theme="journal-indigo"]');await saved();assert.deepEqual(await ids(),cases.filter(c=>c[1]).map(c=>c[1]));assert.equal((await recovery()).markdown,mixed);
  await toggle(false);assert.deepEqual((await ids()).flat(),['A','S1','1','2','3']);assert.equal(await page.locator('#preview .journal-equation > .journal-block-title').count(),2);await toggle(true);assert.deepEqual(await ids(),cases.filter(c=>c[1]).map(c=>c[1]));
  check('saved reload and switching theme preserve numbering; repeated on/off switches use separate caches and restore original AMS and component numbering when off');

  const output='# 公式自动编号\n\n行内 $\\beta$ 不编号，原文无需补写标签。\n\n'+tex(String.raw`\textcolor{#2563eb}{\boldsymbol{\pi(x)}}\sim\frac{x}{\ln x}.`)+'\n\n'+tex('x^2+y^2=z^2')+'\n\n'+tex(String.raw`a=b\tag{A}`)+'\n\n:::equation\n'+tex('E=mc^2')+'\n:::';
  await set(output);assert.equal(await page.locator('#preview .math-error').count(),0);assert.deepEqual((await ids()).flat(),['1','2','A','3']);
  const geometry=await page.locator('#preview .math-display').first().evaluate(n=>{const svg=n.querySelector('svg'),tag=n.querySelector('[id="mjx-eqn:1"]'),a=svg.getBoundingClientRect(),b=tag.getBoundingClientRect();return {svg:{x:a.x,right:a.right,width:a.width},tag:{x:b.x,right:b.right,width:b.width},overflow:n.scrollWidth-n.clientWidth};});
  assert.ok(geometry.tag.width>5&&geometry.tag.x>geometry.svg.x+geometry.svg.width*.65,JSON.stringify(geometry));assert.ok(geometry.tag.right<=geometry.svg.right+1,JSON.stringify(geometry));assert.ok(geometry.overflow<=1,JSON.stringify(geometry));
  await page.screenshot({path:dir+'/day.png'});await settings();await page.locator('#setting-equationNumbers').scrollIntoViewIfNeeded();await page.screenshot({path:dir+'/settings.png'});await page.click('#style-close');await page.click('#night-button');await page.screenshot({path:dir+'/night.png'});assert.deepEqual((await ids()).flat(),['1','2','A','3']);await page.click('#night-button');
  check('number labels are visible on the right without clipping in the desktop preview and survive day/night appearance');

  await page.click('#copy-button');await page.waitForFunction(()=>document.getElementById('copy-button').dataset.state==='success');
  const clipboard=await page.evaluate(async()=>{const [item]=await navigator.clipboard.read();return(await item.getType('text/html')).text();});
  for(const n of ['1','2','A','3'])assert.ok(clipboard.includes('mjx-eqn:'+n));assert.match(clipboard,/fill="#2563eb"/);
  await page.click('#export-toggle');const html=await download(()=>page.click('#export-html'));const doc=await context.newPage();await doc.goto(pathToFileURL(html.file).href);assert.deepEqual((await ids(doc,'body')).flat(),['1','2','A','3']);assert.equal(await doc.locator('.math-error').count(),0);await doc.close();
  await page.click('#export-toggle');const markdown=await download(()=>page.click('#export-md'));assert.equal(markdown.bytes.toString('utf8').replace(/\r\n/g,'\n'),output);
  check('actual rich-text clipboard and downloaded offline HTML retain labels and local math styles; Markdown export remains original source');

  await page.click('#export-toggle');await page.click('#export-longimage');await page.click('#longimage-start');await page.waitForSelector('#longimage-copy',{timeout:30000});
  const longImage=await page.locator('#longimage-result-image').evaluate(async img=>{const blob=await(await fetch(img.src)).blob(),bitmap=await createImageBitmap(blob),c=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();const d=ctx.getImageData(0,0,c.width,c.height).data;let rightInk=0;for(let y=0;y<c.height;y++)for(let x=Math.ceil(c.width*.85);x<c.width;x++){const i=(y*c.width+x)*4;if(d[i]<100&&d[i+1]<100&&d[i+2]<100&&d[i+3]>0)rightInk++;}return {bytes:[...new Uint8Array(await blob.arrayBuffer())],width:c.width,height:c.height,rightInk};});
  assert.ok(longImage.width>=800&&longImage.rightInk>300,JSON.stringify({...longImage,bytes:undefined}));await writeFile(dir+'/article.png',new Uint8Array(longImage.bytes));await page.click('#modal-close');
  check('actual article PNG contains the rendered formula numbers in the right-hand label area');

  await page.click('#export-toggle');const word=unzipSync((await download(()=>page.click('#export-word'))).bytes),media=Object.keys(word).filter(n=>/^word\/media\/.*\.png$/.test(n));assert.equal(media.length,5);
  // The right-hand number is part of the actual raster sent to Word, not only SVG metadata.
  const pixels=await page.evaluate(async images=>{const values=[];for(const bytes of images){const image=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'})),c=new OffscreenCanvas(image.width,image.height),ctx=c.getContext('2d');ctx.drawImage(image,0,0);image.close();const d=ctx.getImageData(0,0,c.width,c.height).data;let right=0,blue=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4,[r,g,b,a]=d.slice(i,i+4);if(a&&r<150&&g<150&&b<150&&x>c.width*.85)right++;if(a&&b>120&&b>r*1.5&&b>g*1.2)blue++;}values.push({width:c.width,height:c.height,right,blue});}return values;},media.map(n=>[...word[n]]));
  assert.equal(pixels.filter(p=>p.width>200&&p.right>30).length,4,JSON.stringify(pixels));assert.ok(pixels.some(p=>p.blue>20),JSON.stringify(pixels));
  for(const mode of ['theme','standard']){await page.click('#export-toggle');await page.click('#export-pdf');const pending=page.waitForEvent('popup');await page.click('#pdf-'+mode);const popup=await pending;await popup.waitForSelector('#print-now');assert.deepEqual((await ids(popup,'.print-content')).flat(),['1','2','A','3']);await popup.pdf({path:dir+'/'+mode+'.pdf',printBackground:true,preferCSSPageSize:true});await popup.close();}
  await page.selectOption('#publisher','zhihu');assert.deepEqual((await ids()).flat(),['1','2','A','3']);await page.selectOption('#publisher','wechat');assert.equal((await recovery()).markdown,output);
  check('Word contains four numbered equation images with ink in the label area; actual theme/standard PDFs and standard preview retain the same counter');

  await page.click('#export-toggle');const backup=await download(()=>page.click('#export-backup')),manifest=JSON.parse(strFromU8(unzipSync(backup.bytes)['manifest.json'])),article=manifest.articles[0];assert.equal(article.typography.equationNumbers,true);assert.ok(article.revisions.some(r=>r.typography.equationNumbers===false));assert.ok(article.revisions.some(r=>r.typography.equationNumbers===true));
  const restoredContext=await browser.newContext(options),restored=await restoredContext.newPage();restored.on('pageerror',e=>errors.push(e.message));restored.on('dialog',d=>d.accept());await restored.goto(url);await restored.waitForSelector('.cm-content');await restored.setInputFiles('#import-input',{name:'restore.zip',mimeType:'application/zip',buffer:backup.bytes});await restored.waitForFunction(text=>JSON.parse(localStorage.getItem('paper-recovery')).markdown===text,output);assert.deepEqual((await ids(restored)).flat(),['1','2','A','3']);
  await restored.click('#style-button');assert.ok(await restored.locator('#setting-equationNumbers').isChecked());await restored.click('#style-close');
  if(await restored.locator('#library').isHidden())await restored.click('#library-button');await restored.locator('.article-item.current summary').click();await restored.locator('.article-item.current [data-action="history"]').click();
  const reversed=[...article.revisions].reverse(),off=reversed.findIndex(r=>r.typography.equationNumbers===false);assert.ok(off>=0);await restored.locator('[data-revision="'+off+'"]').click();assert.equal(await restored.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).typography.equationNumbers),false);
  await restored.click('#style-button');assert.equal(await restored.locator('#setting-equationNumbers').isChecked(),false);await restored.click('#style-close');
  if(await restored.locator('#library').isHidden())await restored.click('#library-button');await restored.click('#new-article');await restored.click('#style-button');assert.equal(await restored.locator('#setting-equationNumbers').isChecked(),false);await restoredContext.close();
  check('ZIP restore keeps the toggle and earlier recovery points; restoring an off version and creating a new article retain independent settings');

  await settings();await page.click('#reset-style');assert.equal(await page.locator('#setting-equationNumbers').isChecked(),false);await page.click('#style-close');assert.deepEqual((await ids()).flat(),['A']);assert.equal((await recovery()).markdown,output);
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);check('reset to theme defaults disables automatic numbering without editing text; no script errors or online requests');
}catch(error){await page.screenshot({path:dir+'/failure.png'});throw error;}
finally{await writeFile(dir+'/report.json',JSON.stringify({channel,checks,errors,network},null,2));await browser.close();}
