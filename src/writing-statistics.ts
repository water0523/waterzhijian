import type {MarkdownEditor} from './editor';
import {countWritingWords} from './render';
import {readWritingLog,recordWriting,writingDay,writingDays} from './writing-log';
import {syncWritingAchievements} from './writing-progress';

export function mountWritingStatistics(editor:MarkdownEditor,article:()=>{id:string;markdown:string}){
 let owner=article().id,last=countWritingWords(article().markdown),baseline=last,added=0,start=Date.now(),active=0,lastInput=0;
 let pendingSeconds=0,pendingDwell=0,pendingDay=writingDay(),lastTick=Date.now(),activeRemainder=0,dwellRemainder=0;
 const bar=document.createElement('span');bar.id='session-statistics';document.querySelector('.editor-bottom')!.append(bar);
 const flush=()=>{if(pendingSeconds||pendingDwell){const seconds=pendingSeconds,dwellSeconds=pendingDwell;pendingSeconds=pendingDwell=0;recordWriting(pendingDay,{seconds,dwellSeconds});}};
 const snapshot=()=>{
  const log=readWritingLog(),today=writingDay(),entry=log[today],week=writingDays(7).reduce((sum,day)=>sum+(log[day]?.net||0),0);
  return {net:last-baseline,added,seconds:active,elapsed:Math.floor((Date.now()-start)/1000),today:entry?.net||0,week,total:last,reading:Math.max(1,Math.ceil(last/450)),todaySeconds:(entry?.seconds||0)+(pendingDay===today?pendingSeconds:0),todayDwell:(entry?.dwellSeconds||0)+(pendingDay===today?pendingDwell:0)};
 };
 const paint=()=>{
  const s=snapshot(),sign=s.net>=0?'+':'';bar.textContent=`本次 ${sign}${s.net} 字 · ${Math.floor(s.seconds/60)} 分钟`;bar.title='本次指当前文章本次打开后的净变化。汉字按字，其他连续字母和数字按词；不计排版标记、图片或公式代码。删除与撤销计负数。';
  for(const [key,text] of Object.entries({session:`本次 ${sign}${s.net} 字 · 活跃 ${Math.floor(s.seconds/60)} 分钟`,days:`今日净增 ${s.today} 字 · 近七日净增 ${s.week} 字`,total:`编辑文章字数 ${s.total.toLocaleString()} 字 · 预计阅读 ${s.reading} 分钟。汉字按字，其他连续字母和数字按词；格式调整不计字数，后台停留不计活跃时长。`,today:`今日 ${s.today>=0?'+':''}${s.today.toLocaleString()} 字 · 活跃 ${Math.floor(s.todaySeconds/60)} 分钟`}))document.querySelectorAll('[data-stat-'+key+']').forEach(node=>{if(node.textContent!==text)node.textContent=text;});
 };
 editor.view.dom.addEventListener('input',()=>{lastInput=Date.now();});
 document.getElementById('preview')?.addEventListener('input',()=>{lastInput=Date.now();});
 syncWritingAchievements(readWritingLog());
 window.addEventListener('paper-writing-log',()=>syncWritingAchievements(readWritingLog()));
 function update(){
  const a=article(),n=countWritingWords(a.markdown);
  if(owner!==a.id){flush();owner=a.id;last=n;baseline=n;added=0;active=0;lastInput=0;activeRemainder=0;start=Date.now();paint();return;}
  const delta=n-last;if(delta){recordWriting(writingDay(),{net:delta,added:Math.max(0,delta)});added+=Math.max(0,delta);last=n;}paint();
 }
 setInterval(()=>{
  const now=Date.now();let from=Math.max(lastTick,now-2000);lastTick=now;update();
  const foreground=document.visibilityState==='visible'&&document.hasFocus();
  const writing=foreground&&lastInput>0&&now-lastInput<60000&&!!document.activeElement?.closest('.cm-editor,#preview [contenteditable]');
  while(from<now){
   const date=new Date(from),day=writingDay(date),midnight=new Date(date.getFullYear(),date.getMonth(),date.getDate()+1).getTime(),to=Math.min(now,midnight);
   if(day!==pendingDay){flush();pendingDay=day;activeRemainder=dwellRemainder=0;}
   if(foreground){dwellRemainder+=to-from;const seconds=Math.floor(dwellRemainder/1000);dwellRemainder%=1000;pendingDwell+=seconds;}else dwellRemainder=0;
   if(writing){activeRemainder+=to-from;const seconds=Math.floor(activeRemainder/1000);activeRemainder%=1000;active+=seconds;pendingSeconds+=seconds;}else activeRemainder=0;
   from=to;
  }
  if(pendingSeconds>=15||pendingDwell>=15)flush();paint();
 },1000);
 const suspend=()=>{update();flush();lastTick=Date.now();activeRemainder=dwellRemainder=0;lastInput=0;};
 document.addEventListener('visibilitychange',suspend);
 window.addEventListener('blur',suspend);
 window.addEventListener('focus',()=>{lastTick=Date.now();});
 window.addEventListener('pagehide',suspend);paint();
 return {update,flush:()=>{update();flush();},summary:()=>{update();return snapshot();}};
}
