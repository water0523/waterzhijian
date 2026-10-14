import type {Article,Asset} from './model';
let database:IDBDatabase|undefined;
export async function openStore(){
  database=await new Promise<IDBDatabase>((resolve,reject)=>{
    const req=indexedDB.open('paper-studio-v1',1);
    req.onupgradeneeded=()=>{req.result.createObjectStore('articles',{keyPath:'id'});req.result.createObjectStore('assets',{keyPath:'id'});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('本地文章库被其他窗口占用'));
  });
  database.onversionchange=()=>database?.close();
}
export async function loadStore():Promise<{articles:Article[];assets:Asset[]}>{
  if(!database)throw new Error('文章库不可用');
  const tx=database.transaction(['articles','assets'],'readonly');
  const getAll=<T>(name:string)=>new Promise<T[]>((resolve,reject)=>{const r=tx.objectStore(name).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const [articles,assets]=await Promise.all([getAll<Article>('articles'),getAll<Asset>('assets')]);return {articles,assets};
}
export async function persist(articles:Article[],assets:Asset[]){
  if(!database)throw new Error('浏览器未开放本地存储，请导出文件备份');
  await new Promise<void>((resolve,reject)=>{
    const tx=database!.transaction(['articles','assets'],'readwrite');
    for(const article of articles)tx.objectStore('articles').put(article);
    for(const asset of assets)tx.objectStore('assets').put(asset);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('保存被中断'));
  });
}
export function readPreference(key:string,fallback:string){try{return localStorage.getItem('paper-'+key)||fallback;}catch{return fallback;}}
export function preference(key:string,value:string){try{localStorage.setItem('paper-'+key,value);}catch{/* Article safety does not depend on preference storage. */}}
