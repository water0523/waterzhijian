import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
await mkdir('test-results/document-temp',{recursive:true});
process.env.TEMP=process.env.TMP=process.env.TMPDIR=path.resolve('test-results/document-temp');
const reports=[];
for(const channel of (process.env.TEST_BROWSER?[process.env.TEST_BROWSER]:['chrome','msedge'])){
 const browser=await chromium.launch({channel,headless:true,downloadsPath:process.env.TEMP});
 const context=await browser.newContext({offline:true,viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write'],acceptDownloads:true});
 const cdp=await browser.newBrowserCDPSession();const {browserContextIds}=await cdp.send('Target.getBrowserContexts');await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',browserContextId:browserContextIds[0],downloadPath:process.env.TEMP,eventsEnabled:true});
 const page=await context.newPage(),errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});page.on('dialog',d=>d.accept());
 try{
  await page.goto(pathToFileURL(path.resolve('dist/纸间-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
  const source='# 标准文档导出验收\n\n## 科学与生活\n\n正文含有**加粗重点**、*斜体*、~~删除线~~及[参考链接](https://example.com)。行内公式 $E=mc^2$。\n\n> 引用内容，仍保持正常文档结构。\n\n1. 第一项\n2. 第二项\n\n- 观察自然\n- 记录变化\n\n| 项目 | 数值 |\n| --- | --- |\n| 波长 | 500 nm |\n\n$$\n\\int_0^1 x^2\\,dx=\\frac13\n$$\n\n```js\nconst value = 42;\nconsole.log(value);\n```\n\n:::poem center\n风来到纸上\n又走向远方\n\n留下一行光\n:::\n\n脚注测试[^a]。\n\n[^a]: 标准文档注释。';
  await page.locator('.cm-content').click();await page.keyboard.press('Control+a');await page.keyboard.insertText(source);await page.waitForTimeout(350);
  await page.click('#theme-button');await page.click('[data-theme="cosmos"]');
  await page.locator('.cm-content').click();await page.keyboard.press('Control+End');
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=180;c.height=90;const x=c.getContext('2d');x.fillStyle='#789b62';x.fillRect(20,20,140,50);return c.toDataURL();});
  const image=path.resolve('test-results/document-image.png');await writeFile(image,Buffer.from(png.split(',')[1],'base64'));await page.locator('#image-input').setInputFiles(image);await page.waitForSelector('#preview img');
  await page.locator('#preview img').click();await page.click('#make-sticker');
  await page.selectOption('#publisher','zhihu');assert.equal(await page.locator('#preview .sticker-item').count(),0);assert.equal(await page.locator('#preview img').count(),1);assert.ok(await page.locator('#theme-button').isDisabled());
  assert.equal(await page.locator('#preview h2').evaluate(el=>getComputedStyle(el).color),'rgb(17, 17, 17)');assert.ok(await page.locator('.sticker-toolbar').isHidden());
  await page.click('#copy-button');await page.click('#continue-copy');await page.waitForTimeout(250);
  const clipboard=await page.evaluate(async()=>{const [i]=await navigator.clipboard.read();return {html:await(await i.getType('text/html')).text(),plain:await(await i.getType('text/plain')).text()};});
  assert.match(clipboard.html,/<h1/);assert.match(clipboard.html,/<strong/);assert.match(clipboard.html,/<table/);assert.match(clipboard.html,/<svg/);assert.match(clipboard.html,/data:image\/png/);assert.ok(!clipboard.html.includes('sticker-item'));assert.ok(!clipboard.html.includes('shape-outside: url'));assert.match(clipboard.plain,/科学与生活/);
  await page.screenshot({path:`test-results/${channel}-zhihu.png`,fullPage:true});
  await page.selectOption('#publisher','wechat');assert.equal(await page.locator('#theme-name').innerText(),'宇宙来信');assert.equal(await page.locator('#preview .sticker-item').count(),1);
  await page.click('#export-toggle');const pending=page.waitForEvent('download');await page.click('#export-word');const file=await pending;const word=path.resolve(`test-results/${channel}-standard.docx`);await file.saveAs(word);
  const zip=unzipSync(await readFile(word)),xml=strFromU8(zip['word/document.xml']);assert.match(xml,/科学与生活/);assert.match(xml,/w:pStyle w:val="Heading1"/);assert.match(xml,/<w:b\/>/);assert.match(xml,/<w:tbl>/);assert.match(xml,/<w:numPr>/);assert.match(xml,/风来到纸上/);assert.match(xml,/标准文档注释/);assert.ok(Object.keys(zip).filter(n=>n.startsWith('word/media/')).length>=3);assert.ok(!xml.includes('宇宙来信'));
  const pdfs=[];
  for(const mode of ['standard','theme']){
   await page.click('#export-toggle');await page.click('#export-pdf');const pendingPopup=page.waitForEvent('popup');await page.click('#pdf-'+mode);const popup=await pendingPopup;await popup.waitForSelector('#print-now');await popup.waitForFunction(()=>[...document.images].every(i=>i.complete));
   assert.match(await popup.locator('.print-content').innerText(),/科学与生活/);if(mode==='standard')assert.equal(await popup.locator('.sticker-item').count(),0);
   const pdf=path.resolve(`test-results/${channel}-${mode}.pdf`);await popup.pdf({path:pdf,printBackground:true,preferCSSPageSize:true});pdfs.push(pdf);await popup.close();
  }
  await page.selectOption('#publisher','zhihu');await page.waitForTimeout(1300);await page.reload();await page.waitForSelector('.cm-content');assert.equal(await page.locator('#publisher').inputValue(),'zhihu');assert.equal(await page.locator('#preview-target').textContent(),'知乎样式');
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);reports.push({channel,version:browser.version(),pass:true,checks:['知乎无主题预览','实际 HTML 与纯文本剪贴板','切换保留主题与贴纸','Word 原生段落标题列表表格及内嵌图片公式','两种 PDF 打印布局','发布目标持久化','完全离线'],word,pdfs});console.log(channel+': document and Zhihu checks passed');
 }finally{await browser.close();}
}
await writeFile('test-results/documents-report.json',JSON.stringify(reports,null,2));
