import type {MarkdownEditor} from './editor';
import {countWritingWords} from './render';
import {readWritingLog,recordWriting,writingDay,writingDays} from './writing-log';
export function mountWritingStatistics(editor:MarkdownEditor,article:()=>{id:string;markdown:string}){
 let owner=article().id,last=countWritingWords(article().markdown),baseline=last,added=0,start=Date.now(),active=0,lastInput=0;
 let pendingSeconds=0,pendingDay=writingDay(),lastTick=Date.now(),remainder=0;
 const bar=document.createElement('span');bar.id='session-statistics';document.querySelector('.editor-bottom')!.append(bar);
 const flush=()=>{if(pendingSeconds){recordWriting(pendingDay,{seconds:pendingSeconds});pendingSeconds=0;}};
 const snapshot=()=>{const log=readWritingLog(),week=writingDays(7).reduce((sum,day)=>sum+(log[day]?.net||0),0);return {net:last-baseline,added,seconds:active,elapsed:Math.floor((Date.now()-start)/1000),today:log[writingDay()]?.net||0,week,total:last,reading:Math.max(1,Math.ceil(last/450))};};
 const paint=()=>{
  const s=snapshot(),sign=s.net>=0?'+':'';bar.textContent=`本次 ${sign}${s.net} 字 · ${Math.floor(s.seconds/60)} 分钟`;bar.title='本次指当前文章本次打开后的净变化。汉字按字，其他连续字母和数字按词；不计排版标记、图片或公式代码。删除与撤销计负数。';
  for(const [key,text] of Object.entries({session:`本次 ${sign}${s.net} 字 · 活跃 ${Math.floor(s.seconds/60)} 分钟`,days:`今日净增 ${s.today} 字 · 近七日净增 ${s.week} 字`,total:`编辑文章字数 ${s.total.toLocaleString()} 字 · 预计阅读 ${s.reading} 分钟。汉字按字，其他连续字母和数字按词；格式调整不计字数，后台停留不计活跃时长。`}))document.querySelectorAll('[data-stat-'+key+']').forEach(node=>{if(node.textContent!==text)node.textContent=text;});
 };
 editor.view.dom.addEventListener('input',()=>{lastInput=Date.now();});
 document.getElementById('preview')?.addEventListener('input',()=>{lastInput=Date.now();});
 function update(){
  const a=article(),n=countWritingWords(a.markdown);
  if(owner!==a.id){flush();owner=a.id;last=n;baseline=n;added=0;active=0;lastInput=0;remainder=0;start=Date.now();lastTick=start;paint();return;}
  const delta=n-last;if(delta){recordWriting(writingDay(),{net:delta,added:Math.max(0,delta)});added+=Math.max(0,delta);last=n;}paint();
 }
 setInterval(()=>{
  const now=Date.now(),elapsed=Math.max(0,Math.min(2000,now-lastTick));lastTick=now;update();
  const day=writingDay();if(day!==pendingDay){flush();pendingDay=day;}
  if(lastInput&&document.visibilityState==='visible'&&now-lastInput<60000&&document.activeElement?.closest('.cm-editor,#preview [contenteditable]')){remainder+=elapsed;const seconds=Math.floor(remainder/1000);remainder%=1000;active+=seconds;pendingSeconds+=seconds;if(pendingSeconds>=15)flush();}else remainder=0;
  paint();
 },1000);
 document.addEventListener('visibilitychange',()=>{update();flush();lastTick=Date.now();remainder=0;if(document.hidden)lastInput=0;});
 window.addEventListener('pagehide',()=>{update();flush();});paint();
 return {update,flush:()=>{update();flush();},summary:()=>{update();return snapshot();}};
}
