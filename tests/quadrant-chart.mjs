import './workspace-driver.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { strFromU8, unzipSync } from 'fflate';

const channel=process.env.TEST_BROWSER||'chrome';
const dir=path.resolve(`test-results/quadrant-chart-${channel}`);
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel,headless:true,downloadsPath:dir});
const context=await browser.newContext({offline:true,viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
const page=await context.newPage();
const errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
const title='美少女音乐动画受众情感消费的双轴心理坐标定位';
const caption='图 2　日本美少女音乐动画情感消费心理坐标与范式迁徙模型';
const diagram=[
  '```mermaid','quadrantChart',`    title ${title}`,
  '    x-axis 零摩擦与平滑治愈 --> 高摩擦与关系重力',
  '    y-axis 面向受众的拟社会服务 --> 面向他者的关系性凝视',
  '    quadrant-1 "重力共谋场（裂痕验真 / 淬火共生）"',
  '    quadrant-2 "纯观照理想国（安全陪伴 / 氛围治愈）"',
  '    quadrant-3 "传统偶像工业（拟社会养成 / 完美奇迹）"',
  '    quadrant-4 "过渡性痛感消费（情绪宣泄 / 现实焦虑）"',
  '    "《偶像大师》": [0.16, 0.18]', '    "《LoveLive!》": [0.22, 0.28]',
  '    "《轻音少女》": [0.18, 0.68]', '    "《孤独摇滚！》": [0.48, 0.56]',
  '    "《吹响！上低音号》": [0.64, 0.78]', '    "《MyGO!!!!!》": [0.84, 0.86]',
  '    "《Girls Band Cry》": [0.82, 0.74]', '    "《Ave Mujica》": [0.94, 0.91]',
  '```','',`<p align=“center”><strong>${caption}</strong></p>`
].join('\n');
const source='# 四象限图测试\n\n'+diagram;
const image=page.locator('#preview .quadrant-figure img');
const replace=async text=>{
  await page.locator('.cm-content').focus();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText(text);
  await page.waitForFunction(text=>JSON.parse(localStorage.getItem('paper-recovery')).markdown===text,text);
};
const download=async selector=>{
  const pending=page.waitForEvent('download');
  await page.click(selector);
  const file=await pending;
  const target=path.join(dir,file.suggestedFilename());
  await file.saveAs(target);
  return readFile(target);
};

try{
  await page.goto(pathToFileURL(path.resolve('dist/非水·成章-离线公众号排版器.html')).href);
  await page.waitForSelector('.cm-content');
  await replace(source);
  await image.evaluate(img=>img.decode());
  const data=await image.evaluate(img=>({src:img.src,alt:img.alt,width:img.naturalWidth,fit:img.offsetWidth<=img.parentElement.clientWidth}));
  assert.match(data.src,/^data:image\/png;base64,/);
  assert.ok(data.width>=1440&&data.fit);
  for(const label of [title,'纯观照理想国','关系性凝视','偶像大师','LoveLive!','轻音少女','孤独摇滚','吹响','MyGO','Girls Band Cry','Ave Mujica'])assert.ok(data.alt.includes(label),label);
  const captionNode=page.locator('#preview .centered-caption');
  assert.equal(await captionNode.locator('strong').innerText(),caption);
  assert.equal(await captionNode.evaluate(node=>getComputedStyle(node).textAlign),'center');
  await page.locator('#preview .quadrant-figure').screenshot({path:path.join(dir,'preview.png'),animations:'disabled'});
  await page.click('#copy-button');
  await page.waitForFunction(()=>document.querySelector('#copy-button').dataset.state==='success');
  const html=await page.evaluate(async()=>await (await (await navigator.clipboard.read())[0].getType('text/html')).text());
  assert.match(html,/quadrant-figure/);
  assert.ok(html.includes(data.src)&&html.includes(caption));
  assert.doesNotMatch(html,/data-chart-action|复制图表 PNG|language-mermaid/);
  await page.click('[data-chart-action=copy]');
  await page.getByText('图表 PNG 已复制，可直接粘贴。',{exact:true}).waitFor();
  const mime=await page.evaluate(async()=>{const [item]=await navigator.clipboard.read();return {type:item.types[0],bytes:(await item.getType('image/png')).size};});
  assert.equal(mime.type,'image/png');
  assert.ok(mime.bytes>10000);
  const png=await download('[data-chart-action=download]');
  assert.deepEqual(png,Buffer.from(data.src.split(',')[1],'base64'));
  await page.click('#export-toggle');
  const independent=await download('#export-html');
  assert.ok(independent.toString().includes(data.src));
  await page.click('#export-toggle');
  const word=unzipSync(await download('#export-word'));
  const doc=strFromU8(word['word/document.xml']);
  assert.ok(doc.includes(caption));
  assert.match(doc,/w:jc w:val="center"/);
  assert.ok(Object.entries(word).some(([key,bytes])=>key.startsWith('word/media/')&&Buffer.from(bytes).equals(png)));
  await page.click('#export-toggle');
  await page.click('#export-pdf');
  const pendingPrint=page.waitForEvent('popup');
  await page.click('#pdf-standard');
  const print=await pendingPrint;
  await print.waitForSelector('#print-now');
  assert.equal(await print.locator('.quadrant-figure img').getAttribute('src'),data.src);
  const pdf=await print.pdf({printBackground:true,preferCSSPageSize:true});
  assert.ok(pdf.toString('latin1').includes('/Subtype /Image'));
  await print.close();
  await page.click('#export-toggle');
  assert.equal((await download('#export-md')).toString(),source);
  await replace(source.replace('[0.94, 0.91]','[1.94, 0.91]'));
  await page.locator('#preview .chart-error').filter({hasText:'第 19 行'}).waitFor();
  assert.equal(await image.count(),0);
  assert.equal(await page.locator('#preview pre code').count(),1);
  await replace('```mermaid\nflowchart TD\nA --> B\n```\n\n<p align="center" onclick="noop()"><strong>普通 HTML</strong></p>');
  await page.locator('#preview pre code').filter({hasText:'flowchart'}).waitFor();
  assert.equal(await page.locator('#preview .centered-caption,[onclick]').count(),0);
  await replace('# 从斜杠插入\n\n');
  await page.keyboard.press('Control+End');
  await page.keyboard.type('/quadrant');
  await page.getByRole('option',{name:/四象限图/}).waitFor();
  await page.keyboard.press('Enter');
  await image.evaluate(img=>img.decode());
  assert.deepEqual(errors,[]);
  assert.deepEqual(network,[]);
  console.log(`${channel}: screenshot syntax, PNG in rich clipboard, standalone clipboard and download, HTML, Word, PDF, source preservation, safe error and slash insertion passed`);
}finally{
  await browser.close();
}
