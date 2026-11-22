import './workspace-driver.mjs';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {unzipSync} from 'fflate';

const screenshotFlow = `flowchart LR
    A["第一阶段：舞台神话<br/>2005–2016<br/>《偶像大师》《LoveLive!》<br/>外部危机驱动 · 无瑕人设<br/>拟社会陪伴与正向奇迹"]
    B["第二阶段：空气系悬置<br/>2009–2015<br/>《轻音少女》<br/>零摩擦日常 · 放课后茶室<br/>萌要素数据库与温情治愈"]
    C["第三阶段：社恐过渡<br/>2022<br/>《孤独摇滚！》<br/>个体与世界摩擦 · 地下 Livehouse<br/>精神内耗喜剧化与微弱连接"]
    D["第四阶段：重力关系性<br/>2023–2025<br/>《MyGO!!!!!》《GBC》《Ave Mujica》<br/>内部剧烈撕扯 · 信息不对称<br/>裂痕真实性与反解共生"]
    A -->|"去竞争化 / 日常悬置"| B
    B -->|"焦虑回归 / 现实落地"| C
    C -->|"冲突内化 / 撕裂重构"| D`;
const cases = new Map([
  ['flowchart',screenshotFlow],['graph','graph TD\n A --> B'],
  ['sequence','sequenceDiagram\n Alice->>Bob: 你好\n Bob-->>Alice: 收到'],
  ['class','classDiagram\n Animal <|-- Cat'],['state','stateDiagram-v2\n [*] --> Running\n Running --> [*]'],
  ['ER','erDiagram\n AUTHOR ||--o{ ARTICLE : writes'],
  ['gantt','gantt\n title Writing\n dateFormat YYYY-MM-DD\n section Draft\n First :2026-11-20, 3d'],
  ['pie','pie title 篇幅\n "引言" : 20\n "主体" : 80'],
  ['journey','journey\n title Writing\n section Draft\n Outline: 3: Mei'],
  ['git','gitGraph\n commit\n branch draft\n checkout draft\n commit'],
  ['mindmap','mindmap\n root((写作))\n  草稿\n  提纲'],
  ['timeline','timeline\n title 历程\n 2024 : 草稿\n 2025 : 修订'],
  ['sankey','sankey-beta\nReading,Drafting,8\nDrafting,Editing,4'],
  ['XY','xychart-beta\n title "Writing"\n x-axis [A, B, C]\n y-axis "Words" 0 --> 10\n bar [1, 4, 9]\n line [2, 5, 8]'],
  ['block','block-beta\n columns 2\n A["Draft"] B["Review"]'],
  ['kanban','kanban\n todo[Todo]\n  task[Draft]'],
  ['architecture','architecture-beta\n service api(server)[API]\n service db(database)[Data]\n api:R -- L:db'],
  ['packet','packet-beta\n 0-7: "Type"\n 8-15: "Length"'],
  ['requirement','requirementDiagram\n requirement test_requirement {\n id: 1\n text: A requirement\n risk: high\n verifymethod: test\n }'],
  ['C4','C4Context\n Person(reader, "Reader")\n System(editor, "Editor")\n Rel(reader,editor,"Uses")'],
  ['quadrant styled','quadrantChart\n title Ranking\n A:::series: [0.3, 0.7]\n classDef series color: #2d5f92'],
  ['radar','radar-beta\n axis Speed, Range, Cost\n curve Draft{2,4,5}'],
  ['venn','venn-beta\n set A["素材"]\n set B["证据"]\n union A,B["可引用"]'],
  ['treemap','treemap-beta\n "文章"\n  "正文": 8\n  "图注": 2'],
  ['tree view','treeView-beta\n  drafts/\n    article.md\n  images/'],
  ['railroad','railroad-beta\n token = sequence(terminal("a"), optional(terminal("b")));'],
]);

const channel=process.env.TEST_BROWSER||'chrome',dir=path.resolve(`test-results/mermaid-${channel}`);
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel,headless:true,downloadsPath:dir});
const ctx=await browser.newContext({offline:true,viewport:{width:1420,height:900},permissions:['clipboard-read','clipboard-write']});
const page=await ctx.newPage();
page.on('pageerror',e=>console.error(e));
const network=[];page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
const fence=source=>'```mermaid\n'+source+'\n```';
const artifact='dist/非水·成章-离线公众号排版器.html';
const edit=async text=>{
  await page.locator('.cm-content').focus();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);
  await page.waitForFunction(text=>JSON.parse(localStorage.getItem('paper-recovery')).markdown===text,text);
};
try {
  await page.goto(pathToFileURL(path.resolve(artifact)).href);
  await page.waitForSelector('.cm-content');
  assert.equal(await page.locator('#offline-module-mermaid').getAttribute('data-loaded'),null);
  await edit(fence('flowchart LR\n A["开始复制"] --> B["随正文带图"]'));
  await page.click('#copy-button');
  await page.waitForFunction(()=>document.querySelector('#copy-button').dataset.state==='success');
  assert.match(await page.evaluate(async()=>await(await(await navigator.clipboard.read())[0].getType('text/html')).text()),/data:image\/png;base64,/);
  await edit([...cases.values()].map(fence).join('\n\n'));
  await page.waitForFunction(count=>document.querySelectorAll('#preview [data-mermaid-state]').length===count,cases.size,{timeout:90000});
  const results=await page.locator('#preview .mermaid-figure').evaluateAll(nodes=>nodes.map(node=>({state:node.dataset.mermaidState,error:node.querySelector('.mermaid-status')?.textContent,src:node.querySelector('img')?.src.slice(0,22),width:node.querySelector('img')?.naturalWidth,height:node.querySelector('img')?.naturalHeight})));
  for(const [i,name] of [...cases.keys()].entries())console.log(name,results[i]);
  for(const [i,name] of [...cases.keys()].entries()){
    assert.equal(results[i].state,'ready',`${name}: ${results[i].error}`);
    assert.match(results[i].src,/^data:image\/png/);
    assert.ok(results[i].width>10&&results[i].height>10);
  }
  await page.locator('#preview .mermaid-figure').first().screenshot({path:path.join(dir,'flowchart-preview.png')});
  const first=page.locator('#preview .mermaid-figure').first();
  const wideImage=await first.locator('img').getAttribute('src');
  await writeFile(path.join(dir,'flowchart.png'),Buffer.from(wideImage.split(',')[1],'base64'));
  await first.locator('[data-chart-action=view]').click();
  await page.locator('.mermaid-large img').waitFor();
  assert.equal(await page.locator('.mermaid-large img').getAttribute('src'),wideImage);
  assert.ok(await page.locator('.mermaid-large').evaluate(node=>node.scrollWidth>node.clientWidth));
  await page.click('#modal-close');
  await first.locator('[data-chart-action=copy]').click();
  await page.getByText('图表 PNG 已复制，可直接粘贴。',{exact:true}).waitFor();
  assert.ok(await page.evaluate(async()=>(await navigator.clipboard.read())[0].types.includes('image/png')));
  const source='# Mermaid\n\n'+fence(screenshotFlow)+'\n\n'+fence(cases.get('sequence'));
  await edit(source);
  await page.click('#copy-button');
  await page.waitForFunction(()=>document.querySelector('#copy-button').dataset.state==='success');
  const html=await page.evaluate(async()=>await(await(await navigator.clipboard.read())[0].getType('text/html')).text());
  assert.equal((html.match(/data:image\/png;base64,/g)||[]).length,2);
  assert.doesNotMatch(html,/data-mermaid-source|复制图表 PNG/);
  await page.click('#export-toggle');
  const pending=page.waitForEvent('download');await page.click('#export-word');
  const file=await pending,filename=path.join(dir,file.suggestedFilename());await file.saveAs(filename);
  assert.equal(Object.keys(unzipSync(await readFile(filename))).filter(key=>key.startsWith('word/media/')&&key.endsWith('.png')).length,2);
  await page.click('#export-toggle');
  await page.click('#export-pdf');
  const pendingPrint=page.waitForEvent('popup');await page.click('#pdf-standard');
  const print=await pendingPrint;await print.waitForSelector('#print-now');
  assert.equal(await print.locator('.mermaid-figure img').count(),2);
  assert.ok((await print.pdf()).toString('latin1').includes('/Subtype /Image'));
  await print.close();
  await edit(fence('flowchart TD\n A --> ['));
  await page.locator('#preview .mermaid-figure[data-mermaid-state=error]').waitFor();
  assert.match(await page.locator('#preview .mermaid-fallback').innerText(),/A --> \[/);
  await page.locator('#render-state').filter({hasText:'1 处待检查'}).waitFor();
  assert.deepEqual(network,[]);
  console.log(`${channel}: ${cases.size} Mermaid examples, cold clipboard, large view, PNG clipboard, Word/PDF and malformed source passed`);
} finally {await browser.close();}
