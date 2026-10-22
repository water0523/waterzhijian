export type WritingLogEntry={net:number;added:number;seconds:number;dwellSeconds:number};
export type WritingLog=Record<string,WritingLogEntry>;
export const writingFields=['net','added','seconds','dwellSeconds'] as const;
export const emptyWritingEntry=():WritingLogEntry=>({net:0,added:0,seconds:0,dwellSeconds:0});
export function writingDay(date=new Date()){return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
export function validWritingDay(day:string){return /^\d{4}-\d{2}-\d{2}$/.test(day)&&writingDay(new Date(day+'T12:00:00'))===day;}
export function writingDays(days:number,now=new Date()){
 const end=new Date(now);end.setHours(12,0,0,0);
 return Array.from({length:days},(_,i)=>{const date=new Date(end);date.setDate(date.getDate()-(days-1-i));return writingDay(date);});
}
export const writingNumber=(value:unknown,negative=false)=>typeof value==='number'&&Number.isSafeInteger(value)?negative?value:Math.max(0,value):0;
export function normalizeWritingLog(value:unknown,now=new Date()):WritingLog{
 const log:WritingLog=Object.create(null),last=writingDay(now);
 if(!value||typeof value!=='object'||Array.isArray(value))return log;
 for(const [day,entry] of Object.entries(value)){
  if(!validWritingDay(day)||day>last||!entry||typeof entry!=='object'||Array.isArray(entry))continue;
  const record=entry as Record<string,unknown>;log[day]={net:writingNumber(record.net,true),added:writingNumber(record.added),seconds:writingNumber(record.seconds),dwellSeconds:writingNumber(record.dwellSeconds)};
 }
 return log;
}
