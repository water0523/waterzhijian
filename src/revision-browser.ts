import type {Article,Revision} from './model';
import {escapeHTML as esc} from './model';
import {mergeRevisionNames,revisionKey,revisionName,cleanRevisionName} from './revision-history';

interface Host {
 article:Article;
 open:(title:string,html:string)=>void;
 themeName:(id:string)=>string;
 saveManual:(name?:string)=>Promise<boolean>;
 rename:(key:string,name:string)=>Promise<boolean>;
 remove:(items:Revision[])=>Promise<boolean>;
 failed:()=>boolean;
 retry:()=>Promise<boolean>;
 compare:(revision:Revision)=>void;
 restore:(revision:Revision)=>void;
 notify:(text:string,error?:boolean)=>void;
}
type Row={revision:Revision;key:string;name:string;date:string;theme:string;index:number;search:string};
const encoder=new TextEncoder();
const size=(bytes:number)=>bytes<1024?bytes+' B':bytes<1024*1024?(bytes/1024).toFixed(1)+' KiB':(bytes/1024/1024).toFixed(1)+' MiB';

export function openRevisionBrowser(h:Host){
 h.open('找回之前的文字',`<div id="revision-browser"><p class="modal-subtitle">${esc(h.article.title)} · 自动保存仅保留最新自动版本；手动版本长期保留。删除历史不改变当前正文。</p><div class="revision-filters"><label>查找版本<input type="search" id="history-search" placeholder="名称、主题或日期" autocomplete="off"></label><label class="revision-manual-filter"><input type="checkbox" id="history-only-manual">只看手动版本</label></div><p id="history-result-count" role="status" aria-live="polite"></p><div class="revision-save-row"><input type="text" id="history-manual-name" maxlength="80" aria-label="手动版本名称（可选）" placeholder="版本名称（可选），例如：发布前"><button id="history-save-manual">手动保存当前版本</button></div><div class="history-actions revision-bulk-actions"><button id="history-select-all">全选当前结果 / 取消全选</button><button id="history-clear-selection">取消所有选择</button><button id="history-delete-selected">删除选中版本</button><button id="history-clear-auto">清除自动版本</button></div><p id="history-selection-summary" role="status" aria-live="polite"></p><div id="history-rows"></div><button id="history-load-more" hidden>显示更多版本</button><p class="help">体积为版本文字与排版记录的估算，不含图片文件，浏览器实际占用可能不同。搜索不读取版本正文。</p></div>`);
 const root=document.getElementById('revision-browser')!,list=root.querySelector<HTMLElement>('#history-rows')!,query=root.querySelector<HTMLInputElement>('#history-search')!,manual=root.querySelector<HTMLInputElement>('#history-only-manual')!,manualName=root.querySelector<HTMLInputElement>('#history-manual-name')!;
 const selected=new Set<string>(),drafts=new Map<string,string>();let rows:Row[]=[],filtered:Row[]=[],limit=50,busy=false,renaming:string|undefined,totalBytes=0;
 const notice=document.createElement('div');notice.id='history-save-error';notice.hidden=true;notice.setAttribute('role','alert');notice.innerHTML='<span>版本更改尚未完成保存，当前窗口仍保留。请重试保存，或保留窗口并从文件菜单导出备份。</span><button id="history-retry-save">重试保存</button>';list.before(notice);
 const button=(id:string)=>root.querySelector<HTMLButtonElement>('#'+id)!;
 function load(){
  const names=mergeRevisionNames(h.article.revisions,h.article.revisionNames);
  rows=[...h.article.revisions].reverse().map((revision,index)=>{const name=revisionName(revision,names),date=new Date(revision.at).toLocaleString('zh-CN'),theme=h.themeName(revision.theme);return {revision,index,key:revisionKey(revision),name,date,theme,search:(name+' '+date+' '+theme+' '+(revision.label?'手动版本':'自动版本')).toLocaleLowerCase()};});
  const keys=new Set(rows.map(r=>r.key));for(const key of selected)if(!keys.has(key))selected.delete(key);if(renaming&&!keys.has(renaming))renaming=undefined;
  totalBytes=encoder.encode(JSON.stringify({revisions:h.article.revisions,revisionNames:names})).byteLength;
 }
 function selection(){
  const visible=new Set(filtered.map(r=>r.key)),chosen=rows.filter(r=>selected.has(r.key)),manualCount=chosen.filter(r=>r.revision.label).length,hidden=chosen.filter(r=>!visible.has(r.key)).length;
  root.querySelector('#history-selection-summary')!.textContent=(busy?'正在保存版本更改 · ':'')+(chosen.length?`已选 ${chosen.length} 个 · 手动 ${manualCount} / 自动 ${chosen.length-manualCount}${hidden?' · 其中 '+hidden+' 个在筛选结果之外':''}`:'未选择版本');
  button('history-delete-selected').disabled=busy||!chosen.length;button('history-clear-selection').disabled=busy||!chosen.length;button('history-select-all').disabled=busy||!filtered.length;button('history-clear-auto').disabled=busy||!rows.some(r=>!r.revision.label);button('history-save-manual').disabled=busy;
  notice.hidden=!h.failed();button('history-retry-save').disabled=busy;
  list.querySelectorAll<HTMLInputElement>('[data-history-select]').forEach(n=>{n.checked=selected.has(n.dataset.historyKey!);n.disabled=busy;n.closest('.history-row')!.classList.toggle('revision-selected',n.checked);});
  list.querySelectorAll<HTMLButtonElement>('button').forEach(n=>n.disabled=busy);list.querySelectorAll<HTMLInputElement>('[data-history-name]').forEach(n=>n.readOnly=busy);manualName.readOnly=busy;root.setAttribute('aria-busy',String(busy));
 }
 function draw(){
  const terms=query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);filtered=rows.filter(r=>(!manual.checked||!!r.revision.label)&&terms.every(t=>r.search.includes(t)));
  root.querySelector('#history-result-count')!.textContent=`找到 ${filtered.length} / ${rows.length} 个版本 · 手动 ${rows.filter(r=>r.revision.label).length} 个 · 版本数据约 ${size(totalBytes)}`;
  list.innerHTML=filtered.slice(0,limit).map(r=>`<div class="history-row" data-history-row="${r.key}"><input type="checkbox" data-history-select="${r.index}" data-history-key="${r.key}" aria-label="选择${esc(r.name)}"><div class="revision-description"><strong>${r.revision.label?'手动版本':'自动版本'} · ${esc(r.name)}</strong><small>${esc(r.date)} · ${r.revision.markdown.length.toLocaleString()} 字符 · ${esc(r.theme)}</small>${renaming===r.key?`<div class="revision-name-editor"><input type="text" maxlength="80" data-history-name="${r.key}" aria-label="修改版本名称" value="${esc(drafts.get(r.key)??r.name)}"><button data-history-name-save="${r.key}">保存名称</button><button data-history-name-cancel="${r.key}">取消</button></div>`:''}</div><div class="history-actions">${r.revision.label?`<button data-history-rename="${r.key}" aria-label="重命名${esc(r.name)}">重命名</button>`:''}<button data-compare-revision="${r.index}">对比 / 查看</button><button data-revision="${r.index}">恢复这个版本</button></div></div>`).join('')||'<div class="empty-state">'+(rows.length?'没有匹配的版本，可清空搜索或取消筛选。':'暂无历史版本。可手动保存当前稿。')+'</div>';
  const more=button('history-load-more');more.hidden=filtered.length<=limit;more.textContent=`显示更多版本（已显示 ${Math.min(limit,filtered.length)} / ${filtered.length}）`;selection();
 }
 async function run(action:()=>Promise<boolean>){
  if(busy)return;busy=true;selection();try{await action();load();draw();}catch(error){h.notify(error instanceof Error?error.message:String(error),true);}finally{busy=false;selection();}
 }
 function cancelName(key:string){renaming=undefined;drafts.delete(key);draw();root.querySelector<HTMLButtonElement>(`[data-history-rename="${key}"]`)?.focus();}
 async function saveName(key:string){
  const input=root.querySelector<HTMLInputElement>(`[data-history-name="${key}"]`);if(!input)return;const name=cleanRevisionName(input.value);if(!name){h.notify('请输入版本名称。');input.focus();return;}
  await run(async()=>{const ok=await h.rename(key,name);if(ok){renaming=undefined;drafts.delete(key);}return ok;});
 }
 query.oninput=manual.onchange=()=>{limit=50;draw();};
 root.oninput=e=>{const n=e.target as HTMLInputElement;if(n.dataset.historyName)drafts.set(n.dataset.historyName,n.value);};
 root.onchange=e=>{const n=e.target as HTMLInputElement;if(n.dataset.historyKey){if(n.checked)selected.add(n.dataset.historyKey);else selected.delete(n.dataset.historyKey);selection();}};
 root.onkeydown=e=>{
  const input=e.target as HTMLInputElement;if(e.isComposing||busy)return;
  if(input.dataset.historyName&&e.key==='Escape'){e.preventDefault();e.stopPropagation();cancelName(input.dataset.historyName);}
  else if(input.dataset.historyName&&e.key==='Enter'){e.preventDefault();void saveName(input.dataset.historyName);}
  else if(input===manualName&&e.key==='Enter'){e.preventDefault();button('history-save-manual').click();}
 };
 root.onclick=e=>{
  const target=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!target||busy)return;
  if(target.id==='history-select-all'){const add=filtered.some(r=>!selected.has(r.key));for(const r of filtered){if(add)selected.add(r.key);else selected.delete(r.key);}selection();}
  else if(target.id==='history-clear-selection'){selected.clear();selection();}
  else if(target.id==='history-load-more'){limit+=50;draw();}
  else if(target.id==='history-retry-save')void run(h.retry);
  else if(target.id==='history-save-manual')void run(async()=>{const ok=await h.saveManual(cleanRevisionName(manualName.value)||undefined);if(ok)manualName.value='';return ok;});
  else if(target.id==='history-delete-selected')void run(()=>h.remove(rows.filter(r=>selected.has(r.key)).map(r=>r.revision)));
  else if(target.id==='history-clear-auto')void run(()=>h.remove(rows.filter(r=>!r.revision.label).map(r=>r.revision)));
  else if(target.dataset.historyRename){const key=target.dataset.historyRename;renaming=key;draw();const input=root.querySelector<HTMLInputElement>(`[data-history-name="${key}"]`)!;input.focus();input.select();}
  else if(target.dataset.historyNameCancel)cancelName(target.dataset.historyNameCancel);
  else if(target.dataset.historyNameSave)void saveName(target.dataset.historyNameSave);
  else if(target.dataset.compareRevision!==undefined)h.compare(rows[Number(target.dataset.compareRevision)].revision);
  else if(target.dataset.revision!==undefined)h.restore(rows[Number(target.dataset.revision)].revision);
 };
 load();draw();
}
