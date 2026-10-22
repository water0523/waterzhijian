import {emptyWritingEntry,normalizeWritingLog,validWritingDay,writingDay,writingFields,writingNumber,type WritingLog,type WritingLogEntry} from './writing-data';

const mainKey='paper-writing-log',outboxPrefix='paper-writing-outbox-v1-';
type Awards=Record<string,string>;
type StoredEntry=WritingLogEntry&{_writingWriters?:Record<string,number>;_writingAwards?:Awards};
type StoredLog=Record<string,StoredEntry>;
type Draft={delta:WritingLog;fill:WritingLog;awards:Awards};
type Operation=Draft&{version:1;writer:string;sequence:number;day:string};
type Queued={operation:Operation;durable:boolean};
type IO=Pick<Storage,'getItem'|'setItem'|'removeItem'|'key'|'length'>;
type Options={io:IO;exclusive:<T>(run:()=>T)=>Promise<T>;changed:()=>void;now?:()=>number};
export type WritingSaveStatus={state:'saved'|'pending'|'error';volatile:boolean;queued:number;reason:string};
const blank=():Draft=>({delta:Object.create(null),fill:Object.create(null),awards:Object.create(null)});
const hasDraft=(d:Draft)=>!!(Object.keys(d.delta).length||Object.keys(d.fill).length||Object.keys(d.awards).length);
const writerValid=(id:string)=>/^[a-f0-9-]{16,80}$/.test(id);
const operationKey=(op:Operation)=>outboxPrefix+op.writer+'-'+op.sequence;
const future=new Date('9999-12-31T12:00:00');
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function awards(value:unknown):Awards{
 const result:Awards=Object.create(null);if(!object(value))return result;
 for(const [id,day] of Object.entries(value))if(/^[a-z0-9-]{1,80}$/.test(id)&&typeof day==='string'&&validWritingDay(day))result[id]=day;
 return result;
}
function mergeAwards(target:Awards,source:Awards){for(const [id,day] of Object.entries(source))if(!target[id]||day<target[id])target[id]=day;}
function storageReason(error:unknown,fallback:string){return error instanceof DOMException&&error.name==='QuotaExceededError'?'浏览器统计存储空间不足':error instanceof DOMException&&error.name==='SecurityError'?'浏览器未允许访问统计存储':fallback;}
function parseLog(value:unknown):StoredLog{
 const log:StoredLog=normalizeWritingLog(value,future);if(!object(value))return log;
 for(const [day,entry] of Object.entries(log)){
  const raw=value[day];if(!object(raw))continue;
  if(object(raw._writingWriters)){const writers:Record<string,number>=Object.create(null);for(const [id,n] of Object.entries(raw._writingWriters))if(writerValid(id)&&Number.isSafeInteger(n)&&Number(n)>0)writers[id]=Number(n);if(Object.keys(writers).length)entry._writingWriters=writers;}
  const found=awards(raw._writingAwards);if(Object.keys(found).length)entry._writingAwards=found;
 }
 return log;
}
function sequence(log:StoredLog,writer:string){let n=0;for(const entry of Object.values(log))n=Math.max(n,entry._writingWriters?.[writer]||0);return n;}
function apply(log:StoredLog,op:Operation){
 for(const [day,entry] of Object.entries(op.fill))if(!log[day])log[day]={...entry};
 for(const [day,delta] of Object.entries(op.delta)){
  const entry=log[day]??=emptyWritingEntry();
  for(const field of writingFields){const next=entry[field]+delta[field];if(!Number.isSafeInteger(next))throw new Error('统计数值超出可保存范围');entry[field]=next;}
 }
 for(const entry of Object.values(log)){if(entry._writingWriters){delete entry._writingWriters[op.writer];if(!Object.keys(entry._writingWriters).length)delete entry._writingWriters;}}
 const day=Object.keys(op.delta)[0]||Object.keys(op.fill)[0]||Object.keys(log).sort().at(-1)||op.day,entry=log[day]??=emptyWritingEntry();
 (entry._writingWriters??=Object.create(null))[op.writer]=op.sequence;
 if(Object.keys(op.awards).length)mergeAwards(entry._writingAwards??=Object.create(null),op.awards);
}
function parseOperation(value:unknown):Operation|undefined{
 if(!object(value)||value.version!==1||typeof value.writer!=='string'||!writerValid(value.writer)||!Number.isSafeInteger(value.sequence)||Number(value.sequence)<=0||typeof value.day!=='string'||!validWritingDay(value.day))return;
 if(!object(value.delta)||!object(value.fill)||!object(value.awards))return;
 return {version:1,writer:value.writer,sequence:Number(value.sequence),day:value.day,delta:normalizeWritingLog(value.delta,future),fill:normalizeWritingLog(value.fill,future),awards:awards(value.awards)};
}

// Outbox batches are immutable. A per-window sequence in the same atomic log
// write makes recovery safe even when a write succeeds but acknowledgement fails.
export class WritingJournal{
 private writer=globalThis.crypto?.randomUUID?.()||Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
 private serial=0;
 private draft=blank();
 private queue=new Map<string,Queued>();
 private lastKnown:StoredLog=Object.create(null);
 private lastRaw:string|null|undefined;
 private failure='';
 private retryAt=0;
 private running?:Promise<boolean>;
 private scheduled=false;
 constructor(private options:Options){}
 private now(){return this.options.now?.()??Date.now();}
 private fail(reason:string,attempt=false){const changed=this.failure!==reason;this.failure=reason;if(changed||attempt||!this.retryAt)this.retryAt=this.now()+15000;if(changed)this.changed();}
 private changed(){this.options.changed();}
 private stored(){
  const raw=this.options.io.getItem(mainKey);if(raw===this.lastRaw)return this.lastKnown;let value:unknown;try{value=JSON.parse(raw||'{}');}catch{value={};}this.lastRaw=raw;
  return this.lastKnown=parseLog(value);
 }
 private view(now=new Date()){
  let log:StoredLog;try{log=this.stored();}catch(error){log=this.lastKnown;this.fail(storageReason(error,'无法读取本机统计存储'));}
  const result=this.queue.size||hasDraft(this.draft)?structuredClone(log):log;
  for(const {operation:op} of this.sorted())if(sequence(result,op.writer)<op.sequence)apply(result,op);
  for(const [day,entry] of Object.entries(this.draft.fill))if(!result[day])result[day]={...entry};
  for(const [day,delta] of Object.entries(this.draft.delta)){const e=result[day]??=emptyWritingEntry();for(const field of writingFields)e[field]+=delta[field];}
  const unlocked:Awards=Object.create(null);for(const e of Object.values(result))mergeAwards(unlocked,e._writingAwards||{});mergeAwards(unlocked,this.draft.awards);
  return {log:normalizeWritingLog(result,now),awards:unlocked};
 }
 read(now=new Date()){return this.view(now).log;}
 readAwards(){return this.view().awards;}
 status():WritingSaveStatus{return {state:this.failure?'error':this.queue.size||hasDraft(this.draft)?'pending':'saved',volatile:hasDraft(this.draft)||[...this.queue.values()].some(q=>!q.durable),queued:this.queue.size+(hasDraft(this.draft)?1:0),reason:this.failure};}
 record(day:string,delta:Partial<WritingLogEntry>,now=new Date()){
  if(!validWritingDay(day)||day>writingDay(now))return;
  const entry=this.draft.delta[day]??=emptyWritingEntry();for(const field of writingFields){const next=entry[field]+writingNumber(delta[field],field==='net');if(Number.isSafeInteger(next))entry[field]=next;}
  if(writingFields.every(f=>entry[f]===0))delete this.draft.delta[day];this.changed();this.schedule();
 }
 saveAwards(value:Awards){
  const existing=this.readAwards(),incoming=awards(value);let changed=false;
  for(const [id,day] of Object.entries(incoming))if(!existing[id]||day<existing[id]){this.draft.awards[id]=day;changed=true;}
  if(changed){this.changed();this.schedule();}
 }
 merge(log:WritingLog,value:Awards){
  const current=this.read();for(const [day,entry] of Object.entries(normalizeWritingLog(log)))if(!current[day]&&!this.draft.fill[day])this.draft.fill[day]=entry;
  this.saveAwards(value);this.changed();return this.flush(true);
 }
 private sorted(){return [...this.queue.values()].sort((a,b)=>a.operation.writer.localeCompare(b.operation.writer)||a.operation.sequence-b.operation.sequence);}
 private collect(){
  for(let i=0;i<this.options.io.length;i++){
   const key=this.options.io.key(i);if(!key?.startsWith(outboxPrefix)||this.queue.has(key))continue;
   let raw:unknown;try{raw=JSON.parse(this.options.io.getItem(key)||'null');}catch{continue;}
   const op=parseOperation(raw);if(op&&key===operationKey(op))this.queue.set(key,{operation:op,durable:true});
  }
 }
 private persistQueued(){
  for(const item of this.sorted())if(!item.durable){
   const text=JSON.stringify(item.operation),key=operationKey(item.operation);
   try{this.options.io.setItem(key,text);if(this.options.io.getItem(key)!==text)throw new Error('待存区写入未确认');item.durable=true;}
   catch(error){this.fail(storageReason(error,'无法写入统计待存区'),true);return false;}
  }
  return true;
 }
 private promote(){
  if(!hasDraft(this.draft))return;
  const operation:Operation={...this.draft,version:1,writer:this.writer,sequence:++this.serial,day:writingDay()};this.draft=blank();this.queue.set(operationKey(operation),{operation,durable:false});
 }
 private schedule(){
  if(this.scheduled||this.now()<this.retryAt)return;this.scheduled=true;
  queueMicrotask(()=>{this.scheduled=false;void this.flush();});
 }
 async flush(force=false):Promise<boolean>{
  if(!force&&this.now()<this.retryAt)return false;
  // Persist synchronously before the first await, so pagehide can safely finish.
  if(this.persistQueued()&&(!this.failure||!this.queue.size||force)){this.promote();this.persistQueued();}
  if(this.running)return this.running.then(ok=>ok&&(this.queue.size||hasDraft(this.draft))?this.flush(force):ok);
  if(!this.queue.size&&!this.failure)return true;
  this.running=this.options.exclusive(()=>{
   try{
    this.collect();if(!this.persistQueued())return false;
    let log=this.stored();
    for(const [key,item] of [...this.queue]){
     const op=item.operation,seen=sequence(log,op.writer);
     if(seen>=op.sequence){try{this.options.io.removeItem(key);}catch{}this.queue.delete(key);continue;}
    }
    for(const item of this.sorted()){
     const op=item.operation,key=operationKey(op),seen=sequence(log,op.writer);
     if(seen>=op.sequence){this.queue.delete(key);continue;}
     if(seen!==op.sequence-1){this.fail('统计待存批次暂不完整，请先导出记录',true);return false;}
     const next=structuredClone(log);apply(next,op);this.options.io.setItem(mainKey,JSON.stringify(next));
     let verified:StoredLog;try{verified=this.stored();}catch{this.fail('统计已写入，但尚未确认',true);return false;}
     if(sequence(verified,op.writer)<op.sequence){this.fail('统计写入未确认',true);return false;}
     log=verified;this.queue.delete(key);try{this.options.io.removeItem(key);}catch{}
    }
    this.failure='';this.retryAt=0;this.changed();return true;
   }catch(error){this.fail(storageReason(error,'统计保存未完成'),true);return false;}
  }).catch(()=>{this.fail('无法取得统计保存权限',true);return false;}).finally(()=>{this.running=undefined;if(!this.failure&&(this.queue.size||hasDraft(this.draft)))this.schedule();});
  return this.running;
 }
 recover(){try{this.collect();}catch{this.fail('无法读取统计待存区',true);}return this.flush(true);}
}

export function createWritingJournal(changed:()=>void){
 const io:IO={get length(){return localStorage.length;},key:i=>localStorage.key(i),getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)};
 return new WritingJournal({io,changed,exclusive:run=>navigator.locks?.request?navigator.locks.request('paper-writing-journal-v1',run):Promise.resolve().then(run)});
}
