import {offlineCode} from './offline-modules';

export const flowchartSnippet = '```mermaid\nflowchart LR\n    A["整理思路<br/>写下草稿"] --> B["通读与修改"]\n    B --> C["完成发布"]\n```';
export function mermaidMarkup(fallback:string, start:number, end:number, editable:boolean){
  return `<figure class="mermaid-figure" data-mermaid-source="true" data-line="${start}" data-end="${end}" style="margin:1.2em 0 .5em;text-align:center;break-inside:avoid">
    <p class="mermaid-status" role="status" style="color:inherit;text-indent:0">正在绘制 Mermaid 图表…</p>
    <div class="mermaid-fallback" hidden>${fallback}</div>
    ${editable ? '<div class="chart-actions" data-editor-only="true" hidden><button type="button" data-chart-action="view">查看大图</button><button type="button" data-chart-action="copy">复制图表 PNG</button><button type="button" data-chart-action="download">下载 PNG</button></div>' : ''}
  </figure>`;
}

type Raster = {src:string;alt:string;width:number;height:number};
let connection: Promise<{frame:HTMLIFrameElement;port:MessagePort}> | undefined;
let serial = 0;
let queue: Promise<unknown> = Promise.resolve();

function connect() {
  if (connection) return connection;
  connection = new Promise((resolve,reject) => {
    const program = offlineCode('mermaid');
    const frame = document.createElement('iframe');
    frame.title = '离线 Mermaid 渲染';
    frame.setAttribute('sandbox','allow-scripts');
    frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:1200px;height:900px;border:0;pointer-events:none';
    frame.setAttribute('aria-hidden','true');
    frame.tabIndex = -1;
    const nonce = crypto.randomUUID().replaceAll('-','');
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      frame.remove(); channel.port1.close(); reject(new Error('离线 Mermaid 渲染器启动超时。'));
    },15000);
    channel.port1.onmessage = ({data}) => {
      if (data?.ready !== true) return;
      clearTimeout(timeout);
      resolve({frame,port:channel.port1});
    };
    frame.onload = () => frame.contentWindow?.postMessage('paper-mermaid-connect','*',[channel.port2]);
    // No remote scripts, icons, fonts, links, fetches or navigable SVG enter the app.
    const policy = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; worker-src blob:`;
    frame.srcdoc = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><body><script nonce="${nonce}">globalThis.__feishuiOfflineModules={};${program.replace(/<\/script/gi,'<\\/script')}</script>`;
    document.body.append(frame);
  });
  connection.catch(() => { connection = undefined; });
  return connection;
}

async function getSVG(source:string):Promise<string>{
  const {port,frame} = await connect();
  return new Promise((resolve,reject) => {
    const id = ++serial;
    const timeout = window.setTimeout(() => {
      frame.remove(); port.close(); connection = undefined;
      reject(new Error('图表绘制超时，请减少节点或改用简单布局。'));
    },15000);
    port.onmessage = ({data}) => {
      if(data?.id !== id) return;
      clearTimeout(timeout);
      if(typeof data.svg === 'string') resolve(data.svg);
      else reject(new Error(typeof data.error === 'string' ? data.error : 'Mermaid 渲染失败。'));
    };
    port.postMessage({id,source});
  });
}

async function toRaster(markup:string):Promise<Raster>{
  const xml = new DOMParser().parseFromString(markup,'image/svg+xml');
  const svg = xml.documentElement;
  if(svg.localName !== 'svg' || svg.namespaceURI !== 'http://www.w3.org/2000/svg') throw new Error('Mermaid 没有返回有效的图表。');
  const box = svg.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number);
  const width = box?.[2] || parseFloat(svg.getAttribute('width') || '');
  const height = box?.[3] || parseFloat(svg.getAttribute('height') || '');
  if(!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Mermaid 图表没有有效尺寸。');
  // Render only as an inert image, never insert the engine's SVG into the page.
  // Internal marker references survive, while external files and links do not.
  svg.querySelectorAll('script,iframe,object,embed').forEach(node=>node.remove());
  // Older diagram layouts may include an HTML label even with htmlLabels off.
  // Chromium taints canvases with foreignObject, so use SVG text for those labels.
  for(const foreign of svg.querySelectorAll('foreignObject')){
    if(foreign.parentElement?.localName==='switch'&&[...foreign.parentElement.children].some(node=>node.localName==='text')){foreign.remove();continue;}
    const read=(node:Node):string=>node.nodeType===3?node.textContent||'':node instanceof Element&&node.localName.toLowerCase()==='br'?'\n':[...node.childNodes].map(read).join('');
    const lines=read(foreign).trim().split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    if(!lines.length){foreign.remove();continue;}
    const attr=(name:string)=>parseFloat(foreign.getAttribute(name)||'0')||0;
    const x=attr('x')+attr('width')/2,y=attr('y')+attr('height')/2;
    const fontSize=Math.min(16,Math.max(8,attr('height')/(lines.length*1.18)));
    const text=xml.createElementNS(svg.namespaceURI,'text');
    text.setAttribute('text-anchor','middle');text.setAttribute('dominant-baseline','central');
    text.setAttribute('style',`font-family:"Microsoft YaHei",sans-serif;font-size:${fontSize}px`);
    if(foreign.hasAttribute('transform'))text.setAttribute('transform',foreign.getAttribute('transform')!);
    for(const [index,line] of lines.entries()){
      const span=xml.createElementNS(svg.namespaceURI,'tspan');span.setAttribute('x',String(x));
      span.setAttribute('y',String(y+(index-(lines.length-1)/2)*fontSize*1.15));span.textContent=line;text.append(span);
    }
    foreign.replaceWith(text);
  }
  for(const node of [svg,...svg.querySelectorAll('*')])for(const attribute of [...node.attributes]){
    if(/^on/i.test(attribute.name)||['href','src'].includes(attribute.localName)&&!attribute.value.startsWith('#')) node.removeAttributeNode(attribute);
  }
  const alt = (svg.querySelector('title')?.textContent || svg.getAttribute('aria-roledescription') || 'Mermaid 图表').trim();
  if(svg.getAttribute('aria-roledescription')?.startsWith('flowchart')){
    const edgeLabels=xml.createElementNS(svg.namespaceURI,'style');
    edgeLabels.textContent='.edgeLabel rect,.edgeLabel .labelBkg{opacity:1!important}';
    svg.append(edgeLabels);
  }
  const scale = Math.min(3, 4096/Math.max(width,height), Math.sqrt(10_000_000/(width*height)));
  const w = Math.max(1,Math.round(width*scale)), h = Math.max(1,Math.round(height*scale));
  svg.setAttribute('width',String(w)); svg.setAttribute('height',String(h));
  svg.removeAttribute('style');
  if(!box || box.length!==4) svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
  const canvas = document.createElement('canvas');
  try {
    const image = new Image(); image.src = url; await image.decode();
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器无法生成图表 PNG。');
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h); ctx.drawImage(image,0,0,w,h);
    return {src:canvas.toDataURL('image/png'),alt,width:Math.ceil(width),height:Math.ceil(height)};
  } finally { canvas.width = 1; canvas.height = 1; URL.revokeObjectURL(url); }
}

const cached = new Map<string,Raster>();
const pending = new Map<string,Promise<Raster>>();
const nodeJobs = new WeakMap<HTMLElement,Promise<void>>();
function raster(source:string){
  const image=cached.get(source);
  if(image)return Promise.resolve(image);
  const running=pending.get(source);
  if(running)return running;
  const task = queue.then(async()=>{
    if(source.length>30000)throw new Error('Mermaid 源码超过 30,000 字符，请拆成多张图。');
    const result = await toRaster(await getSVG(source));
    cached.set(source,result);
    let total=[...cached.values()].reduce((bytes,value)=>bytes+value.src.length,0);
    while(cached.size>1&&(cached.size>24||total>12_000_000)){
      const first=cached.keys().next().value!;total-=cached.get(first)!.src.length;cached.delete(first);
    }
    return result;
  });
  pending.set(source,task);
  queue=task.catch(()=>{});
  void task.then(()=>pending.delete(source),()=>pending.delete(source));
  return task;
}

export async function settleMermaid(root:HTMLElement){
  await Promise.all([...root.querySelectorAll<HTMLElement>('[data-mermaid-source]')].map(figure=>{
    const running=nodeJobs.get(figure);if(running)return running;
    const status=figure.querySelector<HTMLElement>('.mermaid-status')!;
    const spelling=figure.querySelector('.mermaid-fallback code')?.textContent||'';
    const task=raster(spelling).then(async result=>{
      const image=document.createElement('img');
      image.alt=result.alt;image.src=result.src;image.width=result.width;image.height=result.height;
      image.style.cssText=`width:${result.width}px;max-width:100%;height:auto;vertical-align:middle`;
      await image.decode();
      status.replaceWith(image);
      figure.querySelector('.mermaid-fallback')?.remove();
      const controls=figure.querySelector<HTMLElement>('.chart-actions');if(controls)controls.hidden=false;
      figure.dataset.mermaidState='ready';
    }).catch(error=>{
      const message=error instanceof Error?error.message:String(error);
      status.textContent='Mermaid 图表无法绘制：'+message;
      status.classList.add('chart-error');
      status.style.cssText+=';color:#9b3838;background:#fff0ed;padding:8px;white-space:pre-wrap';
      figure.querySelector<HTMLElement>('.mermaid-fallback')!.hidden=false;
      figure.dataset.mermaidState='error';
    });
    nodeJobs.set(figure,task);
    return task;
  }));
}

export function mermaidIssues(root:HTMLElement){
  return [...root.querySelectorAll<HTMLElement>('[data-mermaid-state="error"]')].map(node=>({
    kind:'diagram' as const,line:Number(node.dataset.line)+1,message:node.querySelector('.mermaid-status')?.textContent||'Mermaid 图表无法绘制。',
  }));
}
