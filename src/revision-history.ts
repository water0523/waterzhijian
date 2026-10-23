import type {Article,Revision,RevisionName} from './model';
// Stable keys also cover old archives whose revisions have no explicit identity.
export function revisionKey(r:Revision){const text=JSON.stringify(r);let a=2166136261,b=3144134277;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b^text.charCodeAt(i),2246822519);}return (a>>>0).toString(16)+(b>>>0).toString(16);}
export function retainRevisions(items:Revision[],removed:string[]=[]){const blocked=new Set(removed),seen=new Set<string>();const sorted=items.filter(r=>{const key=revisionKey(r);if(blocked.has(key)||seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>a.at-b.at);return [...sorted.filter(r=>r.label),...sorted.filter(r=>!r.label).slice(-1)].sort((a,b)=>a.at-b.at);}

export const cleanRevisionName=(name:string)=>name.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,80);
function nameRecord(raw:unknown):RevisionName|undefined{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return;const v=raw as Record<string,unknown>;
 if(typeof v.value!=='string'||!cleanRevisionName(v.value)||typeof v.at!=='number'||!Number.isSafeInteger(v.at)||v.at<0||v.at>=8640000000000000||typeof v.id!=='string'||!/^[-a-z\d]{1,80}$/i.test(v.id))return;
 return {value:cleanRevisionName(v.value),at:v.at,id:v.id};
}
const newerName=(a:RevisionName,b:RevisionName)=>a.at>b.at||a.at===b.at&&(a.id>b.id||a.id===b.id&&a.value>b.value);
/** Display names never change a recovery point's content fingerprint. */
export function mergeRevisionNames(revisions:Revision[],...sources:unknown[]):Record<string,RevisionName>|undefined{
 if(!sources.some(source=>source&&typeof source==='object'&&!Array.isArray(source)&&Object.keys(source).length))return;
 const allowed=new Set(revisions.filter(r=>r.label).map(revisionKey)),names:Record<string,RevisionName>=Object.create(null);
 for(const source of sources){if(!source||typeof source!=='object'||Array.isArray(source))continue;for(const [key,raw] of Object.entries(source)){if(!allowed.has(key))continue;const value=nameRecord(raw);if(value&&(!names[key]||newerName(value,names[key])))names[key]=value;}}
 return Object.keys(names).length?names:undefined;
}
export function revisionName(revision:Revision,names:Record<string,RevisionName>|undefined){return names?.[revisionKey(revision)]?.value||revision.label||'自动版本';}
export function renameRevision(article:Article,key:string,value:string,id:string,now=Date.now()){
 const revision=article.revisions.find(r=>r.label&&revisionKey(r)===key),name=cleanRevisionName(value);if(!revision||!name)throw new Error('请输入有效的手动版本名称');
 const names=mergeRevisionNames(article.revisions,article.revisionNames);if(revisionName(revision,names)===name)return false;
 const event=nameRecord({value:name,at:Math.max(now,(names?.[key]?.at??-1)+1),id});if(!event)throw new Error('版本名称无法保存');
 article.revisionNames={...names,[key]:event};return true;
}
/** Imports normalize content and remap asset IDs, so names must follow new keys. */
export function remapRevisionNames(raw:unknown,original:Revision[],revisions:Revision[]){
 const source=mergeRevisionNames(original,raw);if(!source)return;const names:Record<string,RevisionName>=Object.create(null);
 original.forEach((r,i)=>{const value=source[revisionKey(r)];if(value&&revisions[i]?.label)names[revisionKey(revisions[i])]=value;});return mergeRevisionNames(revisions,names);
}
