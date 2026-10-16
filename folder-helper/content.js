(()=>{
  if(window.top!==window||document.documentElement.dataset.feishuiApp!=='1')return;
  const channel='feishui-download-location-v1',actions=new Set(['ping','status','reveal','default-folder']);
  window.addEventListener('message',event=>{
    const m=event.data;
    if(event.source!==window||m?.channel!==channel||m.direction!=='page'||!actions.has(m.action)||typeof m.request!=='string'||!/^[\da-f-]{36}$/i.test(m.request))return;
    const gesture=navigator.userActivation.isActive;
    chrome.runtime.sendMessage({channel,action:m.action,url:m.url,gesture},response=>{
      const error=chrome.runtime.lastError;
      window.postMessage({channel,direction:'extension',request:m.request,...(error?{ok:false,error:'下载定位助手已断开，请刷新页面'}:response)},'*');
    });
  });
  window.postMessage({channel,direction:'extension',ready:true},'*');
})();
