import {readWritingLog,normalizeWritingLog,writingDay,type WritingLog} from './writing-log';
import {heatLevel,monthDays,monthWriting,writingDuration,writingAchievements,syncWritingAchievements,normalizeWritingAchievements,readWritingAchievements,emptyWritingDay} from './writing-progress';
import {preference,readPreference} from './storage';
import {uiIcon} from './ui-icons';
import {escapeHTML as esc} from './model';

type Host={open:(title:string,html:string)=>void;flush:()=>void;notify:(text:string,error?:boolean)=>void};
const fmt=(n:number)=>n.toLocaleString(),signed=(n:number)=>(n>0?'+':'')+fmt(n);
const monthLabel=(m:string)=>Number(m.slice(0,4))+' 年 '+Number(m.slice(5))+' 月';
const dayLabel=(day:string)=>Number(day.slice(5,7))+' 月 '+Number(day.slice(8))+' 日';
const heatNames=['暂无积累','轻轻落笔','渐入佳境','投入创作','满载的一天'];

export function mountWritingCalendar(h:Host){
 let month=writingDay().slice(0,7),selected=writingDay(),root:HTMLElement|undefined,refreshQueued=false;
 let importPending:{log:WritingLog;achievements:Record<string,string>}|undefined,importToken=0;
 const currentRoot=()=>root?.isConnected&&root.parentElement?.id==='modal-body';
 function dayDescription(day:string,log:WritingLog){const e=log[day]||emptyWritingDay();return day+'，净增 '+signed(e.net)+' 字，活跃 '+writingDuration(e.seconds)+'，前台 '+writingDuration(e.dwellSeconds)+'，热度 '+heatLevel(e)+'/4';}
 function draw(){
  if(!currentRoot())return;
  const log=readWritingLog(),today=writingDay(),days=monthDays(month),sum=monthWriting(log,month),{unlocked,progress}=syncWritingAchievements(log),entry=log[selected]||emptyWritingDay();
  const active=document.activeElement as HTMLElement|null,focusDay=root!.contains(active)?active?.dataset.writingDay:undefined,focusControl=root!.contains(active)?active?.dataset.calendarControl:undefined;
  const expanded=root!.querySelector<HTMLDetailsElement>('.writing-method')?.open,scroller=root!.closest('dialog')||root!.parentElement!,scroll=scroller.scrollTop;
  const offset=(new Date(month+'-01T12:00:00').getDay()+6)%7,ringLength=2*Math.PI*72,arc=ringLength/days.length;
  root!.innerHTML=`<div class="writing-journal-intro"><div><small>WRITING JOURNAL</small><h3>每一天，都是一页积累。</h3><p>颜色记录投入，文字留下回响。</p></div><div class="journal-files"><button data-calendar-control="export">${uiIcon('export')}导出记录</button><button data-calendar-control="import">${uiIcon('import')}导入记录</button><input id="writing-log-file" type="file" accept="application/json,.json" hidden></div></div>
   <section class="journal-overview" aria-label="本月写作统计"><div class="journal-ring"><svg viewBox="0 0 180 180" aria-hidden="true">${days.map((day,i)=>`<circle cx="90" cy="90" r="72" fill="none" stroke-width="${day===selected?12:8}" data-heat="${heatLevel(log[day])}" stroke-dasharray="${arc-3} ${ringLength-arc+3}" stroke-dashoffset="${-i*arc}" transform="rotate(-90 90 90)"/>`).join('')}<text x="90" y="86" text-anchor="middle" class="journal-ring-number">${sum.days}<tspan class="journal-ring-unit"> 天</tspan></text><text x="90" y="110" text-anchor="middle" class="journal-ring-label">本月写作</text></svg></div>
   <div class="journal-overview-body"><div class="journal-period">${monthLabel(month)}<span>当前连续写作 <b data-current-streak>${progress.streak}</b> 天</span></div><div class="journal-metrics"><div><span>净增字数</span><strong data-month-net>${signed(sum.net)}<small>字</small></strong></div><div><span>活跃写作</span><strong data-month-active>${writingDuration(sum.seconds)}</strong></div><div><span>前台停留</span><strong data-month-dwell>${writingDuration(sum.dwellSeconds)}</strong></div></div><p>环图一格对应一天，与下方日历使用相同热度。</p></div></section>
   <div class="journal-calendar-layout"><section class="journal-calendar-section" aria-label="月度热力日历"><div class="journal-calendar-heading"><h4>${monthLabel(month)}</h4><div><button data-calendar-control="previous" title="上个月" aria-label="上个月">${uiIcon('arrow-left')}</button><button data-calendar-control="today">今天</button><button data-calendar-control="next" title="下个月" aria-label="下个月" ${month>=today.slice(0,7)?'disabled':''}>${uiIcon('arrow-right')}</button></div></div><div class="journal-weekdays" aria-hidden="true">${['一','二','三','四','五','六','日'].map(x=>'<span>'+x+'</span>').join('')}</div><div class="journal-days" role="group" aria-label="${monthLabel(month)}，方向键选择日期，Home / End 选择本月首末日">${'<span class="journal-day-blank" aria-hidden="true"></span>'.repeat(offset)}${days.map(day=>`<button data-writing-day="${day}" data-heat="${heatLevel(log[day])}" aria-pressed="${selected===day}" ${day===today?'aria-current="date"':''} aria-label="${dayDescription(day,log)}" title="${dayDescription(day,log)}" tabindex="${selected===day?0:-1}" ${day>today?'disabled':''}><span>${Number(day.slice(8))}</span>${day===today?'<small>今</small>':''}</button>`).join('')}</div><div class="journal-legend"><span>少</span>${[0,1,2,3,4].map(i=>'<i data-heat="'+i+'" title="热度 '+i+'/4"></i>').join('')}<span>多</span><small>点击日期查看详情</small></div></section>
   <aside class="journal-day-detail" aria-label="所选日期详情"><small>${selected===today?'今天的积累':'那一天的积累'}</small><h4>${dayLabel(selected)}</h4><span class="journal-heat-label" data-heat="${heatLevel(entry)}">${heatNames[heatLevel(entry)]} · ${heatLevel(entry)}/4</span><dl><div><dt>净增字数</dt><dd data-day-net>${signed(entry.net)} <small>字</small></dd></div><div><dt>活跃写作</dt><dd data-day-active>${writingDuration(entry.seconds)}</dd></div><div><dt>前台停留</dt><dd data-day-dwell>${writingDuration(entry.dwellSeconds)}</dd></div></dl><p>${!log[selected]?'这一天没有记录。':entry.net<0?'这一天删减多于新增，投入的时间仍会记录。':!entry.net&&entry.seconds?'即使字数没有增加，打磨文字的时间也算积累。':'阅读与思考计入前台时间，输入后的编辑时间计入活跃写作。'}</p></aside></div>
   <section class="journal-achievements" aria-label="写作成就"><div class="journal-section-heading"><div><small>MILESTONES</small><h4>行文成章 · 里程成就</h4></div><span data-achievement-count>${Object.keys(unlocked).length} / ${writingAchievements.length} 已获得</span></div><div class="journal-lifetime">累计净增 ${fmt(progress.words)} 字 · 活跃 ${writingDuration(progress.seconds)} · ${progress.days} 个写作日 · 最长连续 ${progress.bestStreak} 天</div><div class="journal-badges">${writingAchievements.map(a=>{const value=Math.min(a.goal,a.value(progress)),earned=unlocked[a.id],percent=Math.min(100,Math.max(0,Math.floor(value/a.goal*100)));return `<article class="journal-badge ${earned?'earned':''}" data-achievement="${a.id}"><div class="journal-badge-icon">${uiIcon(a.icon)}${earned?'<i>'+uiIcon('check')+'</i>':''}</div><div><h5>${a.title}</h5><p>${a.description}</p><small>${earned?'已获得 · '+esc(earned):a.unit==='时长'?writingDuration(value)+' / '+writingDuration(a.goal):fmt(value)+' / '+fmt(a.goal)+' '+a.unit}</small>${!earned?`<div class="journal-progress" role="progressbar" aria-label="${a.title}" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div>`:''}</div></article>`;}).join('')}</div></section>
   <details class="writing-method" ${expanded?'open':''}><summary>统计口径与热度说明</summary><p>字数按净变化累计：汉字按字，其他连续字母与数字按词；排版标记、图片地址和公式代码不计字数。删除与撤销可能产生负值，等字数改写不会增加净字数。</p><p>前台停留只统计页面可见且所在窗口获得焦点的时间；包含阅读、思考和活跃写作。活跃写作还需编辑区获得焦点，且最近 60 秒发生过输入。两个时长互相包含，不相加。后台、窗口失焦和设备休眠不累计。</p><p>热度 = 正净增字数 ÷ 500 + 活跃秒数 ÷ 1800 + 前台秒数 ÷ 7200，向上取整并限制为四档。颜色只表示个人投入参考。净增大于 0 或活跃满 1 分钟算一个写作日；单纯停留不增加连续写作天数。</p><p>记录按本机自然日长期保存在当前浏览器，约每 15 秒及离开页面时保存。前台时间从此版本起记录，未记录的旧数据不会补算。已获成就保留，显示日期为获得或首次确认日期。可导出记录备份；文章备份不包含此日历。</p></details><div class="journal-import-preview" aria-live="polite"></div>`;
  if(focusDay)root!.querySelector<HTMLElement>('[data-writing-day="'+focusDay+'"]')?.focus({preventScroll:true});
  else if(focusControl)root!.querySelector<HTMLElement>('[data-calendar-control="'+focusControl+'"]')?.focus({preventScroll:true});
  scroller.scrollTop=scroll;
 }
 function selectDay(day:string,focus=false){selected=day;draw();if(focus)root?.querySelector<HTMLElement>('[data-writing-day="'+day+'"]')?.focus({preventScroll:true});}
 function show(){h.flush();importPending=undefined;importToken++;month=writingDay().slice(0,7);selected=writingDay();h.open('写作日历与成就','<div id="writing-calendar"></div>');root=document.getElementById('writing-calendar')!;draw();root.closest('dialog')!.scrollTop=0;
  root.onclick=async e=>{
   const target=(e.target as HTMLElement).closest<HTMLElement>('[data-calendar-control],[data-writing-day]');if(!target)return;
   if(target.dataset.writingDay){selectDay(target.dataset.writingDay);return;}
   const control=target.dataset.calendarControl;
   if(control==='today'){month=writingDay().slice(0,7);selectDay(writingDay());return;}
   if(control==='previous'||control==='next'){const date=new Date(month+'-01T12:00:00');date.setMonth(date.getMonth()+(control==='next'?1:-1));const next=writingDay(date).slice(0,7);if(next>writingDay().slice(0,7)||next<'0001-01')return;month=next;selectDay(month===writingDay().slice(0,7)?writingDay():month+'-01');return;}
   if(control==='export'){
    h.flush();const data={format:'feishui-writing-journal',version:1,exportedAt:new Date().toISOString(),log:readWritingLog(),achievements:readWritingAchievements()};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='非水成章-写作记录-'+writingDay()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);return;
   }
   if(control==='import'){root!.querySelector<HTMLInputElement>('#writing-log-file')!.click();return;}
   if(control==='cancel-import'){importPending=undefined;root!.querySelector('.journal-import-preview')!.replaceChildren();return;}
   if(control==='confirm-import'&&importPending){
    h.flush();const log=readWritingLog(),unlocked=readWritingAchievements();let count=0;
    for(const [day,entry] of Object.entries(importPending.log))if(!log[day]){log[day]=entry;count++;}
    for(const [id,date] of Object.entries(importPending.achievements))if(!unlocked[id]||date<unlocked[id])unlocked[id]=date;
    const serialized=JSON.stringify(log),badges=JSON.stringify(unlocked);preference('writing-log',serialized);preference('writing-achievements',badges);
    if(readPreference('writing-log','')!==serialized||readPreference('writing-achievements','')!==badges){h.notify('记录未能完整保存，请先导出本机记录备份。',true);return;}
    importPending=undefined;draw();window.dispatchEvent(new Event('paper-writing-log'));h.notify('已补入 '+count+' 天记录，同日记录保留本机数值。');
   }
  };
  root.onkeydown=e=>{
   const day=(e.target as HTMLElement).dataset.writingDay;if(!day)return;
   const dates=monthDays(month).filter(d=>d<=writingDay()),index=dates.indexOf(day),moves:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};let target:number|undefined;
   if(e.key in moves)target=Math.max(0,Math.min(dates.length-1,index+moves[e.key]));else if(e.key==='Home')target=0;else if(e.key==='End')target=dates.length-1;
   if(target!==undefined){e.preventDefault();selectDay(dates[target],true);}
  };
  root.onchange=async e=>{
   const input=e.target as HTMLInputElement;if(input.id!=='writing-log-file'||!input.files?.[0])return;
   const file=input.files[0],origin=root,token=++importToken;input.value='';importPending=undefined;root!.querySelector('.journal-import-preview')!.replaceChildren();
   try{if(file.size>8*1024*1024)throw new Error('请选择小于 8 MB 的写作记录 JSON。');const data=JSON.parse(await file.text());if(root!==origin||!currentRoot()||token!==importToken)return;
    if(!data||data.format!=='feishui-writing-journal'||data.version!==1||!data.log||typeof data.log!=='object'||Array.isArray(data.log))throw new Error('这不是受支持的写作记录备份。');
    importPending={log:normalizeWritingLog(data.log),achievements:normalizeWritingAchievements(data.achievements)};const count=Object.keys(importPending.log).length;if(!count)throw new Error('文件中没有有效的每日记录。');
    const preview=root!.querySelector<HTMLElement>('.journal-import-preview')!;preview.innerHTML=`<strong>准备导入 ${count} 天记录</strong><p>补入本机缺少的日期，同日记录保留本机数值；合并已获成就。不会修改文章。</p><button data-calendar-control="confirm-import">确认合并</button><button data-calendar-control="cancel-import">取消</button>`;preview.scrollIntoView({block:'nearest'});
   }catch(error){if(root!==origin||!currentRoot()||token!==importToken)return;importPending=undefined;h.notify(error instanceof SyntaxError?'文件不是有效的 JSON，请选择导出的写作记录。':(error as Error).message,true);}
  };
 }
 window.addEventListener('paper-writing-log',()=>{if(!currentRoot()||refreshQueued||importPending)return;refreshQueued=true;requestAnimationFrame(()=>{refreshQueued=false;draw();});});
 window.addEventListener('storage',e=>{if(!importPending&&(e.key==='paper-writing-log'||e.key==='paper-writing-achievements'))draw();});
 const library=document.getElementById('library-stats');if(library){library.setAttribute('role','button');library.tabIndex=0;library.setAttribute('aria-label','打开写作日历与成就');library.title='查看每日写作时间、字数、热力日历与成就';library.onclick=show;library.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}};}
 document.addEventListener('click',e=>{if((e.target as HTMLElement).closest('[data-writing-calendar]'))show();});
 return {show};
}
