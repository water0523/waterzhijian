import {gunzipSync,strFromU8} from 'fflate';
type OfflineRegistry=Record<string,unknown>;
const registry=()=>{
  const scope=globalThis as typeof globalThis&{__feishuiOfflineModules?:OfflineRegistry};
  return scope.__feishuiOfflineModules??=Object.create(null) as OfflineRegistry;
};

// These payloads are generated from the project's dependencies at build time.
// They stay inside the HTML and never load code from a URL or article content.
export function offlineModule<T>(name:'math'|'word'|'highlight'):T{
  const modules=registry();if(Object.hasOwn(modules,name))return modules[name] as T;
  const payload=document.getElementById('offline-module-'+name);
  if(!payload?.textContent)throw new Error('离线功能缺失，请重新下载完整编辑器');
  const script=document.createElement('script');
  script.textContent=payload.dataset.encoding==='gzip-base64'?strFromU8(gunzipSync(Uint8Array.from(atob(payload.textContent),c=>c.charCodeAt(0)))):payload.textContent;
  try{document.head.append(script);}finally{script.remove();}
  if(!Object.hasOwn(modules,name))throw new Error('离线功能未能启动，请重新打开编辑器');
  payload.dataset.loaded='true';return modules[name] as T;
}

const imageCache=new Map<string,string>();
export function embeddedImage(reference:string):string{
  if(reference.startsWith('data:'))return reference;
  const cached=imageCache.get(reference);if(cached)return cached;
  const payload=document.getElementById(reference),data=payload?.textContent;
  if(!data?.startsWith('data:image/'))throw new Error('内置示例图片缺失，请重新下载完整编辑器');
  payload!.dataset.loaded='true';imageCache.set(reference,data);return data;
}
