import {freshArticle,uid,type Article} from './model';
import {baselineFor,sameDraft} from './storage';

interface Draft {format:'paper-draft';version:1;writer:string;id:string;base:string|null;at:number;article:Article}
const writer=uid(),prefix='paper-draft-',lockPrefix='paper-writer-';
const sources=new Map<string,Set<string>>();
let channel:BroadcastChannel|undefined;
try{
  channel=new BroadcastChannel('paper-draft-writers');
  channel.addEventListener('message',event=>{if(event.data?.type==='ping')channel?.postMessage({type:'alive',writer});});
}catch{}
if(navigator.locks)void navigator.locks.request(lockPrefix+writer,()=>new Promise<void>(()=>{})).catch(()=>{});
function remember(id:string,key:string){let keys=sources.get(id);if(!keys)sources.set(id,keys=new Set());keys.add(key);}
function ownKey(id:string){return prefix+writer+'-'+id;}
export function publishRecoverySidecar(article:Article){
  try{localStorage.setItem('paper-recovery',JSON.stringify({...article,revisions:[],recoveryWriter:writer,recoveryBase:baselineFor(article.id)}));}catch{}
}
export function checkpoint(article:Article,publish=false){
  const draft:Draft={format:'paper-draft',version:1,writer,id:article.id,base:baselineFor(article.id),at:Date.now(),article:{...article,revisions:[]}};
  try{
    localStorage.setItem(ownKey(article.id),JSON.stringify(draft));
    // This sidecar allows older versions to find the latest text. Modern versions
    // recover the separate records instead, so one window cannot erase another.
    if(publish)publishRecoverySidecar(article);
    return true;
  }catch{return false;}
}
export function clearCheckpoint(id:string){
  try{
    localStorage.removeItem(ownKey(id));
    for(const key of sources.get(id)||[])localStorage.removeItem(key);
    sources.delete(id);
  }catch{}
}
function validArticle(a:any):a is Article{
  if(!(a?.version===1&&typeof a.id==='string'&&/^[a-z\d-]+$/i.test(a.id)&&typeof a.markdown==='string'&&typeof a.title==='string'&&typeof a.theme==='string'&&a.typography&&typeof a.typography==='object'&&!Array.isArray(a.typography)&&Array.isArray(a.assets)&&a.assets.every((id:unknown)=>typeof id==='string')&&Number.isFinite(a.updated)))return false;
  if(a.customTitle!==undefined&&(typeof a.customTitle!=='string'||a.customTitle.length>200))return false;
  if(a.stickers!==undefined&&(!Array.isArray(a.stickers)||!a.stickers.every((s:any)=>s&&typeof s.id==='string'&&typeof s.assetId==='string'&&[s.line,s.x,s.offsetY,s.width,s.rotation].every(Number.isFinite))))return false;
  if(a.assetSettings!==undefined&&(!a.assetSettings||typeof a.assetSettings!=='object'||Array.isArray(a.assetSettings)||!Object.values(a.assetSettings).every((s:any)=>s&&Number.isFinite(s.width)&&['left','center','right'].includes(s.align)&&typeof s.alt==='string'&&typeof s.caption==='string')))return false;
  return true;
}
async function aliveWriters(){
  const live=new Set<string>([writer]);
  try{const state=await navigator.locks?.query();for(const lock of state?.held||[])if(lock.name?.startsWith(lockPrefix))live.add(lock.name.slice(lockPrefix.length));}catch{}
  if(channel){
    const listener=(event:MessageEvent)=>{if(event.data?.type==='alive'&&typeof event.data.writer==='string')live.add(event.data.writer);};
    channel.addEventListener('message',listener);channel.postMessage({type:'ping'});
    await new Promise(resolve=>setTimeout(resolve,100));channel.removeEventListener('message',listener);
  }
  return live;
}
export async function recoverDrafts(articles:Map<string,Article>){
  // With no checkpoint or legacy draft there is no other writer to probe.
  // Keep the full liveness check below whenever any recovery record exists.
  try{
    const pending=Object.keys(localStorage).some(key=>key.startsWith(prefix));
    const legacy=JSON.parse(localStorage.getItem('paper-recovery')||'null');
    if(!pending&&(!legacy||legacy.recoveryWriter))return {recovered:[] as Article[],invalid:0,unavailable:false};
  }catch{/* Unreadable records still go through the existing recovery report. */}
  const live=await aliveWriters(),drafts:{key:string;draft:Draft}[]=[],recovered:Article[]=[];
  let invalid=0;
  try{
    const keys=Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter((key):key is string=>!!key&&key.startsWith(prefix));
    for(const key of keys){try{
      const draft=JSON.parse(localStorage.getItem(key)||'null');
      if(draft?.format!=='paper-draft'||draft.version!==1||!validArticle(draft.article)||draft.id!==draft.article.id||typeof draft.writer!=='string'||!Number.isFinite(draft.at)||!(draft.base===null||typeof draft.base==='string')){invalid++;continue;}
      if(!live.has(draft.writer))drafts.push({key,draft});
    }catch{invalid++;}}
    try{
      const legacy=JSON.parse(localStorage.getItem('paper-recovery')||'null');
      if(legacy&&!legacy.recoveryWriter){if(validArticle(legacy))drafts.push({key:'paper-recovery',draft:{format:'paper-draft',version:1,writer:'legacy',id:legacy.id,base:baselineFor(legacy.id),at:legacy.updated,article:legacy}});else invalid++;}
    }catch{invalid++;}
  }catch{return {recovered,invalid,unavailable:true};}
  for(const {key,draft} of drafts.sort((a,b)=>a.draft.at-b.draft.at)){
    const saved=articles.get(draft.id),incoming:Article={...freshArticle(),...draft.article,linkMode:draft.article.linkMode,revisions:structuredClone(saved?.revisions||[])};
    if(!incoming.titleMode)incoming.titleMode='manual';
    if(saved&&sameDraft(saved,incoming)){try{localStorage.removeItem(key);}catch{}continue;}
    // Older releases have only a timestamp. Never replace a newer stored draft.
    if(draft.writer==='legacy'&&saved&&draft.at<=saved.updated)continue;
    const duplicate=recovered.find(a=>sameDraft(a,incoming));if(duplicate){remember(duplicate.id,key);continue;}
    const safeBase=draft.base===baselineFor(draft.id)&&!recovered.some(a=>a.id===draft.id);
    if(!safeBase||(saved?.deleted&&!incoming.deleted)){
      incoming.provenance={kind:'recovery',sourceId:incoming.id,at:Date.now()};incoming.id=uid();incoming.title+=' · 恢复稿';incoming.titleMode='manual';incoming.created=Date.now();
    }
    articles.set(incoming.id,incoming);recovered.push(incoming);remember(incoming.id,key);
  }
  return {recovered,invalid,unavailable:false};
}
