import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';

await mkdir('test-results/browser-temp',{recursive:true});
process.env.TEMP=process.env.TMP=process.env.TMPDIR=path.resolve('test-results/browser-temp');
const url=pathToFileURL(path.resolve('dist/纸间-离线公众号排版器.html')).href;
const results=[];
async function run(channel){
  const browser=await chromium.launch({channel,headless:true,downloadsPath:path.resolve('test-results/browser-temp')});
  const context=await browser.newContext({viewport:{width:1440,height:1000},offline:true,permissions:['clipboard-read','clipboard-write'],acceptDownloads:true});
  const cdp=await browser.newBrowserCDPSession();
  const {browserContextIds}=await cdp.send('Target.getBrowserContexts');
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:path.resolve('test-results/browser-temp'),browserContextId:browserContextIds[0],eventsEnabled:true});
  const page=await context.newPage();const runtimeErrors=[],network=[];
  page.on('pageerror',e=>runtimeErrors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});page.on('dialog',d=>d.accept());
  const checks=[];const pass=(name,detail)=>{checks.push({name,pass:true,...(detail?{detail}:{})});console.log(`${channel}: ${name}${detail?' '+JSON.stringify(detail):''}`);};
  const close=async()=>{if(await page.locator('#modal').evaluate(el=>el.open))await page.click('#modal-close');};
  const setText=async text=>{await close();await page.locator('.cm-content').click();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await page.waitForTimeout(380);};
  const saved=async()=>page.waitForFunction(()=>document.getElementById('save-state').textContent.includes('已保存到浏览器'),{},{timeout:10000});
  const getDownload=async(fn,name)=>{const pending=page.waitForEvent('download');await fn();const file=await pending;const location=path.resolve('test-results',`${channel}-${name}`);await file.saveAs(location);return location;};
  try{
    await page.goto(url);await page.waitForSelector('.cm-content');await saved();
    assert.equal(await page.locator('#preview .math-error').count(),0);assert.ok(await page.locator('#preview svg').count()>=6);assert.equal(network.length,0);
    pass('首次打开完全离线，公式与编辑器正常');
    await page.screenshot({path:`test-results/${channel}-workspace.png`,fullPage:true});

    await page.click('#samples-button');await page.click('[data-sample="math"]');await page.waitForTimeout(350);
    assert.equal(await page.locator('#preview .math-error').count(),0);assert.ok(await page.locator('#preview .math-display').count()>=5);
    await page.locator('#preview-scroll').evaluate(el=>el.scrollTop=el.scrollHeight/2);await page.waitForTimeout(150);
    await page.screenshot({path:`test-results/${channel}-formulas.png`,fullPage:true});pass('积分、矩阵、多行推导与编号');

    await page.click('#samples-button');await page.click('[data-sample="poetry"]');
    assert.ok((await page.locator('#preview .poem').textContent()).includes('\n\n'));assert.equal(await page.locator('#preview .poem').evaluate(el=>getComputedStyle(el).textAlign),'center');pass('诗行和诗节空行完整保留');
    await page.screenshot({path:`test-results/${channel}-poetry.png`,fullPage:true});

    const text='# 离线验收文章\n\n## 第一节\n\n这是一段**加粗**与普通正文。行内公式 $E=mc^2$。\n\n> 引用与留白\n\n$$\n\\frac{1}{2}+\\sqrt{x}\n$$\n\n| 内容 | 数值 |\n| --- | --- |\n| 表格 | 42 |\n\n```js\nconst answer = 42;\n```\n\n:::poem left\n第一行\n第二行\n\n第二节\n:::\n\n脚注示例[^a]。\n\n[^a]: 注释内容。';
    await setText(text);
    await page.locator('#document-title').fill('离线验收文章');await saved();
    await page.click('#theme-button');assert.ok(await page.locator('[data-theme]').count()>=39);assert.ok(await page.locator('[data-theme="folio"]').count());
    await page.screenshot({path:`test-results/${channel}-theme-gallery.png`,fullPage:true});
    const ids=await page.locator('[data-theme]').evaluateAll(els=>els.map(el=>el.dataset.theme));
    await close();
    const styles=[];
    for(const id of ids){await page.click('#theme-button');await page.click(`[data-theme="${id}"]`);await page.waitForTimeout(40);const info=await page.locator('#preview').evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,heading:getComputedStyle(el.querySelector('h2')).cssText,color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));assert.ok(info.scrollWidth<=info.width+2,`${id} overflows`);assert.equal(await page.locator('#preview .math-error').count(),0);styles.push({id,...info});}
    assert.ok(new Set(styles.map(s=>s.background+s.color)).size>=15);pass(ids.length+' 套主题在电脑文章预览中无整体横向溢出');
    for(const value of ['dark','light','github','dracula','monokai','solarized']){await page.selectOption('#editor-theme',value);const bg=await page.locator('.cm-editor').evaluate(el=>getComputedStyle(el).backgroundColor);assert.notEqual(bg,'rgba(0, 0, 0, 0)');}
    await page.selectOption('#editor-theme','dark');pass('六套编辑器配色独立切换');
    await page.click('#style-button');await page.locator('#setting-size').fill('18');await page.locator('#setting-size').dispatchEvent('input');assert.equal(await page.locator('#preview').evaluate(el=>getComputedStyle(el).fontSize),'18px');await page.click('#style-close');pass('排版设置即时生效');

    const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=360;const x=c.getContext('2d');x.fillStyle='#315e53';x.fillRect(0,0,640,360);x.fillStyle='#f2efd7';x.font='40px serif';x.fillText('OFFLINE IMAGE',140,185);return c.toDataURL('image/png');});
    const imagePath=path.resolve(`test-results/${channel}-fixture.png`);await writeFile(imagePath,Buffer.from(png.split(',')[1],'base64'));
    await page.locator('.cm-content').click();await page.keyboard.press('Control+End');
    await page.evaluate(async data=>{const blob=await(await fetch(data)).blob();await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);},png);
    await page.keyboard.press('Control+v');await page.waitForSelector('#preview img');
    assert.ok((await page.locator('.cm-content').innerText()).includes('asset:'));pass('实际系统剪贴板粘贴图片');
    await page.locator('#image-input').setInputFiles(imagePath);await page.waitForFunction(()=>document.querySelectorAll('#preview img').length===2);pass('本地文件插图');
    await page.click('#assets-button');await page.locator('[data-asset-field="caption"]').first().fill('离线图片图注');await page.locator('[data-asset-field="caption"]').first().dispatchEvent('change');await close();assert.ok((await page.locator('#preview').innerText()).includes('离线图片图注'));
    await page.click('#assets-button');const formulaPNG=await getDownload(()=>page.locator('[data-png]').first().click(),'formula.png');assert.ok((await readFile(formulaPNG)).length>500);await close();pass('图片图注与公式高清 PNG 导出');

    await page.click('#export-toggle');const backup=await getDownload(()=>page.click('#export-backup'),'article.zip');const files=unzipSync(new Uint8Array(await readFile(backup)));const manifest=JSON.parse(strFromU8(files['manifest.json']));assert.equal(manifest.version,1);assert.equal(manifest.articles.length,1);assert.equal(manifest.assets.length,2);assert.ok(Object.keys(files).some(n=>n.startsWith('assets/')));pass('备份包含正文、原图、排版设置及版本');
    const before=await page.locator('#preview').innerText();
    await page.locator('#import-input').setInputFiles(backup);await page.waitForTimeout(450);await saved();assert.equal(await page.locator('#preview').innerText(),before);assert.equal(await page.locator('#preview img').count(),2);assert.equal(await page.locator('#preview').evaluate(el=>getComputedStyle(el).fontSize),'18px');pass('备份重导入完整恢复，重映射图片引用');
    await page.reload();await page.waitForSelector('.cm-content');assert.equal(await page.locator('#preview img').count(),2);assert.equal(await page.locator('#document-title').inputValue(),'离线验收文章');pass('关闭页面重开后恢复本地草稿');

    await page.click('#export-toggle');const html=await getDownload(()=>page.click('#export-html'),'article.html');const htmlText=await readFile(html,'utf8');assert.ok(htmlText.includes('data:image/png;base64'));assert.ok(htmlText.includes('<svg'));assert.ok(!htmlText.includes('<script'));
    const exported=await context.newPage();await exported.goto(pathToFileURL(html).href);assert.equal(await exported.locator('img').count(),2);assert.ok(await exported.locator('svg').count()>0);assert.equal(await exported.locator('img').first().evaluate(el=>el.complete&&el.naturalWidth>0),true);await exported.screenshot({path:`test-results/${channel}-export.png`,fullPage:true});await exported.close();pass('独立 HTML 完全离线包含图片、公式和内联排版');

    await page.click('#copy-button');await page.click('#continue-copy');await page.waitForTimeout(300);
    const clipboard=await page.evaluate(async()=>{const items=await navigator.clipboard.read();const item=items[0];return {types:item.types,html:item.types.includes('text/html')?await(await item.getType('text/html')).text():'',text:item.types.includes('text/plain')?await(await item.getType('text/plain')).text():''};});
    assert.ok(clipboard.types.includes('text/html'));assert.ok(clipboard.types.includes('text/plain'));assert.ok(clipboard.html.includes('font-size'));assert.ok(!clipboard.html.includes('data-line'));assert.ok(clipboard.text.includes('离线验收文章'));pass('实际剪贴板同时包含富文本与纯文本');

    await page.evaluate(()=>{window.__originalWrite=navigator.clipboard.write.bind(navigator.clipboard);Object.defineProperty(navigator.clipboard,'write',{configurable:true,value:()=>Promise.reject(new Error('test denied'))});});
    await page.click('#copy-button');await page.click('#continue-copy');await page.waitForSelector('#manual-copy');await page.click('#select-copy');assert.ok(await page.evaluate(()=>getSelection().toString().includes('离线验收文章')));await close();await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'write',{configurable:true,value:window.__originalWrite}));pass('拒绝剪贴板权限时提供手动复制');

    await setText('# 错误公式\n\n$$\n\\frac{1}\n$$\n\n正常段落仍然显示。');assert.ok(await page.locator('#preview .math-error').count()>0);assert.ok((await page.locator('#preview').innerText()).includes('正常段落'));pass('公式错误提示不阻断全文');
    await setText('# 安全输入\n\n<script>window.pwned=1</script>\n\n[危险](javascript:alert(1))\n\n<img src=x onerror="window.pwned=2">');assert.equal(await page.evaluate(()=>window.pwned),undefined);assert.equal(await page.locator('#preview script,#preview [onerror],#preview a[href^="javascript:"]').count(),0);pass('原始 HTML 与危险链接不可执行');

    const bad=path.resolve(`test-results/${channel}-bad.zip`);await writeFile(bad,'not a zip');const titleBefore=await page.locator('#document-title').inputValue();await page.locator('#import-input').setInputFiles(bad);await page.waitForTimeout(150);assert.equal(await page.locator('#document-title').inputValue(),titleBefore);assert.ok(await page.locator('#toast').evaluate(el=>el.classList.contains('error')));pass('损坏备份不修改当前文章');

    const imageReference=manifest.articles[0].markdown.match(/asset:[a-zA-Z0-9-]+/)[0];
    let longText='# 长文性能与定位测试\n\n';
    for(let i=0;i<100;i++)longText+=`## 第 ${String(i).padStart(3,'0')} 节\n\n编号${String(i).padStart(3,'0')}。`+'这是一段用于测试的科学观察记录。我们关注自然界的变化，也关注证据和解释之间的关系。'.repeat(5)+`\n\n${i<30?`$$\nx_{${i}}=\\frac{${i+1}}{2}+\\sqrt{${i+2}}\n$$\n\n`:''}${i<20?`![插图](${imageReference})\n\n`:''}`;
    const t0=Date.now();await setText(longText);await page.waitForFunction(()=>document.querySelectorAll('#preview h2').length===100);const coldMS=Date.now()-t0;const renderMS=Number(await page.locator('#render-state').getAttribute('data-duration'));assert.equal(await page.locator('#preview .math-display').count(),30);assert.equal(await page.locator('#preview img').count(),20);pass('2 万字、30 公式、20 图片长文渲染',{renderMS,coldUIWaitMS:coldMS,characters:longText.length});
    await page.locator('.cm-content').click();await page.keyboard.press('Control+Home');const start=Date.now();await page.keyboard.insertText('性能编辑标记\n');await page.waitForFunction(()=>document.getElementById('preview').textContent.includes('性能编辑标记'));const latency=Date.now()-start;pass('长文普通编辑更新延迟',{latencyMS:latency,targetMS:500});assert.ok(latency<1000,'editing takes over 1 second');
    const sourceScroll=page.locator('.cm-scroller');
    for(const fraction of [.2,.5,.8]){
      await page.waitForTimeout(120);await sourceScroll.evaluate((el,f)=>el.scrollTop=(el.scrollHeight-el.clientHeight)*f,fraction);await page.waitForTimeout(180);
      const matching=await page.evaluate(()=>{
        const cm=document.querySelector('.cm-scroller'),preview=document.getElementById('preview-scroll');
        const topSource=cm.getBoundingClientRect().top,topPreview=preview.getBoundingClientRect().top;
        const cmLine=[...document.querySelectorAll('.cm-line')].find(el=>el.getBoundingClientRect().bottom>topSource+10&&/编号\d+/.test(el.textContent));
        const p=[...document.querySelectorAll('#preview p')].find(el=>el.getBoundingClientRect().bottom>topPreview+10&&/编号\d+/.test(el.textContent));
        return {source:cmLine?.textContent.match(/编号(\d+)/)?.[1],preview:p?.textContent.match(/编号(\d+)/)?.[1],scroll:preview.scrollTop};
      });
      assert.ok(matching.scroll>0);assert.ok(Math.abs(Number(matching.source)-Number(matching.preview))<=2,JSON.stringify(matching));
    }
    pass('长文源段落定位同步（20%、50%、80%）');
    await page.waitForTimeout(150);await page.locator('#preview-scroll').evaluate(el=>el.scrollTop=el.scrollHeight*.45);await page.waitForTimeout(150);assert.ok(await sourceScroll.evaluate(el=>el.scrollTop>100));pass('预览反向滚动同步');
    await page.click('#sync-button');const scrollBefore=await sourceScroll.evaluate(el=>el.scrollTop);await page.locator('#preview-scroll').evaluate(el=>el.scrollTop=0);await page.waitForTimeout(100);assert.equal(await sourceScroll.evaluate(el=>el.scrollTop),scrollBefore);await page.click('#sync-button');pass('关闭同步后两栏独立滚动');

    await page.click('#library-button');await page.click('#new-article');await page.click('#undo-button');assert.ok(!(await page.locator('#preview').innerText()).includes('编号099'));pass('新文章撤销历史不泄漏其他文章正文');
    await page.locator('#document-title').fill('回收站验证');await setText('# 回收站验证\n\n保留这段内容。');await saved();await page.locator('.article-item.current [data-action="delete"]').click();await page.click('#trash-tab');assert.ok((await page.locator('#article-list').innerText()).includes('回收站验证'));await page.locator('[data-action="restore"]').first().click();await page.click('#active-tab');assert.ok((await page.locator('#article-list').innerText()).includes('回收站验证'));pass('删除进入回收站并可恢复');

    await page.evaluate(()=>{window.__put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Quota exceeded','QuotaExceededError');};});
    await setText('# 存储故障仍保留正文\n\n请导出备份。');await page.waitForFunction(()=>document.getElementById('save-state').textContent.includes('保存失败'));assert.ok((await page.locator('#preview').innerText()).includes('存储故障'));await page.evaluate(()=>IDBObjectStore.prototype.put=window.__put);pass('存储失败不丢失编辑内容，不误报保存成功');
    assert.equal(network.length,0);assert.deepEqual(runtimeErrors,[]);pass('全程无外部网络请求、无未捕获脚本错误');
    results.push({browser:channel,version:browser.version(),checks,metrics:{renderMS,editLatencyMS:latency,chars:longText.length},passed:true});
  }catch(e){
    await page.screenshot({path:`test-results/${channel}-failure.png`,fullPage:true});
    results.push({browser:channel,checks,passed:false,error:e.stack,runtimeErrors});throw e;
  }finally{await browser.close();await writeFile('test-results/report.json',JSON.stringify(results,null,2));}
}
for(const channel of ['chrome','msedge'])await run(channel);
