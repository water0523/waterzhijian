import {articleOutline,type OutlineHeading} from './render';
import {escapeHTML as esc} from './model';
import {preference,readPreference} from './storage';
import type {MarkdownEditor} from './editor';
import type {Text} from '@codemirror/state';
type Fold={from:number;to:number;signature:string};
type StoredFold=Pick<Fold,'from'|'signature'>;
type Host={article:()=>{id:string;markdown:string};editor:MarkdownEditor;preview:HTMLElement;jump:(position:number)=>void};
const json=(key:string):unknown=>{try{return JSON.parse(readPreference(key,'{}'));}catch{return {};}};
function readFolds(){const raw=json('outline-folds-v2'),store:Record<string,StoredFold[]>=Object.create(null);if(!raw||typeof raw!=='object'||Array.isArray(raw))return store;for(const [key,value] of Object.entries(raw).slice(-20)){if(key.length>200||!Array.isArray(value))continue;store[key]=value.slice(0,5000).filter(v=>v&&Number.isSafeInteger(v.from)&&v.from>=0&&typeof v.signature==='string').map(v=>({from:v.from,signature:v.signature.slice(0,512)}));}return store;}

export function mountWritingOutline(h:Host){
 const root=document.createElement('aside');root.id='persistent-outline';root.hidden=true;root.setAttribute('aria-label','文章大纲');root.innerHTML='<header><strong>文章大纲</strong><button aria-label="关闭大纲">×</button></header><input type="search" placeholder="搜索章节" aria-label="搜索大纲"><div class="outline-actions"><button id="outline-expand">全部展开</button><button id="outline-collapse">收起下级</button><label><input type="checkbox" id="outline-follow">跟随定位</label></div><p id="outline-count" role="status"></p><nav id="outline-tree" aria-label="文章章节"></nav><p id="outline-current" aria-live="polite"></p>';
 const query=root.querySelector<HTMLInputElement>('input[type=search]')!,tree=root.querySelector<HTMLElement>('#outline-tree')!,follow=root.querySelector<HTMLInputElement>('#outline-follow')!,store=readFolds(),scroll=document.getElementById('preview-scroll')!;
 follow.checked=readPreference('outline-follow','true')==='true';let owner='',doc:Text|undefined,folds:Fold[]=[],headings:readonly OutlineHeading[]=[],visible:number[]=[],origin:'editor'|'preview'='editor',frame=0,timer=0,signature='',active=-1;
 function save(){clearTimeout(timer);if(!owner)return;delete store[owner];store[owner]=folds.map(({from,signature})=>({from,signature}));for(const key of Object.keys(store).slice(0,-20))delete store[key];const encoded=JSON.stringify(store);preference('outline-folds-v2',encoded);
  // Remove the migrated legacy index only after the new record was written,
  // so evicting an old article cannot later revive its stale index-based fold.
  if(readPreference('outline-folds-v2','')===encoded){const legacy=json('outline-folds');if(legacy&&typeof legacy==='object'&&!Array.isArray(legacy)&&Object.hasOwn(legacy,owner)){delete (legacy as Record<string,unknown>)[owner];preference('outline-folds',JSON.stringify(legacy));}}
 }
 function scheduleSave(){clearTimeout(timer);timer=window.setTimeout(save,300);}
 function load(nextDoc=h.editor.view.state.doc){
  const id=h.article().id;if(owner===id&&doc===nextDoc)return;
  if(owner)save();owner=id;doc=nextDoc;signature='';active=-1;
  const saved=store[id],legacy=json('outline-folds'),indexes=legacy&&typeof legacy==='object'&&!Array.isArray(legacy)?(legacy as Record<string,unknown>)[id]:undefined;
  const items=saved?.length||!Object.hasOwn(store,id)&&Array.isArray(indexes)&&indexes.length?articleOutline(doc.toString()):[];
  let positions:StoredFold[]=saved||[];
  if(!Object.hasOwn(store,id))positions=Array.isArray(indexes)?indexes.filter(i=>Number.isSafeInteger(i)&&items[i]).map(i=>({from:items[i].from,signature:items[i].signature.slice(0,512)})):[];
  folds=items.filter(item=>positions.some(p=>p.from===item.from&&p.signature===item.signature.slice(0,512))).map(item=>({from:item.from,to:doc!.lineAt(Math.max(item.from,item.to-1)).to,signature:item.signature.slice(0,512)}));scheduleSave();
 }
 h.editor.observeDocumentChanges(update=>{
  load(update.startState.doc);const hadFolds=folds.length,removed=new Set<Fold>();update.changes.iterChangedRanges((a,b)=>{if(b>a)for(const fold of folds)if(a<=fold.from&&b>=fold.to)removed.add(fold);});
  folds=folds.filter(f=>!removed.has(f)).map(f=>{const from=update.state.doc.lineAt(update.changes.mapPos(f.from,1)).from,to=update.changes.mapPos(f.to,-1);return {from,to:Math.max(from,to),signature:update.state.doc.lineAt(from).text.slice(0,512)};});doc=update.state.doc;if(hadFolds)scheduleSave();scheduleCurrent();
 });
 function hasChildren(i:number){return !!headings[i+1]&&headings[i+1].level>headings[i].level;}
 function isFolded(i:number){return folds.some(f=>f.from===headings[i].from);}
 function fold(i:number,closed:boolean){const item=headings[i];if(!item||!hasChildren(i))return;folds=folds.filter(f=>f.from!==item.from);if(closed)folds.push({from:item.from,to:doc!.lineAt(Math.max(item.from,item.to-1)).to,signature:item.signature.slice(0,512)});save();signature='';refresh();}
 function node(i:number){const item=headings[i];return h.preview.querySelector<HTMLElement>(`h${item.level}[data-line="${item.line}"]`);}
 function jump(i:number){const item=headings[i];if(!item)return;const target=node(i);for(let el=target?.parentElement;el&&el!==h.preview;el=el.parentElement)if(el instanceof HTMLDetailsElement)el.open=true;if(document.body.dataset.layout==='drawer')document.getElementById('writing-panel-close')?.click();origin='editor';h.jump(item.from);target?.scrollIntoView({block:'start'});active=i;paintCurrent();}
 function scheduleCurrent(){cancelAnimationFrame(frame);frame=requestAnimationFrame(updateCurrent);}
 function updateCurrent(){if(!root.getClientRects().length)return;load();if(origin==='editor'){const at=h.editor.view.state.selection.main.head;active=-1;headings.forEach((item,i)=>{if(item.from<=at)active=i;});}else{const top=scroll.getBoundingClientRect().top+30;active=-1;headings.forEach((_,i)=>{const el=node(i);if(el?.getClientRects().length&&el.getBoundingClientRect().top<=top)active=i;});}paintCurrent();}
 function paintCurrent(){
  let shown=active;while(shown>=0&&!visible.includes(shown)){const level=headings[shown].level;let parent=-1;for(let i=shown-1;i>=0;i--)if(headings[i].level<level){parent=i;break;}shown=parent;}
  tree.querySelectorAll<HTMLElement>('[data-jump]').forEach(b=>{const value=String(Number(b.dataset.jump)===shown);if(b.getAttribute('aria-current')!==value)b.setAttribute('aria-current',value);});
  const current=root.querySelector('#outline-current')!,text=active>=0?'当前 · '+headings[active].title:'正文开头';if(current.textContent!==text)current.textContent=text;
  if(follow.checked&&!root.contains(document.activeElement))tree.querySelector<HTMLElement>('[aria-current=true]')?.scrollIntoView({block:'nearest'});
 }
 function refresh(){
  if(root.hidden||!root.getClientRects().length)return;load();headings=articleOutline(doc!.toString());const allowed=new Set(headings.map(n=>n.from));folds=folds.filter(f=>allowed.has(f.from));const terms=query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);visible=[];let hiddenLevel=7;
  headings.forEach((item,i)=>{if(item.level<=hiddenLevel)hiddenLevel=7;const hidden=item.level>hiddenLevel;if(isFolded(i))hiddenLevel=Math.min(hiddenLevel,item.level);if(terms.length?terms.every(t=>item.title.toLocaleLowerCase().includes(t)):!hidden)visible.push(i);});
  root.querySelector('#outline-count')!.textContent=terms.length?`找到 ${visible.length} / ${headings.length} 个章节`:`${headings.length} 个章节 · 显示 ${visible.length} 个`;
  const next=JSON.stringify([headings.map(n=>[n.title,n.level]),visible,headings.map((_,i)=>isFolded(i))]);if(signature!==next){const focused=(document.activeElement as HTMLElement)?.closest<HTMLElement>('[data-jump],[data-fold]'),index=focused&&Number(focused.dataset.jump??focused.dataset.fold),kind=focused?.hasAttribute('data-fold')?'fold':'jump',top=tree.scrollTop;signature=next;
   tree.innerHTML=visible.map(i=>{const item=headings[i];return `<p class="outline-row" style="--outline-depth:${item.level-1}">${hasChildren(i)?`<button data-fold="${i}" aria-label="${isFolded(i)?'展开':'折叠'}${esc(item.title)}的下级" aria-expanded="${!isFolded(i)}" title="折叠 / 展开下级">${isFolded(i)?'▸':'▾'}</button>`:'<span class="outline-leaf" aria-hidden="true"></span>'}<button data-jump="${i}" title="${esc(item.title)} · 第 ${item.line+1} 行"><small>H${item.level}</small><span>${esc(item.title)}</span></button></p>`;}).join('')||'<p class="outline-empty">'+(headings.length?'没有匹配章节':'还没有标题，可输入 # 标题开始规划文章。')+'</p>';tree.scrollTop=top;if(focused&&index!==undefined)tree.querySelector<HTMLElement>(`[data-${kind}="${index}"]`)?.focus({preventScroll:true});
  }else tree.querySelectorAll<HTMLElement>('[data-jump]').forEach(b=>{const item=headings[Number(b.dataset.jump)];b.title=item.title+' · 第 '+(item.line+1)+' 行';});updateCurrent();
 }
 query.oninput=()=>{signature='';refresh();};follow.onchange=()=>{preference('outline-follow',String(follow.checked));paintCurrent();};
 root.querySelector<HTMLButtonElement>('#outline-expand')!.onclick=()=>{folds=[];save();signature='';refresh();};root.querySelector<HTMLButtonElement>('#outline-collapse')!.onclick=()=>{const lowest=Math.max(2,Math.min(...headings.map(n=>n.level)));folds=headings.flatMap((item,i)=>item.level>=lowest&&hasChildren(i)?[{from:item.from,to:doc!.lineAt(Math.max(item.from,item.to-1)).to,signature:item.signature.slice(0,512)}]:[]);save();signature='';refresh();};
 tree.onclick=e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-jump],[data-fold]');if(!b)return;if(b.dataset.fold!==undefined){const i=Number(b.dataset.fold);fold(i,!isFolded(i));}else jump(Number(b.dataset.jump));};
 root.onkeydown=e=>{if(e.isComposing||e.keyCode===229){e.stopPropagation();return;}if(e.key==='Escape'&&e.target===query&&query.value){e.preventDefault();e.stopPropagation();query.value='';signature='';refresh();return;}const b=(e.target as HTMLElement).closest<HTMLElement>('[data-jump]');if(!b)return;const i=Number(b.dataset.jump),index=visible.indexOf(i);let dest:number|undefined;
  if(e.key==='ArrowDown')dest=visible[Math.min(visible.length-1,index+1)];else if(e.key==='ArrowUp')dest=visible[Math.max(0,index-1)];else if(e.key==='Home')dest=visible[0];else if(e.key==='End')dest=visible.at(-1);else if(e.key==='ArrowRight'){if(hasChildren(i)&&isFolded(i))fold(i,false);else if(hasChildren(i))dest=visible[index+1];}else if(e.key==='ArrowLeft'){if(hasChildren(i)&&!isFolded(i))fold(i,true);else dest=[...visible].reverse().find(j=>j<i&&headings[j].level<headings[i].level);}else return;e.preventDefault();e.stopPropagation();if(dest!==undefined)tree.querySelector<HTMLElement>(`[data-jump="${dest}"]`)?.focus();
 };
 for(const event of ['keydown','mousedown','focusin','keyup','mouseup'])h.editor.view.dom.addEventListener(event,()=>{origin='editor';scheduleCurrent();});for(const event of ['wheel','pointerdown'])scroll.addEventListener(event,()=>{origin='preview';scheduleCurrent();},{passive:true});scroll.addEventListener('scroll',()=>{if(origin==='preview')scheduleCurrent();},{passive:true});window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save();});
 return {root,refresh};
}
