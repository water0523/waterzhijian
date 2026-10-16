import {uiIcon} from './ui-icons';

declare const __FOLDER_HELPER_ZIP__:string;
const channel='feishui-download-location-v1';
type Entry={url:string;name:string;state:string;error?:string};
type Reply={ok:boolean;ready?:boolean;opened?:boolean;state?:string;error?:string};
let connected=false,dismissed=false,latest:Entry|undefined,shelf:HTMLElement,openDialog:(title:string,html:string)=>void;
const requests=new Map<string,(value:Reply)=>void>();
function request(action:string,url?:string):Promise<Reply>{
  return new Promise(resolve=>{
    const id=crypto.randomUUID(),timer=window.setTimeout(()=>{requests.delete(id);resolve({ok:false,error:'下载定位助手未连接，请安装后刷新页面'});},1800);
    requests.set(id,value=>{clearTimeout(timer);requests.delete(id);resolve(value);});
    window.postMessage({channel,direction:'page',request:id,action,url},'*');
  });
}
function paint(){
  if(!shelf||!latest)return;
  shelf.hidden=dismissed;shelf.querySelector('strong')!.textContent=latest.name;
  shelf.querySelector('p')!.textContent=latest.error||(!connected?'已交给浏览器下载':'complete'===latest.state?'下载完成':latest.state==='interrupted'?'下载未完成，请重试':latest.state==='missing'?'文件已被移动或删除':latest.state==='waiting'?'下载仍在进行，可稍后检查':'正在等待下载完成…');
  const button=shelf.querySelector<HTMLButtonElement>('[data-download-reveal]')!;
  button.textContent=!connected?'启用文件夹定位':latest.state==='waiting'?'检查下载状态':'打开所在文件夹';button.disabled=connected&&!['complete','waiting'].includes(latest.state);
}
async function refresh(entry:Entry){
  if(!connected)return;
  for(let i=0;i<20&&latest===entry;i++){
    const result=await request('status',entry.url);
    if(!result.ok){connected=false;entry.error=result.error;paint();return;}
    entry.state=result.state||'pending';paint();
    if(['complete','interrupted','missing'].includes(entry.state))return;
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  if(latest===entry){entry.state='waiting';paint();}
}
export function trackDownload(url:string,name:string){dismissed=false;latest={url,name,state:'pending'};paint();void refresh(latest);}
export async function openDownloadFolder(){
  if(!connected){showDownloadLocation();return;}
  const result=await request('default-folder');
  if(!result.ok){connected=false;paint();showDownloadLocation(result.error);}
  else {const status=document.getElementById('download-helper-state');if(status)status.textContent='已请求打开默认下载文件夹。';}
}
function helperZIP(){
  const bytes=Uint8Array.from(atob(__FOLDER_HELPER_ZIP__),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'}));
  const a=document.createElement('a');a.href=url;a.download='非水成章-下载定位助手.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export function showDownloadLocation(error?:string){
  openDialog('下载后，打开所在文件夹',`<p class="modal-subtitle" id="download-helper-state"></p>${connected?'<div class="download-location-actions"><button id="download-open-default" class="button primary">打开默认下载文件夹</button></div><p class="help">普通下载完成后，右下角可定位实际文件。打印另存的 PDF、自选位置另存的图片不在浏览器下载记录中，默认文件夹不一定是它们的保存位置。</p>':'<p class="help">此功能需要安装一次下载定位助手，之后下载完成即可直接打开所在文件夹。</p><ol class="download-helper-steps"><li>下载并解压助手 ZIP，保留解压后的文件夹。</li><li>进入 Chrome / Edge 的“管理扩展”，开启“开发者模式”。</li><li>点击“加载已解压的扩展程序”，选择解压后的助手文件夹。</li><li>使用本地 HTML 时，在助手的详细信息中开启“允许访问文件网址”。</li><li>刷新编辑器，再次下载文件。</li></ol><button id="download-get-helper" class="button primary">下载定位助手 ZIP</button><p class="help">助手仅用于查询本编辑器下载的状态及打开文件夹，不上传文章。原有下载始终可用。</p><p class="help">暂不安装时，普通下载可按 Ctrl+J 打开下载记录，再点文件旁的文件夹图标。打印另存的 PDF 请使用保存窗口中的目录。</p>'}`);
  document.getElementById('download-helper-state')!.textContent=error||(connected?'下载定位助手已连接。':'下载定位助手尚未连接。');
  document.getElementById('download-get-helper')?.addEventListener('click',helperZIP);
  document.getElementById('download-open-default')?.addEventListener('click',()=>void openDownloadFolder());
}
export function mountDownloadLocation(open:typeof openDialog){
  openDialog=open;
  shelf=document.createElement('aside');shelf.id='download-location-notice';shelf.className='download-location-notice';shelf.hidden=true;shelf.setAttribute('aria-label','最近导出文件');
  shelf.innerHTML=`<span class="download-location-icon" aria-hidden="true">${uiIcon('folder')}</span><div><strong></strong><p role="status" aria-live="polite"></p><button class="button outline" data-download-reveal>启用文件夹定位</button></div><button class="download-location-close" aria-label="关闭下载提示">×</button>`;
  document.body.append(shelf);shelf.querySelector('.download-location-close')!.addEventListener('click',()=>{dismissed=true;shelf.hidden=true;});
  shelf.querySelector('[data-download-reveal]')!.addEventListener('click',async()=>{
    if(!connected){showDownloadLocation();return;}const entry=latest;if(!entry)return;
    if(entry.state!=='complete'){entry.state='pending';paint();void refresh(entry);return;}
    const result=await request('reveal',entry.url);
    if(latest!==entry)return;
    entry.error=result.ok?'已请求打开文件所在文件夹。':result.error;paint();
    if(!result.ok)void refresh(entry);
  });
  window.addEventListener('message',event=>{
    const data=event.data;if(event.source!==window||data?.channel!==channel||data.direction!=='extension')return;
    if(data.ready&&!data.request){void request('ping').then(reply=>{connected=!!reply.ok&&!!reply.ready;if(latest)void refresh(latest);});return;}
    if(typeof data.request==='string')requests.get(data.request)?.(data);
  });
  void request('ping').then(reply=>{if(reply.ok&&reply.ready){connected=true;if(latest)void refresh(latest);}});
}
