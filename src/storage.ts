import {uid,type Article,type Asset} from './model';
import {retainRevisions,mergeRevisionNames} from './revision-history';
let database:IDBDatabase|undefined;
const baselines=new Map<string,string>();
// These fingerprints detect a stale window, including writes by older releases
// that know nothing about storeRevision. They are not security hashes.
export function recordFingerprint(value:unknown){
  const text=JSON.stringify(value);let a=1779033703,b=3144134277,c=1013904242,d=2773480762;
  for(let i=0;i<text.length;i++){const k=text.charCodeAt(i);a=b^Math.imul(a^k,597399067);b=c^Math.imul(b^k,2869860233);c=d^Math.imul(c^k,951274213);d=a^Math.imul(d^k,2716044179);}
  return [a,b,c,d].map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
}
export const baselineFor=(id:string)=>baselines.get(id)??null;
export function sameDraft(a:Article,b:Article){
  const draft=(v:Article)=>[v.customTitle||'',v.title,v.titleMode??'manual',v.markdown,v.theme,v.typography,v.assets,v.stickers||[],v.folder||'',v.deleted,v.assetSettings||{},v.linkMode||'direct'];
  return JSON.stringify(draft(a))===JSON.stringify(draft(b));
}
export interface Commit {inputId:string;article:Article;original?:Article}
export interface SaveResult {commits:Commit[];foreignAssets:Asset[]}
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
  const [articles,assets]=await Promise.all([getAll<Article>('articles'),getAll<Asset>('assets')]);
  for(const article of articles)baselines.set(article.id,recordFingerprint(article));
  return {articles,assets};
}
export async function persist(articles:Article[],assets:Asset[]):Promise<SaveResult>{
  if(!database)throw new Error('浏览器未开放本地存储，请导出文件备份');
  return await new Promise<SaveResult>((resolve,reject)=>{
    const tx=database!.transaction(['articles','assets'],'readwrite');
    const store=tx.objectStore('articles'),images=tx.objectStore('assets'),commits:Commit[]=[],foreignAssets:Asset[]=[];
    let failure:unknown;
    tx.oncomplete=()=>{
      for(const item of commits){baselines.set(item.article.id,recordFingerprint(item.article));if(item.original)baselines.set(item.original.id,recordFingerprint(item.original));}
      resolve({commits,foreignAssets});
    };
    tx.onerror=()=>reject(failure||tx.error);tx.onabort=()=>reject(failure||tx.error||new Error('保存被中断'));
    const abort=(error:unknown)=>{failure=error;try{tx.abort();}catch{}reject(error);};
    const write=(input:Article,stored:Article|undefined)=>{
      try{
        let article=structuredClone(input),original:Article|undefined;
        const baseline=baselineFor(input.id),stale=stored?recordFingerprint(stored)!==baseline:baseline!==null;
        if(stale&&stored&&sameDraft(stored,input)){
          article.revisionDeletes=[...new Set([...(stored.revisionDeletes||[]),...(input.revisionDeletes||[])])];article.revisions=retainRevisions([...stored.revisions,...input.revisions],article.revisionDeletes);
          const names=mergeRevisionNames(article.revisions,stored.revisionNames,input.revisionNames);if(names)article.revisionNames=names;else delete article.revisionNames;
          article.updated=Math.max(stored.updated,input.updated);
        }else if(stale){
          original=stored;article.provenance={kind:stored?'conflict':'recovery',sourceId:article.id,at:Date.now()};article.id=uid();article.title+=' · '+(stored?'冲突副本':'恢复稿');article.titleMode='manual';article.created=Date.now();
          if(stored)for(const id of stored.assets){const r=images.get(id);r.onsuccess=()=>{if(r.result)foreignAssets.push(r.result);};}
        }
        const names=mergeRevisionNames(article.revisions,article.revisionNames);if(names)article.revisionNames=names;else delete article.revisionNames;
        article.storeRevision=uid();store.put(article);commits.push({inputId:input.id,article,original});
      }catch(error){abort(error);}
    };
    try{
      for(const article of articles){const req=store.get(article.id);req.onsuccess=()=>write(article,req.result);}
      for(const asset of assets)images.put(asset);
    }catch(error){abort(error);}
  });
}
export function readPreference(key:string,fallback:string){try{return localStorage.getItem('paper-'+key)||fallback;}catch{return fallback;}}
export function preference(key:string,value:string){try{localStorage.setItem('paper-'+key,value);}catch{/* Article safety does not depend on preference storage. */}}
