import type {MarkdownEditor} from './editor';
import {preference,readPreference} from './storage';
const count=(s:string)=>s.replace(/\s/g,'').length;
type Log={net:number;added:number;seconds:number};
export function mountWritingStatistics(editor:MarkdownEditor,article:()=>{id:string;markdown:string}){
 let owner=article().id,last=count(article().markdown),baseline=last,added=0,start=Date.now(),active=0,lastInput=Date.now();let logs:Record<string,Log>={};try{logs=JSON.parse(readPreference('writing-log','{}'));}catch{}
 const bar=document.createElement('span');bar.id='session-statistics';document.querySelector('.editor-bottom')!.append(bar);
 const today=()=>new Date().toLocaleDateString('sv-SE');const persist=()=>{const cutoff=Date.now()-100*86400000;for(const d of Object.keys(logs))if(new Date(d).getTime()<cutoff)delete logs[d];preference('writing-log',JSON.stringify(logs));};
 const paint=()=>{const net=count(article().markdown)-baseline;bar.textContent=`本次 ${net>=0?'+':''}${net} 字 · ${Math.floor(active/60)} 分钟`;bar.title='净增按非空白字符计算；删除与撤销计负数，文章总字数在左侧。';};
 editor.view.dom.addEventListener('input',()=>{lastInput=Date.now();setTimeout(update,0);});
 function update(){const a=article(),n=count(a.markdown);if(owner!==a.id){owner=a.id;last=n;baseline=n;added=0;active=0;start=Date.now();paint();return;}const delta=n-last;if(delta){const d=logs[today()]??={net:0,added:0,seconds:0};d.net+=delta;d.added+=Math.max(0,delta);added+=Math.max(0,delta);last=n;persist();}paint();}
 setInterval(()=>{update();if(document.visibilityState==='visible'&&Date.now()-lastInput<60000&&document.activeElement?.closest('.cm-editor,#preview [contenteditable]')){active++;(logs[today()]??={net:0,added:0,seconds:0}).seconds++;if(active%15===0)persist();}paint();},1000);
 return {update,summary:()=>{update();const cutoff=Date.now()-7*86400000,week=Object.entries(logs).filter(([d])=>new Date(d).getTime()>=cutoff).reduce((s,[,v])=>s+v.net,0);return {net:last-baseline,added,seconds:active,elapsed:Math.floor((Date.now()-start)/1000),today:logs[today()]?.net||0,week,total:last,reading:Math.max(1,Math.ceil(last/300))};}};
}
