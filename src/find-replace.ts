import type {ChangeSpec,Text} from '@codemirror/state';
import type {MarkdownEditor} from './editor';
import {escapeHTML as esc} from './model';
import {inlineFonts,literaryRoles,inlineOrnaments,type InlineStyle} from './inline-style';
import {showInlineMenu,type InlineMenu} from './inline-picker';
import {closePopover,standardColors} from './popover';
import {selectionStyleKeys,textStyleChanges} from './text-selection';
import {findFormats,findText,formatFilters,formatFindPlan,type FindHit,type FormatFilter} from './find-formats';

type Host={editor:MarkdownEditor;preview:HTMLElement;articleId:()=>string;reveal:()=>void;render:()=>void;notify:(text:string,error?:boolean)=>void;renderSample:(root:HTMLElement,markdown:string)=>void};
const directEffects=['bold','italic','underline','wave','strike'] as const;
export class FindReplace {
  private panel=document.createElement('section');
  private hits:FindHit[]=[];private scannedSource='';private scannedArticle='';
  private checked=new Set<number>();private active=-1;private limit=100;private timer=0;private writing=false;
  private scope?:{from:number;to:number;article:string;doc:Text};private scopeMessage='';private scannedSearch='';
  private get limited(){return this.get<HTMLInputElement>('find-scope-only').checked;}
  private get mode(){return this.get<HTMLSelectElement>('find-mode').value;}
  private get filter(){return this.get<HTMLSelectElement>('find-format-key').value as FormatFilter;}
  private get<T extends HTMLElement=HTMLElement>(id:string){return this.panel.querySelector<T>('#'+id)!;}
  constructor(private host:Host){
    this.panel.id='find-replace-panel';this.panel.className='find-replace-panel';this.panel.hidden=true;this.panel.setAttribute('aria-label','查找替换与格式批量修改');
    this.panel.innerHTML=`<header class="find-heading"><strong>查找替换</strong><select id="find-mode" aria-label="查找类型"><option value="text">文字 / Markdown 源码</option><option value="format">格式</option></select><button id="find-close" type="button" aria-label="关闭查找替换">×</button></header>
      <div class="find-input-row find-scope-row"><label><input id="find-scope-only" type="checkbox">仅在选区内</label><button id="find-use-selection" type="button" title="先在 Markdown 栏框选文字，再使用此范围">使用当前选区</button><span id="find-scope-info" role="status"></span></div>
      <div id="find-text-fields"><div class="find-input-row"><input id="find-query" type="text" placeholder="查找文字" aria-label="查找文字"><label><input id="find-case" type="checkbox">区分大小写</label><label title="前后不能是字母、数字、组合音标或下划线；中文句内查找建议关闭"><input id="find-word" type="checkbox">全词匹配</label></div><div class="find-input-row"><input id="find-replacement" type="text" placeholder="替换为（留空可删除）" aria-label="替换为"><button id="find-replace-one" type="button">替换当前</button><button id="find-replace-all" type="button">全部替换</button></div></div>
      <div id="find-format-fields" class="find-input-row" hidden><label for="find-format-key">查找格式</label><select id="find-format-key">${formatFilters.map(([key,name])=>`<option value="${key}">${name}</option>`).join('')}</select><select id="find-format-value" aria-label="查找格式的颜色或值"></select><span id="find-color-swatch" aria-hidden="true"></span></div>
      <div class="find-results-heading"><label id="find-all-label" hidden><input id="find-select-all" type="checkbox">全选</label><output id="find-count" aria-live="polite">输入文字开始查找</output><button id="find-previous" type="button" title="上一处">↑</button><button id="find-next" type="button" title="下一处">↓</button></div>
      <ul id="find-results" aria-label="查找结果"></ul><button id="find-more" type="button" hidden>显示更多结果</button>
      <div id="find-bulk" hidden><div class="find-input-row"><span id="find-selected-count">已选 0 处</span><select id="find-action" aria-label="要批量修改的格式">${[['marker','半高荧光'],['highlight','荧光'],['font','字体'],['size','字号'],['color','字色'],['bold','加粗'],['italic','斜体'],['underline','下划线'],['wave','波浪线'],['strike','删除线'],['effect','修饰 / 清除全部'],['role','文体']].map(([key,name])=>`<option value="${key}">${name}</option>`).join('')}</select><button id="find-apply" type="button">选择并应用 ▾</button><button id="find-clear" type="button">清除该项</button></div><p class="find-help">只修改勾选的片段；格式查找不包含主题默认样式、代码与公式。可一次撤销。</p></div>
      <p id="find-status" class="find-help" role="status" aria-live="polite"></p>`;
    document.getElementById('editor')!.before(this.panel);
    this.get('find-close').onclick=()=>this.close();
    this.get('find-mode').onchange=()=>{closePopover();this.syncMode();this.refresh(true);};
    this.get('find-format-key').onchange=()=>{this.get<HTMLSelectElement>('find-format-value').value='';const key=this.filter;this.get<HTMLSelectElement>('find-action').value=['marker','highlight','font','size','color','role',...directEffects].includes(key)?key:'effect';this.refresh(true);};
    this.get('find-action').onchange=()=>this.actionLabel();
    this.get('find-format-value').onchange=()=>this.refresh(true);
    this.get('find-query').oninput=()=>{clearTimeout(this.timer);this.timer=window.setTimeout(()=>this.refresh(true),120);};
    this.get('find-case').onchange=()=>this.refresh(true);
    this.get('find-word').onchange=()=>this.refresh(true);
    this.get('find-scope-only').onchange=()=>{if(this.limited&&!this.scope)this.captureScope();this.refresh(true);};
    this.get('find-use-selection').onclick=()=>{this.captureScope();this.get<HTMLInputElement>('find-scope-only').checked=true;this.refresh(true);};
    host.editor.observeDocumentChanges(update=>{
      if(!this.scope)return;
      if(this.scope.article!==host.articleId()||this.scope.doc!==update.startState.doc){this.invalidateScope('原选区已失效，请重新框选，或取消“仅在选区内”。');return;}
      this.scope={...this.scope,from:update.changes.mapPos(this.scope.from,-1),to:update.changes.mapPos(this.scope.to,1),doc:update.state.doc};
    });
    this.get<HTMLInputElement>('find-select-all').onchange=()=>{this.checked=this.get<HTMLInputElement>('find-select-all').checked?new Set(this.hits.map((_,index)=>index)):new Set();this.renderRows();};
    this.get('find-results').onclick=event=>{
      const target=event.target as HTMLElement,choice=target.closest<HTMLInputElement>('input[data-find-check]'),jump=target.closest<HTMLButtonElement>('button[data-find-jump]');
      if(choice){const index=Number(choice.dataset.findCheck);if(choice.checked)this.checked.add(index);else this.checked.delete(index);this.syncSelection();}else if(jump)this.jump(Number(jump.dataset.findJump));
    };
    this.get('find-previous').onclick=()=>this.step(-1);this.get('find-next').onclick=()=>this.step(1);
    this.get('find-more').onclick=()=>{this.limit+=100;this.renderRows();};
    this.get('find-replace-one').onclick=()=>this.replace(false);this.get('find-replace-all').onclick=()=>this.replace(true);
    this.get('find-apply').onclick=()=>this.styleMenu();
    this.get('find-clear').onclick=()=>this.applyStyle(this.filter==='any'?Object.fromEntries(selectionStyleKeys.map(key=>[key,undefined])):this.filter==='marker'?{marker:undefined,markerColor:undefined}:{[this.filter]:undefined});
    this.panel.addEventListener('keydown',event=>{if(event.defaultPrevented||event.isComposing||event.keyCode===229)return;if(event.key==='Escape'){if(document.getElementById('quick-popover'))closePopover();else this.close();event.preventDefault();event.stopPropagation();}else if(event.key==='Enter'&&(event.target as HTMLElement).id==='find-query'){event.preventDefault();clearTimeout(this.timer);this.refresh();this.step(event.shiftKey?-1:1);}});
    document.addEventListener('keydown',event=>{
      if(event.defaultPrevented||event.isComposing||event.keyCode===229||!(event.ctrlKey||event.metaKey)||event.altKey||!['f','h'].includes(event.key.toLowerCase())||document.querySelector('dialog[open]'))return;
      event.preventDefault();event.stopPropagation();this.open(event.key.toLowerCase()==='h');
    },true);
  }
  open(replace=false){
    if(this.panel.hidden){this.captureScope();const s=this.host.editor.view.state.selection.main,text=this.host.editor.view.state.sliceDoc(s.from,s.to);if(text&&text.length<=200&&!/[\r\n]/.test(text)){this.get<HTMLInputElement>('find-query').value=text;this.get<HTMLSelectElement>('find-mode').value='text';}}
    closePopover();this.host.reveal();this.panel.hidden=false;document.getElementById('search-button')?.setAttribute('aria-expanded','true');
    if(replace)this.get<HTMLSelectElement>('find-mode').value='text';
    this.syncMode();this.refresh(true);const field=this.mode==='format'?this.get('find-format-key'):this.get<HTMLInputElement>(replace?'find-replacement':'find-query');field.focus();if(field instanceof HTMLInputElement)field.select();this.host.editor.view.requestMeasure();
  }
  toggle(){if(this.panel.hidden)this.open();else this.close();}
  close(){closePopover();this.panel.hidden=true;this.scope=undefined;this.get<HTMLInputElement>('find-scope-only').checked=false;clearTimeout(this.timer);CSS.highlights?.delete('paper-find');document.getElementById('search-button')?.setAttribute('aria-expanded','false');this.host.editor.view.requestMeasure();this.host.editor.view.focus();}
  private invalidateScope(message:string){this.scope=undefined;this.scopeMessage=message;}
  private captureScope(){const s=this.host.editor.view.state.selection.main;if(s.empty){this.invalidateScope('请先在 Markdown 栏框选文字，再点“使用当前选区”。');return;}this.scope={from:s.from,to:s.to,article:this.host.articleId(),doc:this.host.editor.view.state.doc};this.scopeMessage='';}
  private syncScope(){
    const doc=this.host.editor.view.state.doc;if(this.scope&&(this.scope.article!==this.host.articleId()||this.scope.doc!==doc))this.invalidateScope('文章或编辑状态已切换，请重新框选，或取消“仅在选区内”。');
    const valid=this.scope&&this.scope.to>this.scope.from,info=this.get('find-scope-info');info.textContent=this.limited?(valid?`仅选区 · 第 ${doc.lineAt(this.scope!.from).number}–${doc.lineAt(this.scope!.to).number} 行 · ${this.scope!.to-this.scope!.from} 字符`:this.scopeMessage||'选区已为空，请重新框选，或取消“仅在选区内”。'):'全文查找 · 可框选后限定修改范围';info.classList.toggle('find-scope-invalid',this.limited&&!valid);return !this.limited||!!valid;
  }
  private syncMode(){const format=this.mode==='format';for(const id of ['find-format-fields','find-bulk','find-all-label'])this.get(id).hidden=!format;this.get('find-text-fields').hidden=format;}
  refresh(force=false){
    if(this.panel.hidden||this.writing)return;
    clearTimeout(this.timer);
    const scopeValid=this.syncScope(),range=this.limited&&this.scope?{from:this.scope.from,to:this.scope.to}:undefined;
    const signature=JSON.stringify([this.mode,this.filter,this.get<HTMLSelectElement>('find-format-value').value,this.get<HTMLInputElement>('find-query').value,this.get<HTMLInputElement>('find-case').checked,this.get<HTMLInputElement>('find-word').checked,this.limited,range,scopeValid]);
    const source=this.host.editor.view.state.doc.toString(),article=this.host.articleId();if(!force&&source===this.scannedSource&&article===this.scannedArticle&&signature===this.scannedSearch)return;
    if(document.getElementById('quick-popover')?.dataset.anchor?.startsWith('find-'))closePopover();
    this.scannedSource=source;this.scannedArticle=article;this.scannedSearch=signature;this.checked.clear();this.active=-1;this.limit=100;CSS.highlights?.delete('paper-find');
    if(this.mode==='format'){
      const value=this.get<HTMLSelectElement>('find-format-value'),chosen=value.value,all=scopeValid?findFormats(source,this.filter,'',range):[],values=[...new Set(all.map(hit=>hit.value))].sort((a,b)=>this.filter==='size'?Number(a)-Number(b):a.localeCompare(b));
      value.innerHTML='<option value="">全部颜色 / 值</option>'+values.map(v=>`<option value="${esc(v)}">${esc(this.valueLabel(v))}</option>`).join('')+(chosen&&!values.includes(chosen)?`<option value="${esc(chosen)}">${esc(this.valueLabel(chosen))}（0 处）</option>`:'');value.value=chosen;
      value.hidden=!['marker','highlight','font','size','color','role','ornament'].includes(this.filter);this.hits=value.value?all.filter(hit=>hit.value===value.value):all;
      const swatch=this.get('find-color-swatch');swatch.hidden=!/^#[\da-f]{6}$/i.test(value.value);if(!swatch.hidden)swatch.style.background=value.value;
    }else this.hits=scopeValid?findText(source,this.get<HTMLInputElement>('find-query').value,this.get<HTMLInputElement>('find-case').checked,{wholeWord:this.get<HTMLInputElement>('find-word').checked,range}):[];
    this.get('find-status').textContent='';this.renderRows();
  }
  private valueLabel(value:string){
    if(this.filter==='font')return inlineFonts[value]?.name||value;if(this.filter==='role')return literaryRoles[value as keyof typeof literaryRoles]||value;if(this.filter==='ornament')return inlineOrnaments[value as keyof typeof inlineOrnaments]||value;if(this.filter==='size')return value+' px';
    if(value==='true')return formatFilters.find(([key])=>key===this.filter)![1];
    return (standardColors.find(([,color])=>color.toLowerCase()===value)?.[0]||(/^#/.test(value)?'自定色':''))+(value.startsWith('#')?' '+value:value);
  }
  private renderRows(){
    this.get('find-count').textContent=this.hits.length?`共 ${this.hits.length} 处${this.active>=0?' · 当前 '+(this.active+1):''}`:this.mode==='text'&&!this.get<HTMLInputElement>('find-query').value?'输入文字开始查找':'没有匹配结果';
    this.get('find-results').innerHTML=this.hits.slice(0,this.limit).map((hit,index)=>`<li class="${index===this.active?'active':''}">${this.mode==='format'?`<input type="checkbox" data-find-check="${index}" aria-label="选择第 ${index+1} 处，第 ${hit.line} 行" ${this.checked.has(index)?'checked':''}>`:''}<button type="button" data-find-jump="${index}" ${index===this.active?'aria-current="true"':''} title="${esc(hit.text)}"><small>第 ${hit.line} 行${this.mode==='format'?' · '+esc(this.valueLabel(hit.value)):''}</small><span>${esc(hit.text.slice(0,120))}${hit.text.length>120?'…':''}</span></button></li>`).join('');
    this.get('find-more').hidden=this.limit>=this.hits.length;this.get('find-more').textContent=`显示更多（已显示 ${Math.min(this.limit,this.hits.length)} / ${this.hits.length}）`;
    for(const id of ['find-previous','find-next','find-replace-one','find-replace-all'])this.get<HTMLButtonElement>(id).disabled=!this.hits.length;this.syncSelection();
  }
  private syncSelection(){
    const all=this.get<HTMLInputElement>('find-select-all');all.checked=!!this.hits.length&&this.checked.size===this.hits.length;all.indeterminate=this.checked.size>0&&this.checked.size<this.hits.length;all.disabled=!this.hits.length;
    this.get('find-selected-count').textContent=`已选 ${this.checked.size} / ${this.hits.length} 处`;for(const id of ['find-apply','find-clear'])this.get<HTMLButtonElement>(id).disabled=!this.checked.size;this.get('find-clear').textContent=this.filter==='any'?'清除全部格式':'清除该项';this.actionLabel();
  }
  private actionLabel(){const select=this.get<HTMLSelectElement>('find-action'),direct=directEffects.includes(select.value as typeof directEffects[number]);this.get('find-apply').textContent=direct?'切换'+select.selectedOptions[0].textContent:'选择并应用 ▾';this.get('find-apply').title=direct?'全部已有此格式时取消，否则统一应用。':'为勾选的片段选择新的格式';}
  private valid(){
    if(this.syncScope()&&this.scannedSource===this.host.editor.view.state.doc.toString()&&this.scannedArticle===this.host.articleId())return true;
    this.refresh(true);this.host.notify('文章已变化，查找结果已刷新，请重新选择。');return false;
  }
  private jump(index:number){
    if(!this.hits.length||!this.valid())return;
    this.active=(index+this.hits.length)%this.hits.length;this.limit=Math.max(this.limit,this.active+1);const hit=this.hits[this.active];this.host.editor.selectRange(hit.from,hit.to);this.highlightPreview(hit);this.renderRows();this.get('find-results').querySelector<HTMLElement>(`[data-find-jump="${this.active}"]`)?.scrollIntoView({block:'nearest'});
  }
  private step(direction:number){this.jump(this.active<0?(direction<0?this.hits.length-1:0):this.active+direction);}
  private highlightPreview(hit:FindHit){
    CSS.highlights?.delete('paper-find');const runs=[...this.host.preview.querySelectorAll<HTMLElement>('[data-edit-from]')].filter(el=>Number(el.dataset.editFrom)<hit.to&&Number(el.dataset.editTo)>hit.from);if(!runs.length)return;
    for(let parent=runs[0].parentElement;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;runs[0].scrollIntoView({block:'center'});
    if(!CSS.highlights||typeof Highlight==='undefined')return;
    const point=(run:HTMLElement,position:number)=>{
      const from=Number(run.dataset.editFrom),to=Number(run.dataset.editTo),length=(run.textContent||'').length,target=to-from===length?Math.max(0,Math.min(length,position-from)):position<=from?0:length;
      const walker=document.createTreeWalker(run,NodeFilter.SHOW_TEXT);let node,count=0;while(node=walker.nextNode()){if(count+(node.textContent||'').length>=target)return {node,offset:target-count};count+=(node.textContent||'').length;}return null;
    };
    const a=point(runs[0],hit.from),b=point(runs.at(-1)!,hit.to);if(!a||!b)return;const range=document.createRange();range.setStart(a.node,a.offset);range.setEnd(b.node,b.offset);CSS.highlights.set('paper-find',new Highlight(range));
  }
  private write(changes:ChangeSpec[],message:string){
    if(!this.valid())return false;if(!changes.length){this.get('find-status').textContent='所选内容未变化。';return true;}
    closePopover();this.writing=true;try{this.host.editor.formatTextRanges(changes,false);this.host.render();}finally{this.writing=false;}this.refresh(true);this.get('find-status').textContent=message+'，可撤销。';return true;
  }
  private replace(all:boolean){
    clearTimeout(this.timer);this.refresh();if(!this.valid()||!this.hits.length)return;const text=this.get<HTMLInputElement>('find-replacement').value,target=all?this.hits:[this.hits[Math.max(0,this.active)]],changes=target.filter(hit=>this.scannedSource.slice(hit.from,hit.to)!==text).map(hit=>({from:hit.from,to:hit.to,insert:text})),next=this.host.editor.view.state.changes(changes).mapPos(target[0].to,1);if(this.write(changes,`已替换 ${changes.length} 处`)&&!all&&this.hits.length){const index=this.hits.findIndex(hit=>hit.from>=next);this.jump(index<0?0:index);}
  }
  private selectedHits(){return [...this.checked].sort((a,b)=>a-b).map(index=>this.hits[index]);}
  private applyStyle(patch:InlineStyle,plan=formatFindPlan(this.scannedSource,this.selectedHits()),article=this.scannedArticle){
    if(!this.valid()||!plan.selected.length)return false;if(plan.error){this.host.notify(plan.error);return false;}
    if(plan.source!==this.scannedSource||article!==this.scannedArticle){this.host.notify('文章已变化，请重新选择查找结果。');return false;}
    if(patch.size!==undefined&&(!Number.isFinite(patch.size)||patch.size<10||patch.size>64||Math.round(patch.size*10)!==patch.size*10)){this.host.notify('字号范围是 10–64 px，最多一位小数。');return false;}
    return this.write(textStyleChanges(plan,patch),`已修改 ${this.checked.size} 处格式`);
  }
  private styleMenu(){
    if(!this.valid()||!this.checked.size)return;const action=this.get<HTMLSelectElement>('find-action').value,plan=formatFindPlan(this.scannedSource,this.selectedHits()),article=this.scannedArticle;
    if(directEffects.includes(action as typeof directEffects[number])){const key=action as typeof directEffects[number],enabled=plan.common[key]!==true,patch:InlineStyle={[key]:enabled?true:undefined};if(enabled&&key==='underline')patch.wave=undefined;if(enabled&&key==='wave')patch.underline=undefined;this.applyStyle(patch,plan,article);return;}
    const kind=action as InlineMenu;
    showInlineMenu(this.get('find-apply'),kind,plan.common,this.host.renderSample,(style,change)=>{
      let patch:InlineStyle;if(change?.clear)patch=Object.fromEntries(selectionStyleKeys.map(key=>[key,undefined]));
      else if(kind==='effect'){const key=change!.effect!;patch={[key]:style[key]};if(key==='gold'&&style.gold)Object.assign(patch,{marker:undefined,markerColor:undefined,ornament:undefined});if(key==='ornament'&&style.ornament)patch.gold=undefined;}
      else if(kind==='marker')patch={marker:style.marker,markerColor:style.markerColor,...(style.marker?{gold:undefined}:{})};else patch={[kind]:style[kind]};return this.applyStyle(patch,plan,article);
    });
  }
}
