import type {Revision} from './model';
// Stable keys also cover old archives whose revisions have no explicit identity.
export function revisionKey(r:Revision){const text=JSON.stringify(r);let a=2166136261,b=3144134277;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b^text.charCodeAt(i),2246822519);}return (a>>>0).toString(16)+(b>>>0).toString(16);}
export function retainRevisions(items:Revision[],removed:string[]=[]){const blocked=new Set(removed),seen=new Set<string>();const sorted=items.filter(r=>{const key=revisionKey(r);if(blocked.has(key)||seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>a.at-b.at);return [...sorted.filter(r=>r.label),...sorted.filter(r=>!r.label).slice(-1)].sort((a,b)=>a.at-b.at);}
