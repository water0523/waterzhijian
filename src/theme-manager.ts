import {escapeHTML as esc,fontNames} from './model';
import {builtInIds,themes,themeById,themeCSS,themeDefaults,materializeTheme,themeLibraryDocument,themeLibraryError,rawThemeLibrary,resetBrokenThemeLibrary,isThemeHidden,setThemeHidden,restoreThemes,planThemeImports} from './themes';
import {parseThemeFile,themeDocument,themeFileLimit} from './theme-schema';
import type {Theme,ThemeDefinition} from './theme-types';
import {decorateTheme} from './theme-design';
import {renderMarkdown} from './render';
import {download,safeName} from './files';
import {journalPreviewSample} from './journal-sample';
import {folioSample,folioAssets} from './folio-sample';
import {isFolio} from './folio-design';
import {editionSamples,editionAssets} from './edition-samples';
import {themeMatches} from './theme-search';

type Host={open:(title:string,html:string,eyebrow?:string)=>void;close:()=>void;notify:(message:string,error?:boolean)=>void;changed:()=>void;apply:(id:string)=>void;current:()=>string};
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const sample='# 把日常，读成一页风景\n\n文字既是记录，也是观察世界的方式。以清楚的层次，留下值得回味的内容。\n\n## 从一个好问题开始\n\n排版的意义，是让**值得读的文字**更容易被读懂。每一个标题、注释和停顿，都有自己的位置。\n\n### 观察与思考\n\n> 风经过书页，留下微小而明亮的回声。好的问题，也会为我们打开新的窗。\n\n$$E=mc^2$$\n\n| 记录 | 观察 |\n| --- | --- |\n| 清晨 | 光与影 |\n| 黄昏 | 风与云 |\n\n- 认真观察\n- 留下记录\n\n:::poem center\n光落在纸上\n故事仍在继续\n:::\n\n---\n\n继续写下属于自己的文字。';
export const exampleTheme:ThemeDefinition={id:'custom-cedar-journal',name:'杉影札记',group:'文学',description:'宋楷书页、杉绿色题签与温润的档案式引文',base:'plain',palette:{accent:'#3f6254',paper:'#fffdf7',ink:'#373f39'},fonts:{body:'serif',heading:'kai',quote:'fang',caption:'sans',code:'mono',poem:'kai'},typography:{size:16,lineHeight:2,paragraphGap:24,padding:26,indent:false,tableStyle:'three-line'},elements:{h1:{font:'serif',size:30,weight:600,letterSpacing:2,borderSide:'top',borderWidth:3,borderColor:'#3f6254',padding:18,marginBottom:34},h2:{font:'kai',size:22,weight:700,borderSide:'bottom',borderWidth:1,borderColor:'#c8d4c7',padding:8,marginTop:34},quote:{font:'fang',size:17,background:'#f1f4ec',borderSide:'left',borderWidth:2,borderColor:'#3f6254',padding:20,radius:0},caption:{font:'sans',size:12,color:'#6f7c70',letterSpacing:.5},formula:{background:'#f4f6ef',borderWidth:0,padding:20}},ornaments:{label:'CEDAR / FIELD JOURNAL',mark:'',numbered:false,quoteLabel:'页边札记',codeLabel:'NOTES / CODE'}};
const guide=`# 纸间主题文件规范 · v1

主题是 UTF-8 JSON 文件，可直接离线导入。先下载示例，保留结构再改数值。主题预览不更改文章，确认导入后才写入当前浏览器。

顶层：format 固定为 zhijian-theme；version 为数字 1；theme 为主题对象。
theme 必填：id、name、group、base、palette；description 可选。
id：小写字母、数字和连字符，以字母开头，最多 60 字符。自动加 custom- 前缀，与内置主题隔离。
name：1–32 字；description：1–140 字；group：科普 / 文学 / 通用。
base：内置主题标识，继承其完整标题、引用、图表与装饰。可在完整主题库中查看每个标识。
palette：accent、paper、ink，全部是 #RRGGBB 六位颜色。

fonts 可选字段：body、heading、quote、caption、code、poem。可选字体标识：
${Object.entries(fontNames).map(([k,v])=>'- '+k+'：'+v).join('\n')}
字体使用本机字体和回退链，主题文件不会下载或嵌入字体；不同设备可能显示不同字形。

typography 可选：size (12–24 px)、lineHeight (1.3–2.8 倍)、paragraphGap (0–40 px)、padding (12–48 px)、indent (true/false)、tableStyle (theme/three-line/striped/grid)。

elements 可选：h1、h2、h3、quote、caption、table、list、code、formula、poem、divider。
每个元素可选属性：
- font：上面的字体标识；size：10–48 px；weight：100–900；italic：布尔值；lineHeight：1–3.5；letterSpacing：-1–8 px。
- color、background、borderColor：#RRGGBB。
- align：left/center/right/justify。
- marginTop、marginBottom：0–80 px；padding、radius：0–40 px。
- borderWidth：0–8 px；borderStyle：solid/dashed/dotted/double；borderSide：all/top/bottom/left/right。设置边框时会先清除继承的边框；borderWidth:0 可去除边框。
- shadow：none/soft/offset。

ornaments 可选：label（刊头小字）、mark（章节符号，最多 8 字）、numbered（章节自动编号 true/false）、quoteLabel（引用小字）、codeLabel（代码小字）。文字最多 60 字，可设空字符串移除对应装饰。要移除章节徽章，请同时设置 mark:"" 与 numbered:false。

样式顺序：内置基础版式 → 主题字体组合 → elements → 文章排版面板的显式覆盖。恢复主题默认设置会清除文章覆盖。
文章的「标题与元素细调」属于当前文章覆盖，优先级高于主题和全局设置，随文章 ZIP 保存；不会写入或修改导入的主题定义。主题文件内请使用 theme.elements，勿写进 theme.typography。

仅支持上述结构和属性；不接受任意 CSS、HTML、脚本、网络字体或外部资源地址。不支持的字段会定位报错，不静默忽略。

主题标识冲突：默认保留两份并分配新标识；也可以明确选择更新已有主题（使用它的文章会随之采用新设计）。
移除主题仅从常用选择器隐藏，完整主题库和旧文章仍保留主题，可随时恢复。
单主题可导出 JSON；完整主题库可导出 zhijian-theme-library 文件，包含全部自定义定义和移除状态（不包含正文）。内置主题由程序提供，不重复打包。
单篇文章 ZIP 含当前及历史版本用到的自定义主题；整个文章库 ZIP 另含完整主题库及移除状态。纯 .md 不包含主题配置。
主题 JSON 文件上限 2 MB，自定义主题最多 100 个。
`;

export function themeGuide(){return guide+'\n## 内置基础主题标识\n\n'+themes.filter(t=>!t.definition).map(t=>`- ${t.id}：${t.name}`).join('\n')+'\n';}
function preview(theme:Theme){
  const key=theme.baseId||theme.id,node=document.createElement('article');node.className='theme-import-article';node.innerHTML=renderMarkdown(editionSamples[key]|| (isFolio(theme)?folioSample:theme.variant==='journal'?journalPreviewSample:sample),new Map((editionSamples[key]?editionAssets():isFolio(theme)?folioAssets():[]).map(a=>[a.id,a]))).html;decorateTheme(node,theme);
  return `<style>${themeCSS(theme).replaceAll('.article','.theme-import-article')}</style>${node.outerHTML}`;
}
const guarded=(host:Host,fn:()=>void)=>()=>{try{fn();}catch(e){host.notify(e instanceof Error?e.message:String(e),true);}};
function exportJSON(data:unknown,name:string){download(JSON.stringify(data,null,2),safeName(name)+'.json','application/json;charset=utf-8');}

export function showThemeManager(host:Host,filter='全部',view={query:'',scroll:0}){
  const removed=themes.filter(t=>isThemeHidden(t.id)).length;
  host.open('自己的主题书架',`<div class="theme-management-intro"><div><p class="modal-subtitle">挑选常用的主题，收藏适合你的字体与版式。</p><p id="manager-removed-summary" class="help">移除后仍保留在完整主题库，旧文章继续使用原样式。${removed?`已有 ${removed} 个主题移出选择器。`:''}</p></div><button id="manager-import" class="button primary">导入主题</button></div><div class="theme-manager-tools"><input id="manager-search" class="field" placeholder="搜索名称或主题标识" aria-label="搜索完整主题库"><div class="theme-tabs">${['全部','内置','自定义','已移除'].map(v=>`<button data-library-filter="${v}" class="${v===filter?'active':''}">${v}</button>`).join('')}</div></div><p id="manager-error" class="notice" ${themeLibraryError()?'':'hidden'}>${esc(themeLibraryError())}</p><div id="manager-list" class="theme-manager-list"></div><div class="theme-manager-footer"><span id="manager-count" class="help"></span><div><button id="manager-guide" class="button outline">格式规范 / 示例</button><button id="manager-export" class="button outline">导出主题库</button><button id="manager-restore-all" class="button outline">全部恢复</button></div></div>`,'THE PERSONAL COLLECTION');
  if(themeLibraryError()){
    $('manager-error').insertAdjacentHTML('beforeend','<p>先导出原始记录，再恢复内置库。文章文字不会丢失；自定义样式需重新导入有效的主题备份。</p><div class="theme-guide-actions"><button id="theme-export-broken" class="button outline">导出原始记录</button><button id="theme-reset-broken" class="button outline" disabled>恢复内置主题库</button></div>');
    $('theme-export-broken').onclick=guarded(host,()=>{download(rawThemeLibrary(),'纸间-主题库原始记录.json','application/json');$<HTMLButtonElement>('theme-reset-broken').disabled=false;});
    $('theme-reset-broken').onclick=guarded(host,()=>{resetBrokenThemeLibrary();host.changed();showThemeManager(host);host.notify('已恢复内置主题库。可重新导入有效的自定义主题。');});
  }
  $<HTMLInputElement>('manager-search').value=view.query;
  const render=()=>{
    const query=$<HTMLInputElement>('manager-search').value.trim().toLowerCase();const list=themes.filter(t=>(filter==='全部'||filter==='内置'&&!t.definition||filter==='自定义'&&t.definition||filter==='已移除'&&isThemeHidden(t.id))&&themeMatches(t,query));
    const summary=$('manager-removed-summary');if(summary)summary.textContent=themes.filter(t=>isThemeHidden(t.id)).length+' 个主题已移出选择器，可随时恢复。';
    $('manager-count').textContent=`${list.length} 个主题 · 内置 ${builtInIds.length} / 自定义 ${themes.length-builtInIds.length}`;
    $('manager-list').innerHTML=list.map(t=>`<div class="theme-manager-row ${isThemeHidden(t.id)?'is-hidden':''}"><span class="theme-manager-swatch" style="background:${t.paper};border-color:${t.accent};color:${t.accent}" aria-hidden="true">${t.group==='文学'?'文':'Aa'}</span><div class="theme-manager-meta"><strong>${esc(t.name)} <small>${t.definition?'自定义':'内置'}${host.current()===t.id?' · 使用中':''}</small></strong><p>${esc(t.description)}</p><code>${t.id}</code></div><div class="theme-manager-actions"><button data-manager-preview="${t.id}">预览</button>${t.definition?`<button data-manager-export="${t.id}">导出</button>`:''}<button data-manager-toggle="${t.id}" class="${isThemeHidden(t.id)?'restore-action':''}">${isThemeHidden(t.id)?'恢复':'移除'}</button></div></div>`).join('')||'<p class="empty-state">没有匹配的主题。可以导入自己的主题，或切换分类。</p>';
  };render();$('manager-list').scrollTop=view.scroll;$('manager-search').oninput=()=>{view.query=$<HTMLInputElement>('manager-search').value;render();};$('manager-list').onscroll=event=>{view.scroll=(event.currentTarget as HTMLElement).scrollTop;};
  document.querySelectorAll<HTMLElement>('[data-library-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.libraryFilter!;document.querySelectorAll<HTMLElement>('[data-library-filter]').forEach(el=>el.classList.toggle('active',el===b));render();});
  $('manager-list').onclick=e=>{
    const target=(e.target as HTMLElement).closest<HTMLElement>('button');if(!target)return;
    if(target.dataset.managerToggle)guarded(host,()=>{const id=target.dataset.managerToggle!;setThemeHidden(id,!isThemeHidden(id));host.changed();render();($('manager-list').querySelector<HTMLElement>('[data-manager-toggle="'+id+'"]')||$('manager-search')).focus();host.notify(isThemeHidden(id)?'已从选择器移除，可在此恢复。':'主题已恢复到选择器。');})();
    if(target.dataset.managerExport)exportJSON(themeDocument(themeById(target.dataset.managerExport).definition!),themeById(target.dataset.managerExport).name+'.纸间主题');
    if(target.dataset.managerPreview)showManagedPreview(host,themeById(target.dataset.managerPreview),filter,view);
  };
  $('manager-import').onclick=()=>chooseThemeFile(host);$('manager-guide').onclick=()=>showThemeGuide(host);
  $('manager-export').onclick=()=>{exportJSON(themeLibraryDocument(),'纸间-完整主题库');host.notify('主题库已导出，不包含文章正文。');};
  $('manager-restore-all').onclick=guarded(host,()=>{restoreThemes();host.changed();render();host.notify('完整主题库已恢复到选择器。');});
}
function showManagedPreview(host:Host,t:Theme,filter:string,view:{query:string;scroll:number}){
  host.open(t.name,`<div class="theme-import-layout"><aside><p class="modal-subtitle">${esc(t.description)}</p><dl class="theme-font-summary"><dt>正文</dt><dd>${esc(fontNames[t.font])}</dd>${(['h1','h2','h3'] as const).map(k=>'<dt>'+k.toUpperCase()+'</dt><dd>'+esc(fontNames[t.definition?.elements?.[k]?.font||t.headingFont||t.font])+'</dd>').join('')}<dt>引用</dt><dd>${esc(fontNames[t.definition?.elements?.quote?.font||t.quoteFont||t.font])}</dd></dl><p class="help">${themeDefaults(t).size}px · 行高 ${themeDefaults(t).lineHeight} · ${esc(themeById(t.baseId||t.id).name)}基础版式</p><button id="manager-apply-preview" class="button primary full">${isThemeHidden(t.id)?'恢复并使用':'使用此主题'}</button><button id="manager-preview-back" class="button outline full">返回完整主题库</button></aside><div class="theme-import-preview">${preview(t)}</div></div>`,'TYPE / COMPOSITION');
  $('manager-preview-back').onclick=()=>showThemeManager(host,filter,view);
  $('manager-apply-preview').onclick=guarded(host,()=>{if(isThemeHidden(t.id)){setThemeHidden(t.id,false);host.changed();}host.apply(t.id);});
}
export function showThemeGuide(host:Host){
  host.open('从一份主题文件开始',`<p class="modal-subtitle">用示例修改出自己的字体组合与版式。纯文本 JSON，可离线导入，确认前可以完整预览。</p><div class="theme-guide-actions"><button id="theme-download-example" class="button primary">下载示例主题</button><button id="theme-download-guide" class="button outline">下载完整规范</button><button id="theme-guide-back" class="button outline">返回主题库</button></div><pre class="theme-format-guide">${esc(guide)}</pre>`,'THEME FORMAT / v1');
  $('theme-download-example').onclick=()=>exportJSON(themeDocument(exampleTheme),'杉影札记.纸间主题');$('theme-download-guide').onclick=()=>download(themeGuide(),'纸间-主题格式规范-v1.md','text/markdown;charset=utf-8');$('theme-guide-back').onclick=()=>showThemeManager(host);
}
export function chooseThemeFile(host:Host){
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;document.body.append(input);
  const cleanup=()=>input.remove();input.oncancel=cleanup;
  input.onchange=async()=>{const file=input.files?.[0];try{if(!file)return;if(file.size>themeFileLimit)throw new Error('主题文件超过 2 MB，请拆分导入');const parsed=parseThemeFile(await file.text(),builtInIds);if(!parsed.themes.length&&!parsed.hidden.length)throw new Error('主题库文件为空，无需导入');showThemeImport(host,parsed,file.name);}catch(e){host.notify(e instanceof Error?e.message:String(e),true);}finally{cleanup();}};input.click();
}
function showThemeImport(host:Host,parsed:{themes:ThemeDefinition[];hidden:string[]},filename:string){
  const conflicts=parsed.themes.filter(t=>themes.some(v=>v.id===t.id));
  host.open('先看一眼，再加入书架',`<p class="modal-subtitle">${esc(filename)} · ${parsed.themes.length} 个自定义主题。预览不会改动当前文章。</p><div class="theme-import-layout"><aside>${parsed.themes.length?`<label for="import-theme-choice">预览主题</label><select id="import-theme-choice">${parsed.themes.map((t,i)=>`<option value="${i}">${esc(t.name)}</option>`).join('')}</select>`:''}${conflicts.length?`<div class="notice">${conflicts.length} 个主题标识已存在。默认保留两份；更新会改变使用原主题的文章。</div><label for="theme-conflict-mode">同标识主题</label><select id="theme-conflict-mode"><option value="keep">保留两份（相同内容自动合并）</option><option value="update">更新已有主题</option></select>`:''}${parsed.hidden.length?`<label class="switch-row">同时导入 ${parsed.hidden.length} 条移除记录<input id="theme-import-hidden" type="checkbox"></label>`:''}<p id="theme-import-description" class="help"></p><p class="help">字体使用设备可用字体自动回退。导入后可在主题库中移除、恢复或导出。</p><p id="theme-import-error" class="notice" role="status" hidden></p><button id="theme-import-confirm" class="button primary full">确认导入</button><button id="theme-import-cancel" class="button outline full">取消</button></aside><div id="theme-import-preview" class="theme-import-preview"></div></div>`,'IMPORT / PREVIEW');
  const paint=()=>{const d=parsed.themes[Number($<HTMLSelectElement>('import-theme-choice')?.value||0)];$('theme-import-preview').innerHTML=d?preview(materializeTheme(d)):'<p class="empty-state">此文件仅包含内置主题的移除记录。</p>';$('theme-import-description').textContent=d?.description||'';};paint();if($('import-theme-choice'))$('import-theme-choice').onchange=paint;
  $('theme-import-cancel').onclick=()=>showThemeManager(host);
  $('theme-import-confirm').onclick=()=>{try{const plan=planThemeImports([parsed.themes],$<HTMLSelectElement>('theme-conflict-mode')?.value==='update'?'update':'keep',$<HTMLInputElement>('theme-import-hidden')?.checked?parsed.hidden:[]);plan.commit();host.changed();showThemeManager(host,'自定义');host.notify(`已导入 ${parsed.themes.length} 个主题，可预览后使用。`);}catch(e){$('theme-import-error').hidden=false;$('theme-import-error').textContent=e instanceof Error?e.message:String(e);}};
}
