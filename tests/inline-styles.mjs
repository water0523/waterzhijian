import {pickerChoose,pickerSize,pickerColor} from './picker-helpers.mjs';
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
await mkdir('test-results/inline-temp',{recursive:true});
process.env.TEMP=process.env.TMP=process.env.TMPDIR=path.resolve('test-results/inline-temp');
const channel=process.env.STYLE_BROWSER||'chrome',checks=[];
const browser=await chromium.launch({channel,headless:true,downloadsPath:process.env.TEMP});
const context=await browser.newContext({offline:true,viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write'],acceptDownloads:true});
const cdp=await browser.newBrowserCDPSession();const {browserContextIds}=await cdp.send('Target.getBrowserContexts');await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',browserContextId:browserContextIds[0],downloadPath:process.env.TEMP,eventsEnabled:true});
const page=await context.newPage(),errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});page.on('dialog',d=>d.accept());
const check=label=>{checks.push(label);console.log('PASS '+label);};
const source=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('paper-recovery')).markdown);
const setText=async text=>{await page.locator('.cm-content').click();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);await page.waitForTimeout(320);};
const selectParagraph=async()=>{await page.locator('.cm-content').click();await page.keyboard.press('Control+Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Home');await page.keyboard.press('Shift+End');await page.waitForTimeout(70);};
try{
 await page.goto(pathToFileURL(path.resolve('dist/纸间-离线公众号排版器.html')).href);await page.waitForSelector('.cm-content');
 await setText('# 选区样式\n\n中英文字 English ABC\n\n后一段。');await selectParagraph();await page.click('#selection-style-button');
 assert.equal(await page.locator('#quick-popover [role=menuitemradio]').count(),10);await page.keyboard.press('Escape');
 await pickerChoose(page,'font','kai');await pickerSize(page,20);await pickerColor(page,'#336699');
 for(const key of ['bold','italic','wave','strike'])await pickerChoose(page,'effect',key);
 await page.click('#inline-effect-button');await page.screenshot({path:`test-results/inline-style-dialog-${channel}.png`,fullPage:true});await page.keyboard.press('Escape');await page.waitForTimeout(300);
 assert.match(await source(),/\[中英文字 English ABC\]\{font=kai size=20 color=#336699 bold italic wave strike\}/);
 const styled=page.locator('#preview .inline-style').first();let css=await styled.evaluate(el=>{const s=getComputedStyle(el);return {font:s.fontFamily,size:s.fontSize,color:s.color,weight:s.fontWeight,italic:s.fontStyle,line:s.textDecorationLine,style:s.textDecorationStyle};});
 assert.match(css.font,/KaiTi/);assert.equal(css.size,'20px');assert.equal(css.color,'rgb(51, 102, 153)');assert.equal(css.weight,'700');assert.equal(css.italic,'italic');assert.equal(css.line,'underline line-through');assert.equal(css.style,'wavy');check('font/size/color/bold/italic/wavy/strike applied only to selected text');
 await page.click('#inline-style-button');assert.equal(await page.locator('[data-picker-font="kai"]').getAttribute('aria-checked'),'true');await page.keyboard.press('Escape');await page.click('#inline-effect-button');assert.equal(await page.locator('[data-inline-effect="wave"]').count(),0);assert.equal(await styled.evaluate(n=>getComputedStyle(n).textDecorationStyle),'wavy');await page.keyboard.press('Escape');await pickerChoose(page,'font','song');assert.equal(await page.locator('#preview .inline-style').count(),1);await pickerChoose(page,'font','kai');check('editing the same selection updates its style without nesting duplicate wrappers');
 await page.click('#theme-button');await page.click('[data-theme="kuromi"]');assert.equal(await styled.evaluate(el=>getComputedStyle(el).color),'rgb(51, 102, 153)');check('explicit text formatting survives theme switch');
 await page.click('#preview-edit-button');await page.locator('#preview .inline-style [contenteditable]').fill('改过的文字 English');assert.match(await source(),/\[改过的文字 English\]\{font=kai size=20 color=#336699 bold italic wave strike\}/);await page.click('#preview-edit-button');check('preview text edit retains style directives');
 await page.click('#copy-button');await page.waitForTimeout(150);let copied=await page.evaluate(async()=>{const [i]=await navigator.clipboard.read();return(await i.getType('text/html')).text();});assert.match(copied,/font-family: KaiTi/);assert.match(copied,/wavy/);assert.doesNotMatch(copied,/data-inline-|\{font=kai/);check('clipboard HTML contains real inline styles, no source directives');
 await page.click('#export-toggle');const pending=page.waitForEvent('download');await page.click('#export-word');const file=await pending;const wordPath=path.resolve(`test-results/inline-${channel}.docx`);await file.saveAs(wordPath);const entries=unzipSync(new Uint8Array(await readFile(wordPath)));const xml=strFromU8(entries['word/document.xml']);
 assert.match(xml,/w:eastAsia="KaiTi"/);assert.match(xml,/<w:u w:val="wave"/);assert.match(xml,/<w:strike/);assert.match(xml,/<w:color w:val="336699"/);assert.match(xml,/<w:sz w:val="30"/);check('Word keeps native editable font, color, size, underline and strike properties');
 if(await page.locator('#modal').evaluate(el=>el.open))await page.click('#modal-close');
 await page.waitForTimeout(1100);await page.reload();await page.waitForSelector('.cm-content');assert.equal(await page.locator('#preview .inline-style').first().evaluate(el=>getComputedStyle(el).fontSize),'20px');check('local save restores selected text styles');
 for(const [action,pattern] of [['underline',/\]\{underline\}/],['wave',/\]\{wave\}/],['strike',/~~中英文字~~/]]){
  await setText('# 操作\n\n中英文字');await selectParagraph();await page.locator(`#selection-tools [data-format="${action}"]`).click();assert.match(await source(),pattern);await page.waitForTimeout(250);
  await page.locator(`#selection-tools [data-format="${action}"]`).click();assert.equal(await source(),'# 操作\n\n中英文字');
 }
 check('underline/wave/strike toolbar actions write supported Markdown');
 await setText('# 字体检查\n\n'+['yahei','song','hei','kai','fang','arial','times','georgia','consolas'].map(id=>`[中文 English]{font=${id}}`).join('、'));
 assert.equal(await page.locator('#preview .inline-style').count(),9);check('nine Chinese and Latin font choices render offline');
 await setText('# 安全与嵌套\n\n[外层 **加粗** 与 [内层]{color=#112233}](https://example.com)\n\n[样式 **加粗** 和 $x^2$]{font=song underline}\n\n[拒绝]{font=unknown color=red}\n\n[拒绝]{color=#123456;position=fixed}\n\n[拒绝]{font=arial onclick=alert(1)}');
 assert.equal(await page.locator('#preview .inline-style').count(),2);assert.equal(await page.locator('#preview .math-error').count(),0);assert.equal(await page.locator('#preview .inline-style .math-inline').count(),1);assert.equal(await page.locator('#preview [onclick],#preview script').count(),0);assert.ok((await page.locator('#preview').innerText()).includes('onclick=alert(1)'));check('nested formatting and formulas work; unapproved CSS and event attributes rejected');
 await setText('# 彩色半高荧光\n\n[半高颜色]{marker=#a371d8} 与 **[混合样式]{marker=#bfdbfe}**');await page.click('#copy-button');await page.waitForTimeout(150);copied=await page.evaluate(async()=>{const [i]=await navigator.clipboard.read();return(await i.getType('text/html')).text();});assert.match(copied,/linear-gradient/);assert.match(copied,/163, 113, 216/);assert.doesNotMatch(copied,/data-inline-marker/);await page.click('#export-toggle');const markerPending=page.waitForEvent('download');await page.click('#export-word');const markerFile=await markerPending;const markerPath=path.resolve(`test-results/marker-${channel}.docx`);await markerFile.saveAs(markerPath);const markerXML=strFromU8(unzipSync(await readFile(markerPath))['word/document.xml']);assert.match(markerXML,/w:fill="a371d8"/i);assert.match(markerXML,/w:fill="bfdbfe"/i);check('colored half-highlights retain real gradients in clipboard HTML and editable color shading in standard Word');
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);await writeFile(`test-results/inline-styles-${channel}.json`,JSON.stringify({channel,checks,errors,network},null,2));
}finally{await browser.close();}
