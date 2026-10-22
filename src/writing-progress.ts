import {preference,readPreference} from './storage';
import {writingDay,type WritingLog,type WritingLogEntry} from './writing-log';

export const emptyWritingDay=():WritingLogEntry=>({net:0,added:0,seconds:0,dwellSeconds:0});
export function heatLevel(entry:WritingLogEntry=emptyWritingDay()){
 const load=Math.max(0,entry.net)/500+entry.seconds/1800+entry.dwellSeconds/7200;
 return load===0?0:Math.min(4,Math.ceil(load));
}
export const isWritingDay=(entry:WritingLogEntry)=>entry.net>0||entry.seconds>=60;
function previousDay(day:string){const date=new Date(day+'T12:00:00');date.setDate(date.getDate()-1);return writingDay(date);}
export function writingProgress(log:WritingLog,now=new Date()){
 let net=0,seconds=0,dwellSeconds=0,days=0,bestStreak=0,run=0,last='';
 const dates=Object.keys(log).sort();
 for(const day of dates){const e=log[day];net+=e.net;seconds+=e.seconds;dwellSeconds+=e.dwellSeconds;
  if(isWritingDay(e)){days++;run=last===previousDay(day)?run+1:1;last=day;bestStreak=Math.max(bestStreak,run);}
 }
 let cursor=writingDay(now),streak=0;
 if(!log[cursor]||!isWritingDay(log[cursor]))cursor=previousDay(cursor);
 while(log[cursor]&&isWritingDay(log[cursor])){streak++;cursor=previousDay(cursor);}
 return {net,words:Math.max(0,net),seconds,dwellSeconds,days,bestStreak,streak};
}
type Progress=ReturnType<typeof writingProgress>;
type Achievement={id:string;title:string;description:string;icon:string;goal:number;value:(p:Progress)=>number;unit:string};
export const writingAchievements:Achievement[]=[
 {id:'first-words',title:'落笔非水',description:'累计净增 1 字',icon:'paintbrush',goal:1,value:p=>p.words,unit:'字'},
 {id:'words-1000',title:'千字成笺',description:'累计净增 1,000 字',icon:'document',goal:1000,value:p=>p.words,unit:'字'},
 {id:'words-10000',title:'万字成章',description:'累计净增 10,000 字',icon:'document',goal:10000,value:p=>p.words,unit:'字'},
 {id:'words-100000',title:'十万长卷',description:'累计净增 100,000 字',icon:'document',goal:100000,value:p=>p.words,unit:'字'},
 {id:'time-30m',title:'静心落墨',description:'累计活跃写作 30 分钟',icon:'clock',goal:1800,value:p=>p.seconds,unit:'时长'},
 {id:'time-5h',title:'笔耕不辍',description:'累计活跃写作 5 小时',icon:'clock',goal:18000,value:p=>p.seconds,unit:'时长'},
 {id:'time-24h',title:'与文字的一天',description:'累计活跃写作 24 小时',icon:'sun',goal:86400,value:p=>p.seconds,unit:'时长'},
 {id:'streak-3',title:'三日有约',description:'连续写作 3 天',icon:'spark',goal:3,value:p=>p.bestStreak,unit:'天'},
 {id:'streak-7',title:'一周同行',description:'连续写作 7 天',icon:'spark',goal:7,value:p=>p.bestStreak,unit:'天'},
 {id:'streak-30',title:'月有回响',description:'连续写作 30 天',icon:'moon',goal:30,value:p=>p.bestStreak,unit:'天'},
 {id:'days-10',title:'十日拾光',description:'累计写作 10 天',icon:'calendar',goal:10,value:p=>p.days,unit:'天'},
 {id:'days-50',title:'五十页日常',description:'累计写作 50 天',icon:'calendar',goal:50,value:p=>p.days,unit:'天'}
];
export function normalizeWritingAchievements(raw:unknown,now=new Date()):Record<string,string>{
 const unlocked:Record<string,string>=Object.create(null);
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return unlocked;
  for(const a of writingAchievements){const day=(raw as Record<string,unknown>)[a.id];if(typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&day<=writingDay(now)&&writingDay(new Date(day+'T12:00:00'))===day)unlocked[a.id]=day;}
 return unlocked;
}
export function readWritingAchievements(now=new Date()):Record<string,string>{
 try{return normalizeWritingAchievements(JSON.parse(readPreference('writing-achievements','{}')),now);}catch{return Object.create(null) as Record<string,string>;}
}
export function syncWritingAchievements(log:WritingLog,now=new Date()){
 const unlocked=readWritingAchievements(now),newly:string[]=[];
 const progress=writingProgress(log,now);
 for(const a of writingAchievements)if(!unlocked[a.id]&&a.value(progress)>=a.goal){unlocked[a.id]=writingDay(now);newly.push(a.id);}
 if(newly.length)preference('writing-achievements',JSON.stringify(unlocked));
 return {unlocked,newly,progress};
}
export function monthDays(month:string){
 const start=new Date(month+'-01T12:00:00'),end=new Date(start);end.setMonth(end.getMonth()+1);end.setDate(0);
 return Array.from({length:end.getDate()},(_,i)=>month+'-'+String(i+1).padStart(2,'0'));
}
export function monthWriting(log:WritingLog,month:string){
 const total=emptyWritingDay();let days=0;
 for(const day of monthDays(month)){const e=log[day];if(!e)continue;for(const key of ['net','added','seconds','dwellSeconds'] as const)total[key]+=e[key];if(isWritingDay(e))days++;}
 return {...total,days};
}
export function writingDuration(seconds:number){
 const minutes=Math.floor(seconds/60);if(!minutes)return seconds?'不足 1 分钟':'0 分钟';
 return minutes<60?minutes+' 分钟':Math.floor(minutes/60)+' 小时'+(minutes%60?' '+minutes%60+' 分钟':'');
}
