const channel='feishui-download-location-v1';
function allowed(url){
  try{const u=new URL(url);return u.protocol==='file:'&&/\.html?$/i.test(u.pathname)||u.origin==='https://water0523.github.io'&&u.pathname.startsWith('/waterzhijian/');}catch{return false;}
}
function sameBlob(url,page){
  try{if(typeof url!=='string'||url.length>=2048||new URL(url).protocol!=='blob:')return false;const source=new URL(page);return source.protocol==='file:'?/^blob:null\/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(url):new URL(url).origin===source.origin;}catch{return false;}
}
async function respond(message,sender){
  if(sender.id!==chrome.runtime.id||sender.frameId!==0||!sender.tab||!allowed(sender.url))throw Error('不支持的页面');
  if(message.action==='ping')return {ready:true};
  if(!['status','reveal','default-folder'].includes(message.action))throw Error('不支持的操作');
  if(message.action!=='status'&&message.gesture!==true)throw Error('请点击按钮打开文件夹');
  if(message.action==='default-folder'){chrome.downloads.showDefaultFolder();return {opened:true};}
  if(!sameBlob(message.url,sender.url))throw Error('无效的下载地址');
  const escaped=message.url.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const items=await chrome.downloads.search({urlRegex:'^'+escaped+'$',limit:1,orderBy:['-startTime']});
  const item=items[0];
  if(!item)return {state:'pending'};
  if(message.action==='status')return {state:item.exists===false?'missing':item.state};
  if(item.state!=='complete')throw Error('下载尚未完成，请稍后重试');
  if(item.exists===false)throw Error('文件已被移动或删除，请重新下载');
  chrome.downloads.show(item.id);return {opened:true};
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(message?.channel!==channel)return false;
  respond(message,sender).then(result=>sendResponse({ok:true,...result}),error=>sendResponse({ok:false,error:error.message||'无法打开文件夹'}));
  return true;
});
chrome.action.onClicked.addListener(()=>chrome.downloads.showDefaultFolder());
