import {chromium} from 'playwright';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
const channel=process.env.POLISH_BROWSER||'chrome',dir=`test-results/writing-polish-${channel}`;
await mkdir(dir,{recursive:true});process.env.TEMP=process.env.TMP=process.env.TMPDIR=path.resolve(dir);
const browser=await chromium.launch({channel,headless:true,downloadsPath:process.env.TEMP}),context=await browser.newContext({offline:true,viewport:{width:1600,height:1000},acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
const cdp=await browser.newBrowserCDPSession(),{browserContextIds}=await cdp.send('Target.getBrowserContexts');await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',browserContextId:browserContextIds[0],downloadPath:process.env.TEMP,eventsEnabled:true});
await context.addInitScript(()=>{localStorage.setItem('paper-library-open','false');localStorage.setItem('paper-theme-sidebar-open','false');});
const page=await context.newPage(),checks=[],errors=[],network=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});page.on('dialog',d=>d.accept());
const source=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown);
const set=async text=>{await page.keyboard.press('Escape');await page.locator('.cm-content').focus();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await page.waitForTimeout(250);};
const saved=()=>page.waitForFunction(()=>document.getElementById('save-state').dataset.state==='saved');
const check=name=>{checks.push(name);console.log(channel+': '+name);};
const download=async action=>{const pending=page.waitForEvent('download');await action();const d=await pending,file=path.join(process.env.TEMP,d.suggestedFilename());await d.saveAs(file);return {bytes:await readFile(file),file};};
const cleanText=element=>{const clone=element.cloneNode(true);clone.querySelectorAll('[aria-hidden=true],[data-editor-only],.preview-code-tools,.footnote-backref').forEach(n=>n.remove());return clone.textContent.replace(/\s+/g,'');};
const documentText=element=>{const clone=element.cloneNode(true);clone.querySelectorAll('[aria-hidden=true],[data-editor-only],.preview-code-tools,.footnote-backref,.math-inline,.math-display').forEach(n=>n.remove());return clone.textContent.replace(/\s+/g,'');};
try{
  await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
  const files=(await readdir('体验样稿')).filter(f=>f.endsWith('.md')&&f!=='README.md').sort(),themes=['journal-indigo','digest','press','tech','gewu'];
  for(let i=0;i<files.length;i++){
    const original=await readFile('体验样稿/'+files[i],'utf8');await page.locator('#import-input').setInputFiles(path.resolve('体验样稿/'+files[i]));await page.waitForFunction(title=>document.querySelector('#document-title').textContent===title,original.split('\n')[0].slice(2));
    await page.click('#theme-button');await page.click('[data-theme="'+themes[i]+'"]');await saved();assert.equal(await source(),original);
    assert.equal(await page.locator('#preview .math-error').count(),0);assert.equal(await page.locator('#render-state').innerText(),'实时预览');assert.doesNotMatch(await page.locator('#preview').innerText(),/:::(?:gewu|press|digest|poem|abstract)/);
    assert.ok(await page.locator('#preview').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    if(themes[i]==='digest')assert.ok(await page.locator('.digest-masthead').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    const expected=await page.locator('#preview').evaluate(cleanText);
    await page.click('#copy-button');if(await page.locator('#continue-copy').isVisible())await page.click('#continue-copy');
    const clipboard=await page.evaluate(async()=>{const [item]=await navigator.clipboard.read();return(await item.getType('text/html')).text();});assert.doesNotMatch(clipboard,/preview-code-tools|复制代码|code-copy-status|data-editor-only/);
    const reader=await context.newPage();await reader.setContent(clipboard);assert.equal(await reader.locator('article').evaluate(cleanText),expected);await reader.close();
    await page.click('#export-toggle');const html=await download(()=>page.click('#export-html'));assert.doesNotMatch(html.bytes.toString(),/preview-code-tools|code-copy-status|复制代码/);
    const offline=await context.newPage();await offline.goto(pathToFileURL(html.file).href);assert.equal(await offline.locator('article').evaluate(cleanText),expected);await offline.close();
    await page.selectOption('#publisher','zhihu');const expectedWord=await page.locator('#preview').evaluate(documentText),expectedMath=await page.locator('#preview .math-inline,#preview .math-display').count();
    await page.click('#export-toggle');const word=await download(()=>page.click('#export-word')),xml=strFromU8(unzipSync(word.bytes)['word/document.xml']);assert.ok(xml.includes(original.split('\n')[0].slice(2)));assert.doesNotMatch(xml,/preview-code-tools|复制代码|:::gewu|:::press|:::digest/);
    const wordText=await page.evaluate(xml=>[...new DOMParser().parseFromString(xml,'text/xml').getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','t')].map(t=>t.textContent).join('').replace(/\s+/g,''),xml);assert.equal(wordText,expectedWord);await page.selectOption('#publisher','wechat');
    assert.equal((xml.match(/<w:drawing>/g)||[]).length,expectedMath);
    await page.reload();await page.waitForSelector('.cm-content');assert.equal(await source(),original);assert.equal(await page.locator('#theme-button').getAttribute('data-theme'),null);assert.equal(await page.locator('#preview').evaluate(cleanText),expected);
    check(files[i]+': actual import/theme/save/reload and clipboard/HTML/Word preserve content, structures and formulas');
    if(i===3){
      const code=await page.locator('#preview pre > code').last().textContent();await page.locator('.preview-code-tools button').last().click();assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n'),code);assert.equal(await source(),original);assert.doesNotMatch(code,/SOURCE \/ CODE|复制代码/);
      await page.locator('#preview pre').last().scrollIntoViewIfNeeded();await page.screenshot({path:dir+'/code-day.png'});
      await page.evaluate(()=>{window.__writeText=navigator.clipboard.writeText.bind(navigator.clipboard);navigator.clipboard.writeText=()=>Promise.reject(Error('denied'));});await page.locator('.preview-code-tools button').last().click();assert.match(await page.locator('.code-copy-status').last().innerText(),/未获复制权限/);await page.evaluate(()=>{navigator.clipboard.writeText=window.__writeText;});await page.locator('.preview-code-tools button').last().click();assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n'),code);
      await page.click('#night-button');const ratio=await page.locator('.preview-code-tools button').last().evaluate(button=>{const cs=getComputedStyle(button),rgb=s=>s.match(/\d+/g).slice(0,3).map(Number),factor=parseFloat(getComputedStyle(document.querySelector('#preview')).filter.match(/brightness\(([^)]+)/)?.[1]||'1'),lum=values=>values.map(v=>{v=v*factor/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0),a=lum(rgb(cs.color)),b=lum(rgb(cs.backgroundColor));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});assert.ok(ratio>=4.5,'night code copy contrast '+ratio);await page.screenshot({path:dir+'/code-night.png'});await page.click('#night-button');
      check('code copy preserves every character including the trailing newline; denial/retry, source identity and day/night are correct');
      for(const mode of ['theme','standard']){await page.click('#export-toggle');await page.click('#export-pdf');const pending=page.waitForEvent('popup');await page.click('#pdf-'+mode);const popup=await pending;await popup.waitForSelector('.print-content pre');assert.equal(await popup.locator('.preview-code-tools').count(),0);assert.equal(await popup.locator('.print-content pre > code').last().textContent(),code);await popup.close();}
      await page.locator('.format-toolbar [data-format="link"]').click();await page.click('[data-link-mode="end"]');await page.click('#quick-close');
      assert.equal(await page.locator('#preview sup sup').count(),0);assert.equal(await page.locator('#preview .article-references p').count(),1);assert.equal(await page.locator('#preview > p sup').last().textContent(),'[参1]');assert.equal(await source(),original);
      await page.locator('#preview .article-references').scrollIntoViewIfNeeded();await page.screenshot({path:dir+'/references.png'});
      await page.click('#copy-button');const endHTML=await page.evaluate(async()=>{const [item]=await navigator.clipboard.read();return(await item.getType('text/html')).text();});assert.equal(await page.evaluate(html=>new DOMParser().parseFromString(html,'text/html').querySelectorAll('sup sup').length,endHTML),0);assert.doesNotMatch(endHTML,/preview-code-tools/);
      await page.locator('.format-toolbar [data-format="link"]').click();await page.click('[data-link-mode="direct"]');await page.click('#quick-close');assert.equal(await page.locator('#preview sup a').count(),1);assert.equal(await source(),original);
      check('normal and numeric superscript links deduplicate to one reference without nested superscripts; switching back restores the original link');
    }
  }
  const malformed='# 结构提醒\n\n:::gewu-poetry 原创诗\n:::poem center\n一声落在窗前\n:::\n\n正文仍在。';await set(malformed);assert.match(await page.locator('#render-state').innerText(),/1 处/);assert.match(await page.locator('#render-state').getAttribute('title'),/第 3 行.*gewu-poetry/);await page.locator('#render-state').focus();await page.keyboard.press('Enter');assert.match(await page.locator('#toast').innerText(),/第 3 行/);assert.ok(await page.locator('.cm-activeLine').innerText().then(t=>t.includes(':::gewu-poetry')));assert.equal(await source(),malformed);
  await page.click('#writing-tools-button');await page.click('#writing-check');assert.match(await page.locator('#modal-body').innerText(),/组件缺少结束标记/);await page.click('#modal-close');
  await page.screenshot({path:dir+'/structure-warning.png'});await set(malformed.replace(':::\n\n正文',':::\n:::\n\n正文'));assert.equal(await page.locator('#render-state').innerText(),'实时预览');assert.equal(await page.locator('.gewu-poetry .poem').count(),1);
  check('missing outer component closure is visible, keyboard-locatable and included in publishing checks; fixing source removes the warning');
  for(const original of [
    '# 字面示例\n\n```markdown\n:::gewu-poetry\n:::poem center\n```',
    '# 缩进代码\n\n    :::abstract\n    :::gewu-quote',
    '# 诗内原样\n\n:::gewu-poetry\n:::poem left\n```\n:::gewu-quote 只是诗行\n:::\n:::',
    '# 公式内容\n\n$$\n\\text{:::abstract}\n$$',
    '# 无需闭合的元素\n\n:::subtitle SUBTITLE\n\n:::divider double',
    '# 引用内的组件\n\n> :::abstract\n> 内容\n> :::'
  ]){await set(original);assert.equal(await page.locator('#render-state').innerText(),'实时预览');assert.equal(await source(),original);}
  check('code fences, indented code, raw poem lines, formulas, subtitles, dividers and valid quoted components do not produce false structure warnings');
  // Long mixed-form content must not make literal prose edits sluggish.
  const long=(await readFile('体验样稿/01-一杯温水的热量账本.md','utf8'))+'\n\n'+('## 继续观察\n\n'+'继续记录条件与读数，把变化写在同一本实验记录里。'.repeat(30)+'\n\n').repeat(25);await set(long);await page.locator('.cm-content').focus();await page.keyboard.press('Control+End');const start=Date.now();await page.keyboard.insertText('\n\n本轮检查结束。');await page.waitForFunction(()=>document.querySelector('#preview').textContent.includes('本轮检查结束'));const editMS=Date.now()-start;assert.ok(editMS<1000,'typing latency '+editMS+'ms');
  check('roughly twenty-thousand-character prose with components and formulas updates in '+editMS+'ms');
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
}catch(error){await page.screenshot({path:dir+'/failure.png'});throw error;}
finally{await writeFile(dir+'/report.json',JSON.stringify({channel,checks,errors,network},null,2));await browser.close();}
