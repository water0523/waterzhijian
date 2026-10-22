import {escapeHTML as esc} from './model';
import {readPreference,preference} from './storage';
export interface Command{id:string;title:string;group:string;keywords?:string;run:()=>unknown}
export function mountCommandPalette(commands:()=>Command[],notify:(text:string,error?:boolean)=>void=()=>{}){
 const dialog=document.createElement('dialog');dialog.id='command-palette';dialog.setAttribute('aria-label','命令面板');
 dialog.innerHTML='<header><input type="search" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls="command-results" placeholder="搜索文章、主题、命令…支持多个关键词" aria-label="搜索命令"><select aria-label="命令分类"><option value="">全部</option></select><button title="关闭命令面板 Esc" aria-label="关闭命令面板">×</button></header><div id="command-results" role="listbox" aria-label="搜索结果"></div><footer><span role="status" id="command-count"></span><button id="command-more" hidden>显示更多</button><span>↑↓ 选择 · Enter 执行 · Esc 关闭</span></footer>';
 document.body.append(dialog);const input=dialog.querySelector('input')!,group=dialog.querySelector('select')!,list=dialog.querySelector('#command-results')!,count=dialog.querySelector('#command-count')!,more=dialog.querySelector<HTMLButtonElement>('#command-more')!;
 let index=0,choices:Command[]=[],catalog:Command[]=[],owner:HTMLElement|null=null,limit=70,composing=false;
 const recents=():string[]=>{try{const data:unknown=JSON.parse(readPreference('command-recents','[]'));return Array.isArray(data)?[...new Set(data.filter((v):v is string=>typeof v==='string'))].slice(0,5):[];}catch{return [];}};
 const draw=(reveal=true)=>{
  const recent=recents();list.innerHTML=choices.slice(0,limit).map((c,i)=>`<button id="command-option-${i}" role="option" data-command="${i}" aria-selected="${i===index}" tabindex="-1"><span>${esc(c.title)}</span><small>${esc(c.group)}${recent.includes(c.id)?' · 最近':''}</small></button>`).join('')||'<p class="command-empty">没有匹配的命令。试试减少关键词或切换分类。</p>';
  count.textContent=choices.length?`共 ${choices.length} 项 · 已显示 ${Math.min(limit,choices.length)} 项`:'没有匹配结果';more.hidden=choices.length<=limit;
  if(choices.length){input.setAttribute('aria-activedescendant','command-option-'+index);if(reveal)list.querySelector('[aria-selected=true]')?.scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');
 };
 const search=()=>{
  const q=input.value.toLocaleLowerCase().trim(),words=q.split(/\s+/).filter(Boolean),recent=recents();index=0;limit=70;
  const score=(c:Command)=>{const title=c.title.toLocaleLowerCase();return title===q?0:title.startsWith(q)?1:2;};
  choices=catalog.filter(c=>(!group.value||c.group===group.value)&&words.every(w=>(c.title+' '+c.group+' '+(c.keywords||'')).toLocaleLowerCase().includes(w))).sort((a,b)=>q?score(a)-score(b):(recent.indexOf(a.id)<0?999:recent.indexOf(a.id))-(recent.indexOf(b.id)<0?999:recent.indexOf(b.id)));draw();
 };
 const close=()=>{dialog.close();composing=false;if(owner?.isConnected)owner.focus({preventScroll:true});};
 const run=async(i:number)=>{
  const c=choices[i];if(!c)return;close();
  try{await c.run();preference('command-recents',JSON.stringify([c.id,...recents().filter(id=>id!==c.id)].slice(0,5)));}
  catch{notify('执行“'+c.title+'”失败，请重试。',true);}
 };
 input.oninput=()=>{if(!composing)search();};input.addEventListener('compositionstart',()=>{composing=true;});input.addEventListener('compositionend',()=>{composing=false;search();});group.onchange=search;
 more.onclick=()=>{limit+=70;draw(false);if(more.hidden)input.focus({preventScroll:true});};dialog.querySelector('header button')!.addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 list.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-command]');if(b)void run(Number(b.dataset.command));});
 dialog.onkeydown=e=>{
  if(e.isComposing||composing||e.keyCode===229)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}
  if(e.target!==input)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!choices.length)return;index=(index+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length;limit=Math.max(limit,Math.ceil((index+1)/70)*70);draw();}
  else if(e.key==='Enter'){e.preventDefault();void run(index);}
 };
 const open=()=>{
  if(dialog.open){input.focus();return;}
  owner=document.activeElement as HTMLElement;input.value='';group.value='';composing=false;catalog=commands();group.innerHTML='<option value="">全部</option>'+[...new Set(catalog.map(c=>c.group))].map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');
  dialog.showModal();search();input.focus();
 };
 document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='p'&&!e.isComposing){e.preventDefault();e.stopImmediatePropagation();open();}},true);return {open,close};
}
