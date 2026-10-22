import {preference,readPreference} from './storage';
export type WritingLogEntry={net:number;added:number;seconds:number;dwellSeconds:number};
export type WritingLog=Record<string,WritingLogEntry>;
export function writingDay(date=new Date()){return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
export function writingDays(days:number,now=new Date()){
 const end=new Date(now);end.setHours(12,0,0,0);
 return Array.from({length:days},(_,i)=>{const date=new Date(end);date.setDate(date.getDate()-(days-1-i));return writingDay(date);});
}
const number=(value:unknown,negative=false)=>typeof value==='number'&&Number.isSafeInteger(value)?negative?value:Math.max(0,value):0;
export function normalizeWritingLog(value:unknown,now=new Date()):WritingLog{
 const log:WritingLog=Object.create(null),last=writingDay(now);
 if(!value||typeof value!=='object'||Array.isArray(value))return log;
  for(const [day,entry] of Object.entries(value)){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day>last||writingDay(new Date(day+'T12:00:00'))!==day||!entry||typeof entry!=='object'||Array.isArray(entry))continue;
   const record=entry as Record<string,unknown>;log[day]={net:number(record.net,true),added:number(record.added),seconds:number(record.seconds),dwellSeconds:number(record.dwellSeconds)};
  }
 return log;
}
export function readWritingLog(now=new Date()):WritingLog{
 try{return normalizeWritingLog(JSON.parse(readPreference('writing-log','{}')),now);}catch{return Object.create(null) as WritingLog;}
}
export function recordWriting(day:string,delta:Partial<WritingLogEntry>,now=new Date()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day>writingDay(now)||writingDay(new Date(day+'T12:00:00'))!==day)return;
 const log=readWritingLog(now),entry=log[day]??={net:0,added:0,seconds:0,dwellSeconds:0};
 for(const key of ['net','added','seconds','dwellSeconds'] as const){const next=entry[key]+number(delta[key],key==='net');entry[key]=Number.isSafeInteger(next)?next:entry[key];}
 log[day]=entry;preference('writing-log',JSON.stringify(log));
 window.dispatchEvent(new Event('paper-writing-log'));
}
