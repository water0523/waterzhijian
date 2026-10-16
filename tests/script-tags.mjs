import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';

const channel=process.env.SCRIPT_BROWSER||'chrome',checks=[],errors=[],network=[];
await mkdir(`test-results/script-${channel}-temp`,{recursive:true});
process.env.TEMP=process.env.TMP=process.env.TMPDIR=path.resolve(`test-results/script-${channel}-temp`);
const browser=await chromium.launch({channel,headless:true,downloadsPath:process.env.TEMP});
const context=await browser.newContext({offline:true,viewport:{width:1600,height:1000},permissions:['clipboard-read','clipboard-write'],acceptDownloads:true});
const cdp=await browser.newBrowserCDPSession(),{browserContextIds}=await cdp.send('Target.getBrowserContexts');
await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',browserContextId:browserContextIds[0],downloadPath:process.env.TEMP,eventsEnabled:true});
await context.addInitScript(()=>{localStorage.setItem('paper-library-open','false');localStorage.setItem('paper-theme-sidebar-open','false');});
const page=await context.newPage();page.setDefaultTimeout(7000);
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
page.on('dialog',d=>d.accept());
const source=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown);
const set=async text=>{await page.keyboard.press('Escape');await page.locator('.cm-content').focus();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await page.waitForTimeout(300);};
const check=name=>{checks.push(name);console.log(channel+': '+name);};
const download=async action=>{const pending=page.waitForEvent('download');await action();const file=await pending,location=path.join(process.env.TEMP,file.suggestedFilename());await file.saveAs(location);return readFile(location);};
const citation='https://github.com/ZhiqiuCao/Googology/blob/main/大数理论20260830.pdf';
const reported='# 上标引用\n\n因此，比较一个固定的巨数，是比较确定的函数值；比较一套造数方法，则常常要比较它们随参数增大时的增长率。本文沿用这种把“规则”与“数值”分开理解的数学思路。<sup>[[1]]('+citation+')</sup>\n\n普通文字 x<sup>2</sup> 与 H<sub>2</sub>O 保持正文基线。';
async function assertScripts(root){
  assert.equal(await root.locator('sup a').first().innerText(),'[1]');
  assert.equal(decodeURI(await root.locator('sup a').first().getAttribute('href')),citation);
  assert.equal(await root.locator('sub').innerText(),'2');
  const style=await root.locator('sup').first().evaluate(el=>({align:getComputedStyle(el).verticalAlign,size:parseFloat(getComputedStyle(el).fontSize),parent:parseFloat(getComputedStyle(el.parentElement).fontSize)}));
  assert.equal(style.align,'super');assert.ok(style.size<style.parent);
  assert.doesNotMatch(await root.innerText(),/<\/?(?:sup|sub)>/);
}
try{
  await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
  await page.click('#theme-button');await page.click('[data-theme="plain"]');await set(reported);
  await assertScripts(page.locator('#preview'));assert.equal(await source(),reported);
  check('reported Markdown citation becomes a smaller, raised clickable reference without changing the source');

  await set('# 嵌套与边界\n\n<SUP>甲**加粗**<sub>乙</sub>丙</SUP><sup></sup><sup>二</sup>尾声。\n\n<sup>跨行\n上标</sup>。\n\n脚注[^a]。\n\n[^a]: 正常脚注。');
  assert.equal(await page.locator('#preview p sup').first().innerText(),'甲加粗乙丙');
  assert.equal(await page.locator('#preview sup strong').innerText(),'加粗');assert.equal(await page.locator('#preview sup sub').innerText(),'乙');
  assert.equal(await page.locator('#preview sup').filter({hasText:'跨行'}).count(),1);
  assert.equal(await page.locator('#preview .footnote-ref').count(),1);
  check('case-insensitive, nested, adjacent, empty and wrapped tags coexist with native emphasis and Markdown footnotes');

  const literals='# 原样与安全\n\n`<sup>行内代码</sup>`\n\n```html\n<sup>代码块</sup>\n```\n\n\\<sup>转义\\</sup> 与 &lt;sup&gt;实体&lt;/sup&gt;\n\n<sup>未闭合\n\n<sup>错配</sub>\n\n<sup class="foreign" onclick="window.pwned=1">属性</sup>\n\n<span>未知标签</span><script>window.pwned=2</script>\n\n<sup>[危险](javascript:alert(1))<img src=x onerror="window.pwned=3"></sup>\n\n<sup>左 `</sup>` 右</sup>\n\n<sup>左 \\</sup> 右</sup>';
  await set(literals);const visible=await page.locator('#preview').innerText();
  for(const text of ['<sup>行内代码</sup>','<sup>代码块</sup>','<sup>转义</sup>','<sup>实体</sup>','<sup>未闭合','<sup>错配</sub>','<sup class=','<span>未知标签</span>'])assert.ok(visible.includes(text),text);
  assert.equal(await page.locator('#preview sup').count(),3);assert.equal(await page.locator('#preview script,#preview img,#preview [onclick],#preview [onerror],#preview a[href^="javascript:"]').count(),0);
  assert.equal(await page.evaluate(()=>window.pwned),undefined);
  assert.equal(await page.locator('#preview sup').nth(1).innerText(),'左 </sup> 右');assert.equal(await page.locator('#preview sup').nth(2).innerText(),'左 </sup> 右');
  check('code, escaped/entity tags, incomplete/mismatched tags and attributed tags remain literal; raw HTML and dangerous links stay disabled');

  await set(reported);const before=await page.locator('#preview').innerText();await page.click('#preview-edit-button');
  assert.equal(await page.locator('#preview').innerText(),before);
  const mapped=await page.locator('#preview [data-edit-from]').evaluateAll((els,doc)=>els.every(el=>doc.slice(Number(el.dataset.editFrom),Number(el.dataset.editTo))===el.textContent),reported);assert.equal(mapped,true);
  await page.locator('#preview sup [contenteditable]').last().fill('3');await page.click('#preview-edit-button');
  assert.equal(await source(),reported.replace('x<sup>2</sup>','x<sup>3</sup>'));
  await page.click('#undo-button');await page.waitForTimeout(250);assert.equal(await source(),reported);
  check('preview editing keeps accurate source offsets and changes only the superscript text; undo restores the exact input');

  for(const id of ['gewu','digest','press']){
    await page.click('#theme-button');const button=page.locator('[data-theme="'+id+'"]');
    assert.equal(await button.count(),1,id);await button.click();await assertScripts(page.locator('#preview'));
  }
  await page.screenshot({path:`test-results/script-tags-day-${channel}.png`});await page.click('#night-button');await assertScripts(page.locator('#preview'));
  await page.screenshot({path:`test-results/script-tags-night-${channel}.png`});await page.waitForTimeout(1100);await page.reload();await page.waitForSelector('.cm-content');await assertScripts(page.locator('#preview'));assert.equal(await source(),reported);
  check('literature/science, digest and press themes, day/night and saved reload preserve the reference');

  await page.click('#copy-button');if(await page.locator('#continue-copy').isVisible())await page.click('#continue-copy');await page.waitForTimeout(250);
  const html=await page.evaluate(async()=>{const items=await navigator.clipboard.read();return(await items[0].getType('text/html')).text();});
  const copied=await context.newPage();await copied.setContent(html);await assertScripts(copied.locator('article'));assert.doesNotMatch(html,/contenteditable|data-edit-/);await copied.close();
  await page.click('#export-toggle');const exported=await download(()=>page.click('#export-html'));const outputPath=path.join(process.env.TEMP,'citation.html');await writeFile(outputPath,exported);
  const output=await context.newPage();await output.goto(pathToFileURL(outputPath).href);await assertScripts(output.locator('article'));await output.close();
  await page.click('#export-toggle');const word=unzipSync(await download(()=>page.click('#export-word'))),xml=strFromU8(word['word/document.xml']),rels=strFromU8(word['word/_rels/document.xml.rels']);
  assert.match(xml,/<w:vertAlign w:val="superscript"/);assert.match(xml,/<w:vertAlign w:val="subscript"/);assert.match(xml,/\[1\]/);assert.ok(decodeURI(rels).includes(citation));assert.doesNotMatch(xml,/&lt;sup&gt;/);
  check('real clipboard, offline HTML and editable Word keep script alignment and the original citation link');
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);check('all checks run offline on desktop with no runtime errors');
}catch(error){await page.screenshot({path:`test-results/script-tags-failure-${channel}.png`});throw error;}
finally{await writeFile(`test-results/script-tags-${channel}.json`,JSON.stringify({channel,checks,errors,network},null,2));await browser.close();}
