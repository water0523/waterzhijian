import {MarkdownEditor,ScrollSync,editorThemes} from './editor';
import {themes,themeById,themeCSS,visibleThemes,themeDefaults,planThemeImports,themeLibraryError} from './themes';
import type {ThemeDefinition} from './theme-types';
import {showThemeManager,chooseThemeFile} from './theme-manager';
import {decorateTheme,themeDesign} from './theme-design';
import {renderMarkdown,renderMath,exportFragment,firstArticleHeading,type RenderResult} from './render';
import {freshArticle,escapeHTML as esc,uid,fontNames,type Article,type Asset,type Typography} from './model';
import {openStore,loadStore,persist,preference,readPreference} from './storage';
import {download,safeName,createBackup,readBackup,fileToAsset,assetRefs,svgToPNG,bytesFromData,extension} from './files';
import {standardCSS,standardBody,standardFragment,createWord,preparePrintWindow} from './documents';
import {science,equations,poetry} from './samples';
import {StickerController,updateStickerLines,flattenStickers,publicationHTML} from './stickers';
import {PreviewEditor} from './preview-editor';
import {inlineFonts,inlineCSS,styleAttributes,parseInlineStyle,type InlineStyle} from './inline-style';
import {appendReferences} from './references';
import {boldSelection,mathAt} from './math-format';
import {createLongImage} from './long-image';
import {saveImageFile} from './image-delivery';
import {openPopover,closePopover,enhanceColors} from './popover';
import {blockFormat,toggleTextStyle,hasSelectedStyle,codeFormat,insertFootnote} from './formatting';
import {dividerOptions,dividerSVG} from './dividers';
import {mountElementPanel} from './element-panel';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const assets=new Map<string,Asset>();const articles=new Map<string,Article>();
const headingCache=new WeakMap<Article,{markdown:string;heading:string|null}>();
let current:Article=freshArticle('光的来信 · 科普示例',science);
let editor:MarkdownEditor,sync:ScrollSync;
let stickerController:StickerController;
let previewEditor:PreviewEditor;
let night=readPreference('appearance','day')==='night';
const savedBrightness=Number(readPreference('preview-brightness','78'));
let brightness=Number.isFinite(savedBrightness)?Math.max(35,Math.min(100,savedBrightness)):78;
let renderResult:RenderResult={html:'',errors:[],missing:[],external:[]};
let renderTimer=0,saveTimer=0,toastTimer=0,dirtyGeneration=0,savedGeneration=0,saveRunning=false,trash=false;
const dirtyArticles=new Set<string>(),dirtyAssets=new Set<string>();
let lastRenderMS=0;
let publisher=readPreference('publisher','wechat')==='zhihu'?'zhihu':'wechat';
let referencesEnabled=readPreference('references-enabled','true')!=='false';
let folders:string[]=[];try{const raw=JSON.parse(readPreference('folders','[]'));if(Array.isArray(raw))folders=raw.filter(n=>typeof n==='string'&&n.length<=40&&n!=='*'&&!/[\\/\r\n]/.test(n));}catch{}
let libraryFolder=readPreference('library-folder','*');
function saveFolders(){folders=[...new Set(folders)];preference('folders',JSON.stringify(folders));preference('library-folder',libraryFolder);}
const modal=$<HTMLDialogElement>('modal');
let copyMessage='',copyTone='',copyTimer=0;
function paintCopyButton(){const button=$<HTMLButtonElement>('copy-button');button.textContent=copyMessage||(publisher==='zhihu'?'复制到知乎 ↗':'复制到公众号 ↗');button.dataset.state=copyTone;button.disabled=copyTone==='busy';button.setAttribute('aria-busy',String(copyTone==='busy'));button.setAttribute('aria-live','polite');}
function copyFeedback(message:string,tone:string,timeout=3000){clearTimeout(copyTimer);copyMessage=message;copyTone=tone;paintCopyButton();if(timeout)copyTimer=window.setTimeout(()=>{copyMessage='';copyTone='';paintCopyButton();},timeout);}
const themeGalleryResize=new ResizeObserver(entries=>{for(const entry of entries){const el=entry.target as HTMLElement;const sample=el.querySelector<HTMLElement>('.theme-sample');if(sample){const scale=el.clientWidth/375;sample.style.transform=`scale(${scale})`;el.style.height=Math.round(390*scale)+'px';}}});

function toast(text:string,error=false){$('toast').textContent=text;$('toast').className='visible'+(error?' error':'');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('toast').className='',error?6500:3500);}
function errorMessage(e:unknown){return e instanceof Error?e.message:String(e);}
function bind(id:string,handler:(e:Event)=>unknown,type='click'){$(id).addEventListener(type,e=>{try{Promise.resolve(handler(e)).catch(err=>toast(errorMessage(err),true));}catch(err){toast(errorMessage(err),true);}});}
function openModal(title:string,html:string,eyebrow='PAPER STUDIO'){closePopover();$('modal-title').textContent=title;$('modal-eyebrow').textContent=eyebrow;$('modal-body').innerHTML=html;enhanceColors($('modal-body'));if(!modal.open)modal.showModal();}
function closeModal(){themeGalleryResize.disconnect();modal.close();$('modal-body').replaceChildren();}
function markDirty(article=current){
  syncArticleTitle(article);
  article.updated=Date.now();article.assets=[...new Set([...assetRefs(article.markdown),...(article.stickers||[]).map(s=>s.assetId)])];dirtyArticles.add(article.id);dirtyGeneration++;
  // A small synchronous text checkpoint covers the gap before IndexedDB's
  // debounced save. Original image data continues to live in IndexedDB.
  if(article.id===current.id&&!article.deleted)preference('recovery',JSON.stringify({...article,revisions:[]}));
  $('save-state').className='';$('save-state').textContent='正在保存到浏览器…';
  clearTimeout(saveTimer);saveTimer=window.setTimeout(()=>void save(),1000);
}
function syncArticleTitle(article:Article){
  if(article.titleMode!=='manual'){
    let cached=headingCache.get(article);if(!cached||cached.markdown!==article.markdown){cached={markdown:article.markdown,heading:firstArticleHeading(article.markdown)};headingCache.set(article,cached);}if(cached.heading)article.title=cached.heading;
  }
  if(article.id===current.id){
    const input=$<HTMLInputElement>('document-title');if(document.activeElement!==input)input.value=article.title;
    const toggle=document.getElementById('title-mode');if(toggle){const auto=article.titleMode!=='manual';toggle.textContent=auto?'跟随 H1':'自定义';toggle.setAttribute('aria-pressed',String(auto));toggle.title=auto?'文章名跟随第一个一级标题；点击改为自定义':'当前为自定义名称；点击跟随第一个一级标题';}
  }
  const name=$('article-list')?.querySelector<HTMLElement>(`[data-id="${article.id}"] strong`);if(name)name.textContent=article.title||'未命名文章';
}
function snapshot(a:Article,force=false){
  const last=a.revisions.at(-1);
  if(last&&last.markdown===a.markdown&&last.title===a.title&&last.titleMode===a.titleMode&&last.theme===a.theme&&JSON.stringify(last.typography)===JSON.stringify(a.typography)&&JSON.stringify(last.stickers||[])===JSON.stringify(a.stickers||[]))return;
  if(!force&&last&&Date.now()-last.at<30000)return;
  a.revisions.push({at:Date.now(),title:a.title,titleMode:a.titleMode,markdown:a.markdown,theme:a.theme,typography:structuredClone(a.typography),assets:assetRefs(a.markdown),stickers:structuredClone(a.stickers||[])});
  a.revisions=a.revisions.slice(-20);
}
async function save(){
  if(saveRunning)return;
  saveRunning=true;
  const generation=dirtyGeneration,ids=[...dirtyArticles],imageIds=[...dirtyAssets];
  const articleCopies=ids.map(id=>{const a=articles.get(id)!;snapshot(a);return structuredClone(a);});
  const imageCopies=imageIds.map(id=>structuredClone(assets.get(id)!));
  try{
    await persist(articleCopies,imageCopies);
    savedGeneration=generation;
    if(generation===dirtyGeneration){dirtyArticles.clear();dirtyAssets.clear();$('save-state').className='';$('save-state').innerHTML='<i></i> 已保存到浏览器';}
    renderLibrary();
  }catch(e){$('save-state').className='save-error';$('save-state').textContent='保存失败 · 请立即导出备份';toast('浏览器保存失败，当前内容仍在。请导出文件备份。'+errorMessage(e),true);}
  finally{saveRunning=false;if(dirtyGeneration!==generation){clearTimeout(saveTimer);saveTimer=window.setTimeout(()=>void save(),500);}}
}
function queueRender(){clearTimeout(renderTimer);if(previewEditor?.updating){updateStats();return;}renderTimer=window.setTimeout(()=>{if(editor.view.composing){queueRender();return;}render();},200);}
function updateStats(){
  const walker=document.createTreeWalker($('preview'),NodeFilter.SHOW_TEXT,{acceptNode:node=>node.parentElement?.closest('[aria-hidden="true"],svg,.math-inline,.math-display,.footnote-backref,.article-references')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  const chunks:string[]=[];while(walker.nextNode())chunks.push(walker.currentNode.textContent||'');
  const count=(chunks.join(' ').match(/[\u3400-\u9fff]|[A-Za-z0-9]+/g)||[]).length;
  const paragraphs=[...$('preview').querySelectorAll('p,.poem,li')].filter(el=>!el.closest('.article-references')&&(el.tagName!=='LI'||!el.querySelector('p'))).length;
  $('word-count').textContent=`${count.toLocaleString()} 字 · ${paragraphs} 段 · ${current.markdown.split('\n').length} 行`;
  $('reading-time').textContent=`约 ${Math.max(1,Math.ceil(count/450))} 分钟阅读`;
}
function applyAppearance(){
  document.body.dataset.appearance=night?'night':'day';document.documentElement.style.background=night?'#18221f':'';
  document.body.style.setProperty('--preview-brightness',String(brightness/100));
  $('night-button').textContent=night?'☀ 日间':'☾ 夜间';$('night-button').setAttribute('aria-pressed',String(night));
  $('preview-dimming').hidden=!night;$<HTMLInputElement>('preview-brightness').value=String(brightness);$('brightness-value').textContent=brightness+'%';
}
function editorChrome(id:string){const t=editorThemes[id]||editorThemes.dark;const pane=document.querySelector<HTMLElement>('.editor-pane')!;for(const [name,value] of Object.entries({bg:t.bg,fg:t.fg,surface:t.line,muted:t.muted,accent:t.accent,border:t.muted+'40'}))pane.style.setProperty('--editor-'+name,value);}
function render(){
  syncArticleTitle(current);
  clearTimeout(renderTimer);const start=performance.now();const reading=sync?.capture()||0;
  try{
    renderResult=renderMarkdown(current.markdown,assets,previewEditor?.enabled);
    const theme=themeById(current.theme);$('article-style').textContent=publisher==='zhihu'?standardCSS():themeCSS(theme,current.typography);
    const indentButton=document.getElementById('indent-toggle') as HTMLButtonElement|null;
    if(indentButton){const active=current.typography.indent??themeDefaults(theme).indent;indentButton.classList.toggle('active',active);indentButton.setAttribute('aria-pressed',String(active));indentButton.disabled=publisher==='zhihu';}
    $('preview').innerHTML=(publisher==='zhihu'?standardBody(current,assets,renderResult.html):renderResult.html)||'<p style="color:#a1aa9c;text-align:center;padding-top:70px;text-indent:0">从左侧写下第一句话。</p>';
    if(publisher==='wechat')decorateTheme($('preview'),theme);
    if(publisher==='wechat'&&referencesEnabled)appendReferences($('preview'));
    stickerController?.setEnabled(publisher==='wechat'&&!previewEditor?.enabled);if(publisher==='wechat')stickerController?.render();
    previewEditor?.attach();
    $('theme-name').textContent=theme.name;$('theme-dot').style.background=theme.accent;$('preview-caption-name').textContent=publisher==='zhihu'?'知乎 · 标准 Markdown':theme.name;
    $<HTMLSelectElement>('publisher').value=publisher;$('preview-target').textContent=publisher==='zhihu'?'知乎预览':'公众号预览';paintCopyButton();
    $<HTMLButtonElement>('theme-button').disabled=publisher==='zhihu';$<HTMLButtonElement>('style-button').disabled=publisher==='zhihu';if(publisher==='zhihu')$('style-panel').hidden=true;
    updateStats();
    const problems=renderResult.errors.length+renderResult.missing.length;
    $('render-state').textContent=problems?`${problems} 处待检查`:'实时预览';$('render-state').className=problems?'render-error':'';
    $('asset-count').textContent=String($('preview').querySelectorAll('img,.math-inline,.math-display').length);
    for(const el of $('preview').querySelectorAll<HTMLElement>('.math-error'))el.onclick=()=>{editor.goto(Number(el.dataset.line)+1);toast(el.title,true);};
    requestAnimationFrame(()=>{sync?.rebuild();sync?.restore(reading);});
    for(const img of $('preview').querySelectorAll('img')){img.onload=()=>{const line=sync?.capture()||0;stickerController?.reposition();sync?.rebuild();sync?.restore(line);};img.onerror=()=>{img.alt='图片无法显示 · 请在素材面板添加本地副本';$('render-state').textContent='图片加载失败';$('render-state').className='render-error';};}
    lastRenderMS=performance.now()-start;$('render-state').dataset.duration=lastRenderMS.toFixed(1);
  }catch(e){$('render-state').textContent='渲染失败，正文已保留';toast(errorMessage(e),true);}
}
function switchArticle(id:string){
  closePopover();
  const next=articles.get(id);if(!next||next.deleted)return;
  if(current.id!==id){snapshot(current,true);dirtyArticles.add(current.id);}
  current=next;preference('current',id);$('document-title').setAttribute('value',current.title);$<HTMLInputElement>('document-title').value=current.title;
  editor.setText(current.markdown,true);$('preview-scroll').scrollTop=0;render();renderLibrary();if(!$('style-panel').hidden)renderStylePanel();
  requestAnimationFrame(()=>$('preview-scroll').scrollTop=0);
}
function addArticle(title='未命名文章',markdown='',theme='rational'){
  const article=freshArticle(title,markdown);article.theme=theme;article.folder=libraryFolder==='*'?undefined:libraryFolder||undefined;trash=false;articles.set(article.id,article);markDirty(article);switchArticle(article.id);return article;
}
function renderLibrary(){
  for(const a of articles.values())if(a.folder&&!folders.includes(a.folder))folders.push(a.folder);
  if(libraryFolder!=='*'&&libraryFolder&&!folders.includes(libraryFolder))libraryFolder='*';
  const query=$<HTMLInputElement>('library-search').value.toLowerCase();
  const list=[...articles.values()].filter(a=>a.deleted===trash&&(trash||libraryFolder==='*'||(a.folder||'')===libraryFolder)&&(!query||(a.title+'\n'+a.markdown).toLowerCase().includes(query))).sort((a,b)=>b.updated-a.updated);
  $('article-list').innerHTML=list.map(a=>`<div class="article-item ${a.id===current.id?'current':''}" data-id="${a.id}" tabindex="0" role="button"><strong>${esc(a.title||'未命名文章')}</strong><small>${new Date(a.updated).toLocaleDateString('zh-CN')} · ${themeById(a.theme).name}</small><div class="item-actions">${trash?'<button data-action="restore">恢复文章</button>':'<button data-action="duplicate">副本</button><button data-action="history">历史</button><button data-action="delete">删除</button>'}</div></div>`).join('')||'<div class="empty-state">这里还没有文章</div>';
  $('active-tab').classList.toggle('active',!trash);$('trash-tab').classList.toggle('active',trash);
  $('folder-list').hidden=trash;
  $('folder-list').innerHTML=[['*','全部文章'],['','未分类'],...folders.map(n=>[n,n])].map(([id,name])=>`<div class="folder-row"><button data-folder="${esc(id)}" class="${id===libraryFolder?'active':''}"><span>${id==='*'?'▤':'▱'} ${esc(name)}</span><small>${[...articles.values()].filter(a=>!a.deleted&&(id==='*'||(a.folder||'')===id)).length}</small></button>${id&&id!=='*'?`<button data-folder-edit="${esc(id)}" aria-label="管理${esc(name)}" title="重命名 / 删除文件夹">···</button>`:''}</div>`).join('');
  if(!trash)for(const item of $('article-list').querySelectorAll<HTMLElement>('[data-id]')){const a=articles.get(item.dataset.id!)!;item.querySelector('.item-actions')!.insertAdjacentHTML('afterbegin','<button data-action="move">移动</button>');if(a.folder)item.querySelector('small')!.append(' · '+a.folder);}
}
function folderEditor(target:HTMLElement,name?:string){
  openPopover(target,name?'管理文件夹':'新建文件夹',`<p class="help">只支持一级文件夹。删除文件夹会把文章移回未分类。</p><input id="folder-name" class="field" maxlength="40" aria-label="文件夹名称" placeholder="例如：科普、文学" value="${esc(name||'')}"><div class="quick-actions">${name?'<button id="folder-delete" class="button outline">删除文件夹</button>':''}<button id="folder-save" class="button primary">${name?'保存名称':'创建'}</button></div>`);
  bind('folder-save',()=>{const next=$<HTMLInputElement>('folder-name').value.trim();if(!next||next.length>40||next==='*'||/[\\/\r\n]/.test(next)){toast('请输入 1–40 字的名称，不使用斜杠或单独的 *。',true);return;}if(folders.includes(next)&&next!==name){toast('已有同名文件夹，请换一个名称。',true);return;}
    if(name){folders=folders.map(f=>f===name?next:f);for(const a of articles.values())if(a.folder===name){a.folder=next;markDirty(a);}}else folders.push(next);libraryFolder=next;saveFolders();closePopover();renderLibrary();toast(name?'文件夹已重命名':'文件夹已创建');});
  if(name)bind('folder-delete',()=>{folders=folders.filter(f=>f!==name);for(const a of articles.values())if(a.folder===name){a.folder=undefined;markDirty(a);}if(libraryFolder===name)libraryFolder='';saveFolders();closePopover();renderLibrary();toast('文件夹已删除，文章已移回未分类');});
  $('folder-name').focus();
}
function moveArticle(target:HTMLElement,article:Article){
  const panel=openPopover(target,'移动文章',`<p class="help">${esc(article.title)}</p><div class="quick-choices">${['',...folders].map(n=>`<button data-move-folder="${esc(n)}" class="${(article.folder||'')===n?'active':''}">▱ ${esc(n||'未分类')}</button>`).join('')}</div>`);
  panel.querySelectorAll<HTMLElement>('[data-move-folder]').forEach(el=>el.onclick=()=>{article.folder=el.dataset.moveFolder||undefined;markDirty(article);closePopover();renderLibrary();toast('已移动到「'+(article.folder||'未分类')+'」');});
}
function toggleLibrary(){const panel=$('library');panel.hidden=!panel.hidden;requestAnimationFrame(()=>{editor.view.requestMeasure();sync.rebuild();});}
let pinnedThemes:string[]=[];try{const raw=JSON.parse(readPreference('pinned-themes','[]'));if(Array.isArray(raw))pinnedThemes=[...new Set(raw.filter((id:unknown)=>typeof id==='string'&&themes.some(t=>t.id===id)))].slice(0,5);}catch{}
const themePreviews=new Map<string,string>();
function themeThumbnail(id:string){
  if(themePreviews.has(id))return themePreviews.get(id)!;
  const t=themeById(id),node=document.createElement('div');node.className='theme-sample theme-sample-'+id;
  node.innerHTML=`<h2>${t.group==='文学'?'在平凡里，收集微光':'从一个好问题开始'}</h2><h3>${t.group==='文学'?'把日子，写成一页诗':'观察 · 探索 · 发现'}</h3><blockquote><p>${t.group==='文学'?'让文字留下温柔的回声。':'真正的发现，始于认真观察。'}</p></blockquote><p>让<strong>值得记住的句子</strong>拥有自己的光。</p>`;
  if(id==='classical')node.innerHTML='<h1>陋室铭</h1><h2>原文选读</h2><p>山不在高，有仙则名。水不在深，有龙则灵。<strong>斯是陋室，惟吾德馨。</strong>苔痕上阶绿，草色入帘青。</p><blockquote><p>铭，古代刻在器物上用来警戒自己或者称述功德的文字。</p></blockquote><h2>读一读，想一想</h2><p>谈笑有鸿儒，往来无白丁。</p>';
  decorateTheme(node,t);
  const html=`<style>${themeCSS(t).replaceAll('.article','.theme-sample-'+id)}</style><div class="theme-live-window">${node.outerHTML}</div>`;
  themePreviews.set(id,html);return html;
}
function applyArticleTheme(id:string){snapshot(current,true);current.theme=id;current.typography={};markDirty();render();if(!$('style-panel').hidden)renderStylePanel();closeModal();toast('已切换为「'+themeById(id).name+'」');}
function themeHost(){return {open:openModal,close:closeModal,notify:toast,current:()=>current.theme,apply:applyArticleTheme,changed:()=>{themePreviews.clear();render();if(!$('style-panel').hidden)renderStylePanel();}};}
function showThemes(filter='全部'){
  openModal('为文字，挑一件合适的衣裳',`<div class="theme-gallery-intro"><p class="modal-subtitle">点缩略图查看完整排版，点「使用」应用。应用时恢复主题默认设置。</p><input id="theme-search" class="field" placeholder="搜索名称、颜色、装饰…" aria-label="搜索主题"></div><div class="theme-tabs">${['全部','已置顶','自定义','装饰精选','科普','文学','通用'].map(g=>`<button data-group="${g}" class="${g===filter?'active':''}">${g}${g==='全部'?' · '+visibleThemes().length:''}</button>`).join('')}</div><div class="theme-pin-summary"><span id="theme-pin-count"></span><span id="theme-result-count"></span></div><div class="theme-browser"><div id="theme-results" class="theme-grid"></div><aside id="theme-detail" hidden aria-label="完整主题预览"></aside></div><div class="theme-gallery-footer"><p class="theme-gallery-foot">☆ 置顶常用主题，最多 5 个 · 知乎模式使用无主题排版</p><div><button id="theme-import-button" class="button outline">导入主题</button><button id="theme-manage-button" class="button outline">完整主题库 / 管理</button></div></div>`,'THE THEME COLLECTION / '+themes.length);
  const applyTheme=applyArticleTheme;
  bind('theme-import-button',()=>chooseThemeFile(themeHost()));bind('theme-manage-button',()=>showThemeManager(themeHost()));
  const showDetail=(id:string)=>{
    const t=themeById(id),sample=document.createElement('article');sample.className='theme-detail-article';
    const sampleText=t.group==='文学'?'# 在平凡里，收集微光\n\n## 写在日常的页边\n\n风从窗边经过，留下一页值得珍藏的文字。\n\n### 片刻的停留\n\n> 让文字留下温柔的回声。\n\n:::poem center\n光落在纸上\n也落在**未说完的故事**里\n\n愿你记得\n每一次出发\n:::\n\n## 留住那些瞬间\n\n- 一段散步的时光\n- 一封写给自己的信': '# 一束光，读懂宇宙\n\n## 从一个好问题开始\n\n科学始于好奇，也来自一次次**认真观察**。好的排版让推理更清晰。\n\n### 观察与证据\n\n> 我们用可重复的观察，检验关于世界的猜想。\n\n## 把现象写成规律\n\n$$E=mc^2$$\n\n| 观测对象 | 特征 |\n| --- | --- |\n| 光 | 传播与能量 |\n| 物质 | 质量与运动 |\n\n- 提出可检验的问题\n- 记录证据，比较结果\n\n---\n\n继续探索，让知识成为自己的理解。';
    sample.innerHTML=renderMarkdown(sampleText,new Map()).html;decorateTheme(sample,t);
    const detail=$('theme-detail');detail.hidden=false;detail.innerHTML=`<header><div><strong>${esc(t.name)}</strong><small>${esc(t.description)}</small></div><button id="theme-detail-close" aria-label="关闭完整预览">×</button></header><div class="theme-detail-scroll"><style>${themeCSS(t).replaceAll('.article','.theme-detail-article')}</style>${sample.outerHTML}</div><footer><span>375px 手机阅读效果</span><button id="theme-detail-apply" class="button primary">使用此主题</button></footer>`;
    document.querySelector('.theme-browser')!.classList.add('has-detail');
    $('theme-results').querySelectorAll<HTMLElement>('[data-theme-preview]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themePreview===id)));
    bind('theme-detail-close',()=>{detail.hidden=true;document.querySelector('.theme-browser')!.classList.remove('has-detail');$('theme-results').querySelectorAll('[data-theme-preview]').forEach(b=>b.setAttribute('aria-pressed','false'));});
    bind('theme-detail-apply',()=>applyTheme(id));
  };
  const renderCards=()=>{
    themeGalleryResize.disconnect();
    const query=$<HTMLInputElement>('theme-search').value.trim().toLowerCase();
    const pinRank=(id:string)=>pinnedThemes.includes(id)?pinnedThemes.indexOf(id):99;
    $('theme-pin-count').textContent=`置顶 ${pinnedThemes.length} / 5 · 优先显示`;
    const visible=visibleThemes().filter(t=>(filter==='全部'||(filter==='已置顶'?pinnedThemes.includes(t.id):filter==='自定义'?!!t.definition:filter==='装饰精选'?!['plain','minimal','academic','wild'].includes(t.id):t.group===filter))&&(!query||[t.name,t.description,...themeDesign(t).tags].join(' ').toLowerCase().includes(query))).sort((a,b)=>pinRank(a.id)-pinRank(b.id));
    $('theme-result-count').textContent=`${visible.length} 个主题`;
    $('theme-results').innerHTML=visible.map(t=>`<div class="theme-card ${current.theme===t.id?'selected':''} ${pinnedThemes.includes(t.id)?'pinned':''}"><button class="theme-preview-button" data-theme-preview="${t.id}" aria-label="查看${esc(t.name)}完整预览" aria-pressed="false"><div class="theme-card-topline"><span>${t.group}</span><span>${current.theme===t.id?'使用中':'点击放大'}</span></div>${themeThumbnail(t.id)}</button><div class="theme-card-info"><strong title="${esc(t.description)}">${esc(t.name)}</strong><button class="theme-apply" data-theme="${t.id}" aria-label="使用${esc(t.name)}主题">使用</button><small>${esc(themeDesign(t).tags.join(' · '))}</small></div><button class="theme-pin ${pinnedThemes.includes(t.id)?'active':''}" data-pin="${t.id}" aria-label="${pinnedThemes.includes(t.id)?'取消置顶':'置顶'}${esc(t.name)}" aria-pressed="${pinnedThemes.includes(t.id)}" title="${pinnedThemes.includes(t.id)?'取消置顶':'置顶主题（最多5个）'}">${pinnedThemes.includes(t.id)?'★':'☆'}</button></div>`).join('')||'<div class="empty-state">没有匹配的主题，试试搜索名称或装饰特点。</div>';
    $('theme-results').querySelectorAll<HTMLElement>('.theme-live-window').forEach(el=>themeGalleryResize.observe(el));
  };
  renderCards();bind('theme-search',renderCards,'input');
  $('modal-body').querySelectorAll<HTMLElement>('[data-group]').forEach(el=>el.onclick=()=>showThemes(el.dataset.group));
  $('theme-results').addEventListener('click',event=>{
    const pin=(event.target as HTMLElement).closest<HTMLElement>('[data-pin]');if(pin){
      const id=pin.dataset.pin!;if(pinnedThemes.includes(id))pinnedThemes=pinnedThemes.filter(v=>v!==id);else if(pinnedThemes.length<5)pinnedThemes.push(id);else{toast('最多置顶 5 个主题，请先取消一个置顶。',true);return;}
      preference('pinned-themes',JSON.stringify(pinnedThemes));renderCards();return;
    }
    const preview=(event.target as HTMLElement).closest<HTMLElement>('[data-theme-preview]');if(preview){showDetail(preview.dataset.themePreview!);return;}
    const el=(event.target as HTMLElement).closest<HTMLElement>('[data-theme]');if(el)applyTheme(el.dataset.theme!);
  });
}

function renderStylePanel(){
  const t=themeById(current.theme),o={...themeDefaults(t),...current.typography};
  const options=(value:string)=>Object.entries(fontNames).map(([key,name])=>`<option value="${key}" ${key===value?'selected':''}>${name}</option>`).join('');
  $('style-panel').innerHTML=`<div class="panel-title"><div><span class="eyebrow">TYPOGRAPHY</span><h2>排版设置</h2></div><button id="style-close" class="icon-button" aria-label="关闭排版设置">×</button></div><p class="help">${esc(t.name)} · 设置随当前文章保存</p><label>正文字体</label><select id="setting-font">${options(o.font||t.font)}</select><label>标题字体</label><select id="setting-headingFont">${options(o.headingFont||t.headingFont||o.font||t.font)}</select>${[['size','正文字号',12,24,.5,o.size??16,'px'],['lineHeight','行高',1.3,2.8,.05,o.lineHeight,''],['paragraphGap','段落间距',0,40,.5,o.paragraphGap??20,'px'],['padding','正文边距',12,48,1,o.padding??24,'px']].map(([key,label,min,max,step,value,unit])=>`<label>${label}<output id="value-${key}">${value}${unit}</output></label><div class="numeric-setting"><input id="setting-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}滑块"><input id="number-${key}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}数值"></div>`).join('')}<label>强调色</label><input id="setting-accent" type="color" value="${o.accent||t.accent}"><label class="switch-row">段首自动空两格<input id="setting-indent" type="checkbox" ${(o.indent??t.id==='classical')?'checked':''}></label><button id="reset-style" class="button outline full">恢复主题默认设置</button><p class="help">字体按设备可用字体自动回退，公众号读者看到的字形可能有所不同。</p>`;
  bind('style-close',()=>{$('style-panel').hidden=true;$('style-button').focus();});
  $('reset-style').insertAdjacentHTML('afterend','<button id="manage-theme-library" class="button outline full">完整主题库 / 导入与恢复</button>');bind('manage-theme-library',()=>showThemeManager(themeHost()));
  $('reset-style').insertAdjacentHTML('beforebegin',`<label class="switch-row">外部链接转文末参考<input id="setting-references" type="checkbox" ${referencesEnabled?'checked':''}></label>`);
  bind('setting-references',()=>{referencesEnabled=$<HTMLInputElement>('setting-references').checked;preference('references-enabled',String(referencesEnabled));render();},'change');
  $('reset-style').insertAdjacentHTML('beforebegin',`<label for="setting-tableStyle">表格样式</label><select id="setting-tableStyle">${[['theme','跟随主题'],['three-line','三线表 · 学术'],['striped','斑马纹 · 数据'],['grid','网格 · 清晰']].map(([id,name])=>`<option value="${id}" ${id===(o.tableStyle||'theme')?'selected':''}>${name}</option>`).join('')}</select><p class="help">表格样式用于公众号排版及主题 HTML / PDF。知乎与常规 Word 保持标准表格。</p>`);
  bind('setting-tableStyle',()=>{current.typography.tableStyle=$<HTMLSelectElement>('setting-tableStyle').value as Typography['tableStyle'];markDirty();render();},'change');
  for(const key of ['font','headingFont','size','lineHeight','paragraphGap','padding','accent','indent'])bind('setting-'+key,()=>{
    const input=$<HTMLInputElement>('setting-'+key);const value=key==='indent'?input.checked:['size','lineHeight','paragraphGap','padding'].includes(key)?Number(input.value):input.value;
    (current.typography as any)[key]=value;const output=$('value-'+key);if(output)output.textContent=String(value)+(key==='lineHeight'?'':'px');const number=$<HTMLInputElement>('number-'+key);if(number)number.value=String(value);markDirty();render();refreshElements();
  },['font','headingFont','indent'].includes(key)?'change':'input');
  for(const key of ['size','lineHeight','paragraphGap','padding']){
    const input=$<HTMLInputElement>('number-'+key),range=$<HTMLInputElement>('setting-'+key);
    const apply=()=>{if(input.value==='')return;const n=Number(input.value);if(!Number.isFinite(n)||n<Number(input.min)||n>Number(input.max))return;range.value=input.value;range.dispatchEvent(new Event('input'));};
    input.addEventListener('input',apply);input.addEventListener('blur',()=>{input.value=String(Math.max(Number(input.min),Math.min(Number(input.max),Number(input.value)||Number(range.value))));apply();});
  }
  bind('reset-style',()=>{snapshot(current,true);current.typography={};markDirty();render();renderStylePanel();});
  const elementHost=document.createElement('section');elementHost.id='element-panel-host';$('reset-style').before(elementHost);const refreshElements=mountElementPanel(elementHost,{article:()=>current,preview:()=>$('preview'),before:()=>snapshot(current,true),change:()=>{markDirty();render();}});
  enhanceColors($('style-panel'));
}
function showBlockMenu(target:HTMLElement){
  const choices=[['h1','H1 · 一级标题'],['h2','H2 · 二级标题'],['h3','H3 · 三级标题'],['paragraph','正文'],['quote','❞ 引用'],['poem','居中诗歌']];
  const panel=openPopover(target,'转换选区格式','<p class="help">转换选中内容所在的整行，保留原文。未选中文字时作用于光标所在行。</p><div class="quick-choices">'+choices.map(([id,label])=>`<button data-block="${id}">${label}</button>`).join('')+'</div>');
  panel.querySelectorAll<HTMLElement>('[data-block]').forEach(el=>el.onclick=()=>{closePopover();blockFormat(editor,el.dataset.block as Parameters<typeof blockFormat>[1]);});
}
function showTableMenu(target:HTMLElement){
  const choices=[['theme','主题默认'],['three-line','三线表'],['striped','斑马纹'],['grid','网格']];
  const panel=openPopover(target,'表格与样式',`<p class="help">样式作用于当前文章的全部表格，随文章保存。${publisher==='zhihu'?'知乎模式使用标准表格；切回公众号后可调整。':''}</p><div class="table-style-choices">${choices.map(([id,name])=>`<button data-table-style="${id}" class="${id===(current.typography.tableStyle||'theme')?'active':''}" ${publisher==='zhihu'?'disabled':''}><table class="table-demo demo-${id}" aria-hidden="true"><tr><th>项目</th><th>数值</th></tr><tr><td>甲</td><td>24</td></tr><tr><td>乙</td><td>36</td></tr></table><span>${name}</span></button>`).join('')}</div><button id="insert-table" class="button outline full">＋ 插入 Markdown 表格</button>`);
  panel.querySelectorAll<HTMLElement>('[data-table-style]').forEach(el=>el.onclick=()=>{current.typography.tableStyle=el.dataset.tableStyle as Typography['tableStyle'];markDirty();render();if(!$('style-panel').hidden)renderStylePanel();panel.querySelectorAll('[data-table-style]').forEach(b=>b.classList.toggle('active',b===el));toast('表格样式已更新');});
  bind('insert-table',()=>{closePopover();editor.insert('\n\n| 项目 | 说明 |\n| --- | --- |\n| 内容 | 内容 |\n\n');});
}
function showInlineStyle(event?:Event){
  const selection=editor.view.state.selection.main,selected=editor.view.state.sliceDoc(selection.from,selection.to);
  if(!selected){toast('先在 Markdown 栏选中需要设置样式的文字。');return;}
  if(selected.includes('\n')){toast('请选中同一行 Markdown 中的文字；跨段落样式请在排版设置中调整。');return;}
  const before=editor.view.state.doc.toString();
  const math=mathAt(before,selection.from,selection.to);
  if(math&&(selection.from!==math.start||selection.to!==math.end)){toast('公式加粗可直接使用 B 按钮；设置颜色或荧光时，请连同两侧 $ 完整选中行内公式。');return;}
  const suffix=before.slice(selection.to).match(/^\]\{([^}]+)\}/);
  const existing=before[selection.from-1]==='['&&suffix?parseInlineStyle(suffix[1]):null;
  const panel=openPopover((event?.currentTarget as HTMLElement)||$('inline-style-button'),'选中文字的样式',`<p class="modal-subtitle">只作用于当前选区，可叠加多种样式。预览区仍只允许修改文字。</p><div class="inline-style-form"><label>字体<select id="inline-font"><option value="">跟随正文</option>${Object.entries(inlineFonts).map(([id,font])=>`<option value="${id}">${font.name}</option>`).join('')}</select></label><label>字号（px）<input id="inline-size" type="number" min="10" max="64" step=".5" placeholder="跟随正文"></label><label class="inline-color-label"><span><input id="inline-use-color" type="checkbox"> 自定文字颜色</span><input id="inline-color" type="color" value="#315e53"></label><label class="inline-color-label"><span><input id="inline-use-highlight" type="checkbox"> 荧光标记</span><input id="inline-highlight" type="color" value="#fff29b"></label><div class="inline-style-toggles">${[['bold','加粗'],['italic','斜体'],['underline','下划线'],['wave','波浪线'],['strike','删除线']].map(([id,name])=>`<label><input id="inline-${id}" type="checkbox"> ${name}</label>`).join('')}</div></div><div id="inline-style-sample">${esc(selected)}</div><p class="help">使用设备已有字体；缺少字体时自动回退。西文字体遇到中文会回退到对应中文字体。没有嵌入或下载字体文件。</p><div class="inline-style-actions"><button id="inline-cancel" class="button outline">取消</button><button id="inline-apply" class="button primary">应用到选中文字</button></div>`);
  enhanceColors(panel);
  const read=():InlineStyle=>({highlight:$<HTMLInputElement>('inline-use-highlight').checked?$<HTMLInputElement>('inline-highlight').value:undefined,font:$<HTMLSelectElement>('inline-font').value||undefined,size:Number($<HTMLInputElement>('inline-size').value)||undefined,color:$<HTMLInputElement>('inline-use-color').checked?$<HTMLInputElement>('inline-color').value:undefined,...Object.fromEntries(['bold','italic','underline','wave','strike'].map(key=>[key,$<HTMLInputElement>('inline-'+key).checked]))});
  const update=()=>{$('inline-style-sample').style.cssText=inlineCSS(read());};
  if(existing){$<HTMLInputElement>('inline-use-highlight').checked=!!existing.highlight;$<HTMLInputElement>('inline-highlight').value=existing.highlight||'#fff29b';$<HTMLSelectElement>('inline-font').value=existing.font||'';$<HTMLInputElement>('inline-size').value=existing.size?String(existing.size):'';$<HTMLInputElement>('inline-use-color').checked=!!existing.color;$<HTMLInputElement>('inline-color').value=existing.color||'#315e53';for(const key of ['bold','italic','underline','wave','strike'] as const)$<HTMLInputElement>('inline-'+key).checked=!!existing[key];update();}
  panel.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',update));
  bind('inline-color',()=>{$<HTMLInputElement>('inline-use-color').checked=true;update();},'input');
  bind('inline-highlight',()=>{$<HTMLInputElement>('inline-use-highlight').checked=true;update();},'input');bind('inline-cancel',closePopover);bind('inline-apply',()=>{
    if(before!==editor.view.state.doc.toString()){toast('选区内容已经变化，请重新选择文字。',true);return;}
    const style=read();if(style.size&&(style.size<10||style.size>64||Math.round(style.size*10)!==style.size*10)){toast('选区字号范围是 10–64 px，最多一位小数。');return;}
    const attrs=styleAttributes(style);if(!attrs&&!existing){toast('请选择至少一项字体、颜色或文字样式。');return;}
    const from=existing?selection.from-1:selection.from,to=existing?selection.to+suffix![0].length:selection.to;
    const insert=attrs?`[${selected}]{${attrs}}`:selected,anchor=from+(attrs?1:0);closePopover();editor.replaceText(from,to,insert);editor.view.dispatch({selection:{anchor,head:anchor+selected.length}});editor.view.focus();
  });
}
async function addImages(files:File[],position:number){
  if(!files.length)return;
  const target=current;const baseMarkdown=target.markdown;toast('正在读取图片…');
  const imported:Asset[]=[];for(const file of files)imported.push(await fileToAsset(file));
  for(const asset of imported){assets.set(asset.id,asset);dirtyAssets.add(asset.id);}
  const group=imported.length>1?uid():'';
  const images=imported.map(a=>`![${a.name.replace(/[\[\]\\\r\n]/g,'')}](asset:${a.id})`).join(group?'\n':'\n\n');
  const text='\n\n'+(group?`:::gallery grid2 ${group}\n${images}\n:::`:images)+'\n\n';
  // If typing continued while files were decoded, insert at the current caret instead of a stale offset.
  if(current.id===target.id){editor.insert(text,target.markdown===baseMarkdown?position:editor.view.state.selection.main.head);}
  else {target.markdown+=text;markDirty(target);}
  render();toast(`已插入 ${imported.length} 张图片，随文章一起备份`);
  if(group&&current.id===target.id)showImageLayouts(group,$('image-layout-button'));
}
function showImageLayouts(group:string,anchor:HTMLElement){
  const owner=current.id;
  const groups=[...current.markdown.matchAll(/^:::gallery (stack|grid2|grid3|featured) ([\w-]+)$/gm)];
  const selected=groups.find(m=>m[2]===group)||groups.at(-1);
  if(!selected){toast('一次粘贴、拖入或选择多张图片后，可在这里切换图片组排版。');return;}
  const id=selected[2],panel=openPopover(anchor,'图片组排版',`<p class="help">保留完整原图与图注，不裁切。点击预览中的图片组，可再次调整。</p><div class="image-layout-choices">${[['stack','逐张纵排','▰'],['grid2','两列并排','▥'],['grid3','三列网格','▦'],['featured','首图通栏','▤']].map(([value,name,icon])=>`<button data-image-layout="${value}" class="${selected[1]===value?'active':''}"><span>${icon}</span>${name}</button>`).join('')}</div>`);
  panel.querySelectorAll<HTMLElement>('[data-image-layout]').forEach(button=>button.onclick=()=>{
    if(current.id!==owner){closePopover();return;}
    const match=[...current.markdown.matchAll(/^:::gallery (stack|grid2|grid3|featured) ([\w-]+)$/gm)].find(m=>m[2]===id);
    if(!match){closePopover();toast('这组图片已被移除。');return;}
    editor.view.dispatch({changes:{from:match.index!,to:match.index!+match[0].length,insert:`:::gallery ${button.dataset.imageLayout} ${id}`}});
    render();closePopover();toast('已更新图片组排版');
  });
}
function showDividers(anchor:HTMLElement){
  const owner=current.id,position=editor.view.state.selection.main.head;
  const preferred:Record<string,string>={nature:'leaf',wild:'leaf',matcha:'leaf',cosmos:'orbit',ocean:'wave',pixel:'pixel',arcade:'pixel',academic:'double',magazine:'double',gold:'diamond',cartoon:'dots',kuromi:'diamond',pop:'pixel'};
  const t=themeById(current.theme),choice=preferred[t.baseId||t.id]||'fine',accent=current.typography.accent||t.accent;
  const panel=openPopover(anchor,'主题分割线',`<p class="help">配色随文章主题变化；点击插入当前位置。</p><div class="divider-choices" style="color:${accent}">${[...dividerOptions].sort((a,b)=>Number(b[0]===choice)-Number(a[0]===choice)).map(([id,name])=>`<button data-divider-choice="${id}">${dividerSVG(id)}<span>${name}${id===choice?' · 本主题推荐':''}</span></button>`).join('')}</div>`);
  panel.querySelectorAll<HTMLElement>('[data-divider-choice]').forEach(button=>button.onclick=()=>{if(current.id!==owner){closePopover();return;}editor.insert(`\n\n:::divider ${button.dataset.dividerChoice}\n\n`,Math.min(position,current.markdown.length));closePopover();});
}
function showMagazineImage(image:HTMLElement){
  const asset=assets.get(image.dataset.asset||'');if(!asset)return;
  const owner=current.id,anchor=$('image-button');const width=asset.width===100?42:Math.max(20,Math.min(55,asset.width));
  const panel=openPopover(anchor,'杂志插图 · 正文环绕',`<div class="quick-choices"><button data-magazine-side="left" class="${asset.align!=='right'?'active':''}">居左环绕</button><button data-magazine-side="right" class="${asset.align==='right'?'active':''}">居右环绕</button></div><label class="magazine-size-label">插图宽度（占正文 %）</label><div class="numeric-setting"><input id="magazine-image-range" type="range" min="20" max="55" step="1" value="${width}" aria-label="插图宽度滑块"><input id="magazine-image-number" type="number" min="20" max="55" step="1" value="${width}" aria-label="插图宽度数值"></div><p class="help">拖动滑块或输入数值；原图完整保留。图注与来源可在素材面板编辑。</p>`);
  const update=(size:number,side:string)=>{if(current.id!==owner||(themeById(current.theme).baseId||current.theme)!=='magazine'){closePopover();return;}asset.width=Math.max(20,Math.min(55,size));asset.align=side==='right'?'right':'left';dirtyAssets.add(asset.id);markDirty();render();};
  panel.querySelectorAll<HTMLElement>('[data-magazine-side]').forEach(button=>button.onclick=()=>{update(Number($<HTMLInputElement>('magazine-image-number').value)||width,button.dataset.magazineSide!);panel.querySelectorAll('[data-magazine-side]').forEach(el=>el.classList.toggle('active',(el as HTMLElement).dataset.magazineSide===asset.align));});
  for(const id of ['magazine-image-range','magazine-image-number'])bind(id,()=>{const input=$<HTMLInputElement>(id);if(!input.value||!Number.isFinite(input.valueAsNumber))return;update(input.valueAsNumber,asset.align);for(const other of ['magazine-image-range','magazine-image-number'])if(other!==id)$<HTMLInputElement>(other).value=String(asset.width);},'input');
}
const formulas=[
  ['行内公式','E=mc^2',false],['分式与根号','x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}',true],
  ['积分','\\int_a^b f(x)\\,\\mathrm{d}x',true],['求和','\\sum_{k=1}^n k=\\frac{n(n+1)}2',true],
  ['矩阵','A=\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}',true],['多行推导','\\begin{aligned}\n(a+b)^2&=(a+b)(a+b)\\\\\n&=a^2+2ab+b^2\n\\end{aligned}',true],
  ['极限','\\lim_{x\\to 0}\\frac{\\sin x}{x}=1',true],['带编号公式','e^{i\\pi}+1=0\\tag{1}',true],
  ['等号对齐 · 自动编号','\\begin{align}\nf(x)&=x^2+2x+1\\\\\n&=(x+1)^2\n\\end{align}',true],
  ['自动编号 · 单个公式','\\begin{equation}\nE=mc^2\n\\end{equation}',true],
  ['彩色公式','\\textcolor{RoyalBlue}{E}=\\textcolor{BrickRed}{mc^2}',true]
] as const;
function showFormulas(event?:Event){const panel=openPopover((event?.currentTarget as HTMLElement)||$('math-button'),'把思考，写成公式',`<p class="modal-subtitle">点击插入后可直接修改。行内使用 $…$，独立公式使用 $$…$$。</p><div class="formula-grid">${formulas.map(([name,tex,display],i)=>`<button class="formula-card" data-formula="${i}"><strong>${name}</strong><div class="formula-example">${renderMath(tex,display).html}</div></button>`).join('')}</div>`);panel.querySelectorAll<HTMLElement>('[data-formula]').forEach(el=>el.onclick=()=>{const [,tex,display]=formulas[Number(el.dataset.formula)];closePopover();editor.insert(display?`\n\n$$\n${tex}\n$$\n\n`:`$${tex}$`);});}
function showSamples(){openModal('从一个小小的示例开始','<p class="modal-subtitle">示例将作为新文章打开，保留你正在编辑的草稿。</p><div class="option-list"><button class="option-card" data-sample="science"><strong>01 / 一束光，如何告诉我们宇宙的故事？</strong><small>科普文章 · 公式 · 表格 · 脚注</small></button><button class="option-card" data-sample="math"><strong>02 / 在符号之间，理解变化</strong><small>数学公式 · 矩阵 · 多行推导 · 编号</small></button><button class="option-card" data-sample="poetry"><strong>03 / 风经过的地方</strong><small>诗歌 · 散文 · 保留诗行与空行</small></button></div>');$('modal-body').querySelectorAll<HTMLElement>('[data-sample]').forEach(el=>el.onclick=()=>{closeModal();if(el.dataset.sample==='math')addArticle('在符号之间，理解变化',equations,'math');else if(el.dataset.sample==='poetry')addArticle('风经过的地方',poetry,'moon');else addArticle('一束光，如何告诉我们宇宙的故事？',science);});}

function exportBackup(all=false){snapshot(current,true);const selected=all?[...articles.values()]:[current];const data=createBackup(selected,assets,all?folders:[],all);download(data as BlobPart,all?'纸间-文章库备份.zip':safeName(current.title)+'.纸间.zip','application/zip');$('last-export').textContent='已导出文件 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});toast(all?'文章库备份已下载（包含回收站）':'文章备份已下载，包含图片和排版设置');}
function checkIssues():string[]{
  return [...renderResult.errors.map(e=>`第 ${e.line} 行公式：${e.message}`),...renderResult.missing.map(p=>`图片缺失：${p}`),...renderResult.external.map(()=>`存在网络图片，离线阅读需先导入本地副本`),...($('preview').querySelector('img')?['本地图片粘贴后可能需要补插，请检查图片是否保留。']:[]),...(publisher==='wechat'&&current.stickers?.length?['贴纸可尝试保留轮廓，或改为普通左右环绕；自由叠放区域需要合成为图片。']:[])];
}
async function copyArticle(){
  render();
  copyFeedback('正在检查…','busy',0);
  const issues=checkIssues();
    if(issues.length){copyFeedback('请检查图片与公式','manual',5000);openModal('复制前，再看一眼',`<div class="notice">${[...new Set(issues)].map(s=>esc(s)).join('<br>')}</div><p class="modal-subtitle">公式以 SVG 复制。${publisher==='zhihu'?'知乎':'公众号'}的实际显示以粘贴并保存后的结果为准。</p>${publisher==='wechat'&&current.stickers?.length?'<label class="publish-layout-label">贴纸发布方式 <select id="publish-sticker-mode"><option value="outline">尝试保留透明轮廓环绕</option><option value="rectangle">普通左 / 右环绕（按当前方向）</option><option value="image">局部图片（保留视觉效果）</option></select></label><p class="modal-subtitle">公众号若移除了环绕格式，可重新选择普通左右环绕；若仍未保留，可下载局部图补插。</p>':''}<div class="manual-actions"><button id="check-assets" class="button outline">查看素材 / 下载补图</button><button id="continue-copy" class="button primary">继续复制</button></div>`);bind('check-assets',showAssets);bind('continue-copy',()=>performCopy(($<HTMLSelectElement>('publish-sticker-mode')?.value||'outline') as 'outline'|'rectangle'|'image'));return;}
  await performCopy();
}
async function performCopy(mode:'outline'|'rectangle'|'image'='outline'){
  copyFeedback('正在复制…','busy',0);
  let html:string;const text=$('preview').innerText;
  try{html=publisher==='zhihu'?await standardFragment(current,assets):await publicationHTML($('preview'),mode);}catch(e){copyFeedback('复制准备失败','error');throw e;}
  try{
    if(!navigator.clipboard?.write)throw new Error('剪贴板接口不可用');
    await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]);
    closeModal();copyFeedback('✓ 已复制','success');toast(publisher==='zhihu'?'已复制标准富文本，可粘贴到知乎。请检查公式和图片。':'已复制排版内容。粘贴到公众号后请检查公式和图片。');
  }catch{
    copyFeedback('请手动复制','manual',5000);
    openModal('手动复制排版内容',`<p class="modal-subtitle">浏览器未允许直接写入剪贴板。点击「选中内容」，然后按 Ctrl+C，再到发布编辑器粘贴。</p><div class="manual-actions"><span class="small-muted">正文、公式和排版样式</span><button id="select-copy" class="button primary">选中内容</button></div><div id="manual-copy" class="manual-copy" tabindex="0">${html}</div>`);
    bind('select-copy',()=>{const range=document.createRange();range.selectNodeContents($('manual-copy'));const selection=getSelection();selection?.removeAllRanges();selection?.addRange(range);$('manual-copy').focus();});
  }
}
async function exportHTML(){
  render();
  if(renderResult.missing.length||renderResult.external.length||$('preview').querySelector('img:not([src^="data:"])')){
    openModal('请先补齐离线图片','<div class="notice">当前文章包含缺失或网络图片。为保证导出的 HTML 完全离线可读，请先在素材面板导入本地副本。</div><button id="fix-images" class="button primary">打开素材面板</button>');bind('fix-images',showAssets);return;
  }
  if(renderResult.errors.length)toast('导出包含公式错误提示，请修正后再发布。',true);
  const html=await publicationHTML($('preview'),'outline');
  const readingWidth=current.stickers?.some(s=>!s.layout||s.layout==='free')?$('preview').clientWidth:720;
  download(`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(current.title)}</title><style>body{margin:0;background:#f2f3ef}.reading-page{max-width:${readingWidth}px;margin:24px auto}@media(max-width:${readingWidth}px){.reading-page{margin:0}}</style></head><body><main class="reading-page">${html}</main></body></html>`,safeName(current.title)+'.html','text/html;charset=utf-8');closeModal();toast('独立 HTML 已导出，可离线阅读');
}
function showExport(){openModal('把文章，好好保存',`<p class="modal-subtitle">浏览器草稿方便继续写作，文件备份适合长期保存与换电脑恢复。</p><div class="option-list"><button id="export-backup" class="option-card"><strong>文章备份 ZIP <span style="font-size:10px;color:#719264">推荐</span></strong><small>正文、原图、主题、排版与历史版本，一起带走</small></button><button id="export-html" class="option-card"><strong>独立阅读 HTML</strong><small>内嵌本地图片与公式，无需工具即可离线阅读</small></button><button id="export-longimage" class="option-card"><strong>整篇长图 PNG</strong><small>保留排版、公式与贴纸；超长文章自动分段打包</small></button><button id="export-pdf" class="option-card"><strong>PDF 文档</strong><small>当前排版或标准文档，通过浏览器另存为 PDF</small></button><button id="export-word" class="option-card"><strong>Word 文档 .docx</strong><small>标准 Markdown 排版；正文可编辑，公式转为高清图片</small></button><button id="export-md" class="option-card"><strong>Markdown 源文件</strong><small>无本地图片时导出 .md；含图片时导出正文与图片 ZIP</small></button><button id="export-all" class="option-card"><strong>整个文章库 ZIP</strong><small>包含全部文章及回收站内容</small></button></div>`,'SAVE & EXPORT');bind('export-backup',()=>{exportBackup();closeModal();});bind('export-html',exportHTML);bind('export-longimage',showLongImage);bind('export-pdf',showPDF);bind('export-word',exportWord);bind('export-md',()=>{if(assetRefs(current.markdown).length||current.stickers?.length)exportBackup();else{download(current.markdown,safeName(current.title)+'.md','text/markdown;charset=utf-8');toast('Markdown 已导出');}closeModal();});bind('export-all',()=>{exportBackup(true);closeModal();});}

function documentReady(){
  render();if(renderResult.errors.length||renderResult.missing.length||renderResult.external.length){toast('请先修正公式错误，并在素材面板补齐本地图片。',true);return false;}return true;
}
function showLongImage(){
  if(window.matchMedia('(max-width:760px)').matches)$('mobile-preview').click();
  if(!documentReady())return;
  openModal('把整篇文章保存成长图','<p class="modal-subtitle">按当前预览宽度生成 PNG，保留主题、公式、图片、贴纸和参考链接。夜间亮度不会带入图片。</p><label class="publish-layout-label">清晰度<select id="longimage-scale"><option value="1">标准 · 1 倍</option><option value="2" selected>高清 · 2 倍</option><option value="3">超清 · 3 倍</option></select></label><p class="help">生成后可选择复制图片或另存为。文章超过安全画布尺寸时自动分段，可逐张复制或保存整包 ZIP。优先在段落边界分段，超大单段可能跨图。提高分辨率会增加时间和内存用量。</p><p id="longimage-progress" role="status"></p><div class="inline-style-actions"><button id="longimage-cancel" class="button outline">关闭</button><button id="longimage-start" class="button primary">生成整篇长图</button></div>','ARTICLE IMAGE');
  let controller:AbortController|undefined;
  const cancel=()=>controller?.abort();modal.addEventListener('close',cancel,{once:true});
  bind('longimage-cancel',()=>{cancel();closeModal();});
  bind('longimage-start',async()=>{
    const button=$<HTMLButtonElement>('longimage-start'),scale=Number($<HTMLSelectElement>('longimage-scale').value),title=current.title;
    controller=new AbortController();modal.addEventListener('close',cancel,{once:true});button.disabled=true;$<HTMLSelectElement>('longimage-scale').disabled=true;$('longimage-cancel').textContent='取消生成';
    try{
      const result=await createLongImage($('preview'),scale,controller.signal,text=>{const progress=document.getElementById('longimage-progress');if(progress)progress.textContent=text;});
      if(!controller.signal.aborted)showLongImageResult(result,title);
    }catch(e){if(e instanceof DOMException&&e.name==='AbortError')toast('已取消长图导出');else throw e;}
    finally{modal.removeEventListener('close',cancel);if(button.isConnected){button.disabled=false;$<HTMLSelectElement>('longimage-scale').disabled=false;$('longimage-cancel').textContent='关闭';}}
  });
}
function showLongImageResult(result:Awaited<ReturnType<typeof createLongImage>>,title:string){
  openModal('长图已生成 · 选择保存方式',`<p class="modal-subtitle">${result.parts===1?'可直接复制图片，粘贴到聊天或文档，也可另存为 PNG。':`全文共 ${result.parts} 张分段图片。选择一张预览、复制或保存，也可保存完整 ZIP。`}</p>${result.parts>1?`<label class="publish-layout-label">当前图片<select id="longimage-part">${result.images.map((p,i)=>`<option value="${i}">第 ${i+1} 张 · ${p.width} × ${p.height}</option>`).join('')}</select></label>`:''}<div class="longimage-result-preview"><img id="longimage-result-image" alt="已生成的文章长图"></div><p id="longimage-result-status" role="status" class="help"></p><div class="longimage-result-actions"><button id="longimage-copy" class="button primary">复制图片</button><button id="longimage-save" class="button outline">另存为${result.parts>1?'当前图片':''}</button>${result.parts>1?'<button id="longimage-save-all" class="button outline">全部另存为 ZIP</button>':''}<button id="longimage-result-close" class="button outline">关闭</button></div>`,'IMAGE READY');
  let index=0,url='';
  const status=$('longimage-result-status');
  const select=()=>{if(url)URL.revokeObjectURL(url);const part=result.images[index];url=URL.createObjectURL(part.blob);$<HTMLImageElement>('longimage-result-image').src=url;status.textContent=`${part.width} × ${part.height} 像素 · PNG · ${(part.blob.size/1024/1024).toFixed(2)} MB`;$('longimage-copy').textContent='复制图片';};
  select();modal.addEventListener('close',()=>{URL.revokeObjectURL(url);},{once:true});
  if(result.parts>1)bind('longimage-part',()=>{index=Number($<HTMLSelectElement>('longimage-part').value);select();},'change');
  bind('longimage-result-close',closeModal);
  bind('longimage-copy',async()=>{
    const button=$<HTMLButtonElement>('longimage-copy'),part=index;button.disabled=true;button.textContent='正在复制…';
    try{if(!navigator.clipboard?.write||!window.ClipboardItem)throw new Error('此浏览器不支持图片复制');await navigator.clipboard.write([new ClipboardItem({'image/png':result.images[part].blob})]);button.textContent=index===part?'✓ 图片已复制':'复制图片';status.textContent=`${result.parts>1?'第 '+(part+1)+' 张':''}图片已复制，可直接粘贴。`;}
    catch{button.textContent='重试复制图片';status.textContent='浏览器未允许复制图片。可以重试、右键上方图片复制，或选择「另存为」。';}
    finally{button.disabled=false;}
  });
  const save=async(all=false)=>{
    const button=$<HTMLButtonElement>(all?'longimage-save-all':'longimage-save');button.disabled=true;
    try{const part=result.images[index],name=safeName(title)+(all?'-长图分段.zip':result.parts>1?'-'+part.name:'-长图.png');const outcome=await saveImageFile(all?result.blob:part.blob,name);status.textContent=outcome==='saved'?'图片文件已保存。':outcome==='cancelled'?'已取消另存为，生成的图片仍保留在这里。':'已交给浏览器下载；保存位置由浏览器的下载设置决定。';}
    catch(e){status.textContent='保存未完成：'+errorMessage(e)+'。图片仍保留，可重试或右键保存。';}
    finally{button.disabled=false;}
  };
  bind('longimage-save',()=>save());if(result.parts>1)bind('longimage-save-all',()=>save(true));
}
async function exportWord(){
  if(!documentReady())return;const article=structuredClone(current);const button=$<HTMLButtonElement>('export-word');button.disabled=true;button.textContent='正在生成 Word…';
  try{const blob=await createWord(article,assets);download(blob,safeName(article.title)+'.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document');closeModal();toast('Word 已导出：标准排版，公式以图片保留');}finally{if(button.isConnected){button.disabled=false;button.innerHTML='<strong>Word 文档 .docx</strong><small>标准 Markdown 排版；正文可编辑，公式转为高清图片</small>';}}
}
function showPDF(){
  if(!documentReady())return;
  openModal('导出 PDF','<p class="modal-subtitle">打开打印预览后，点击「打印 / 另存为 PDF」，目标选择「另存为 PDF」。建议关闭页眉页脚。</p><div class="option-list"><button id="pdf-theme" class="option-card"><strong>当前预览排版</strong><small>保留配色与版式，贴纸局部区域合成为图片</small></button><button id="pdf-standard" class="option-card"><strong>标准 Markdown 文档</strong><small>适合 A4 阅读与打印，贴纸作为普通图片</small></button></div>');
  for(const mode of ['theme','standard'] as const)bind('pdf-'+mode,async()=>{
    const popup=window.open('','_blank');if(!popup){toast('浏览器拦截了打印窗口，请允许此文件打开弹窗。',true);return;}
    popup.document.body.textContent='正在准备打印文档…';
    try{await preparePrintWindow(popup,structuredClone(current),assets,$('preview'),publisher==='zhihu'?'standard':mode);closeModal();toast('打印文档已打开，可另存为 PDF');}catch(e){popup.close();throw e;}
  });
}

async function importFiles(files:File[]){
  const incoming:Article[]=[],images:Asset[]=[],incomingFolders:string[]=[],themeGroups:ThemeDefinition[][]=[],hiddenThemes:string[][]=[],backupGroups:{articles:Article[];index:number}[]=[];
  for(const file of files){
    if(file.size>100*1024*1024)throw new Error('导入文件请小于 100 MB');
    if(/\.zip$/i.test(file.name)){const result=readBackup(new Uint8Array(await file.arrayBuffer()));incoming.push(...result.articles);images.push(...result.assets);incomingFolders.push(...result.folders);backupGroups.push({articles:result.articles,index:themeGroups.length});themeGroups.push(result.themes);hiddenThemes.push(result.hiddenThemes);}
    else {if(!/\.(md|markdown|txt)$/i.test(file.name))throw new Error('请选择 Markdown 或文章备份 ZIP');incoming.push(freshArticle(file.name.replace(/\.[^.]+$/,''),await file.text()));}
  }
  // Validate the entire batch before modifying the live collection.
  if(themeGroups.some(g=>g.length)||hiddenThemes.some(g=>g.length)){
    const plan=planThemeImports(themeGroups,'keep',[],hiddenThemes);plan.commit();themePreviews.clear();
    for(const group of backupGroups){const mapping=plan.maps[group.index];for(const a of group.articles){a.theme=mapping.get(a.theme)||a.theme;for(const r of a.revisions)r.theme=mapping.get(r.theme)||r.theme;}}
  }
  folders.push(...incomingFolders);libraryFolder="*";saveFolders();
  for(const a of incoming){articles.set(a.id,a);dirtyArticles.add(a.id);}
  for(const a of images){assets.set(a.id,a);dirtyAssets.add(a.id);}
  const first=incoming.find(a=>!a.deleted);if(first)switchArticle(first.id);else renderLibrary();
  dirtyGeneration++;await save();if(dirtyGeneration!==savedGeneration)toast(`已加入 ${incoming.length} 篇文章，但尚未全部保存到浏览器。请保留页面并导出文章库备份。`,true);else toast(`已导入 ${incoming.length} 篇文章，同名文章保留为独立副本`);
}
function showHistory(article:Article){
  const revisions=[...article.revisions].reverse();
  openModal('找回之前的文字',`<p class="modal-subtitle">${esc(article.title)} · 保留最近 20 个恢复点。连续输入按约 30 秒合并，切换文章和导出时另存恢复点。</p>${revisions.length?revisions.map((r,i)=>`<div class="history-row"><div>${new Date(r.at).toLocaleString('zh-CN')}<small>${r.markdown.length} 字符 · ${themeById(r.theme).name}</small></div><button data-revision="${i}">恢复这个版本</button></div>`).join(''):'<div class="empty-state">继续写作后，这里将出现恢复版本。</div>'}`);
  $('modal-body').querySelectorAll<HTMLElement>('[data-revision]').forEach(el=>el.onclick=()=>{const revision=structuredClone(revisions[Number(el.dataset.revision)]);snapshot(article,true);Object.assign(article,{title:revision.title,titleMode:revision.titleMode||'manual',markdown:revision.markdown,theme:revision.theme,typography:revision.typography,assets:revision.assets,stickers:revision.stickers||[]});markDirty(article);switchArticle(article.id);closeModal();toast('已恢复版本，恢复前的内容也已保留');});
}
function showTOC(){const headings=[...$('preview').querySelectorAll<HTMLElement>('h1,h2,h3,h4')];openModal('文章目录',`<ul class="toc-list">${headings.map((h,i)=>`<li><button data-heading="${i}" style="padding-left:${10+(Number(h.tagName.slice(1))-1)*15}px">${esc(h.textContent||'')}</button></li>`).join('')}</ul>${headings.length?'':'<p class="empty-state">添加 Markdown 标题后，目录会自动生成。</p>'}`);$('modal-body').querySelectorAll<HTMLElement>('[data-heading]').forEach(el=>el.onclick=()=>{const h=headings[Number(el.dataset.heading)];closeModal();editor.goto(Number(h.dataset.line||0)+1);h.scrollIntoView({block:'start'});});}

function showAssets(){
  render();const nodes=[...$('preview').querySelectorAll<HTMLElement>('.image-wrap,.math-inline,.math-display,.sticker-item')].sort((a,b)=>Number(a.dataset.stickerLine??a.dataset.line??a.closest<HTMLElement>('[data-line]')?.dataset.line??0)-Number(b.dataset.stickerLine??b.dataset.line??b.closest<HTMLElement>('[data-line]')?.dataset.line??0));
  openModal('文章里的图与公式',`<p class="modal-subtitle">按正文顺序排列。可下载原图、公式 SVG 或高清 PNG，在公众号中补插。</p>${renderResult.missing.length?`<div class="notice">${renderResult.missing.length} 张图片缺失。请关闭此面板，用「图片」重新插入本地文件并删除旧引用。</div>`:''}${nodes.map((node,i)=>{
    if(node.classList.contains('image-wrap')||node.classList.contains('sticker-item')){const a=assets.get(node.dataset.asset||'');return `<div class="asset-card"><div class="asset-number">${String(i+1).padStart(2,'0')} / IMAGE</div><div class="asset-card-top"><img class="asset-thumb" src="${esc(node.querySelector('img')?.src||'')}" alt="图片缩略图">${a?`<div class="asset-fields"><label>宽度（%）<input data-asset-field="width" data-asset-id="${a.id}" type="number" min="10" max="100" value="${a.width}"></label><label>对齐<select data-asset-field="align" data-asset-id="${a.id}">${[['left','居左'],['center','居中'],['right','居右']].map(([v,n])=>`<option value="${v}" ${v===a.align?'selected':''}>${n}</option>`).join('')}</select></label><label class="asset-caption">图注<input data-asset-field="caption" data-asset-id="${a.id}" value="${esc(a.caption)}"></label><label class="asset-caption">替代文字<input data-asset-field="alt" data-asset-id="${a.id}" value="${esc(a.alt)}"></label></div>`:'<div class="notice">网络图片尚未随文章备份。可尝试导入本地副本。</div>'}</div><div class="asset-actions">${a?`<button data-download-asset="${a.id}">下载原图</button><button data-compress-asset="${a.id}">生成压缩副本</button>`:`<button data-localize="${i}">导入本地副本</button>`}</div></div>`;}
    return `<div class="asset-card"><div class="asset-number">${String(i+1).padStart(2,'0')} / FORMULA</div><div class="asset-formula">${node.innerHTML}</div><div class="asset-actions"><button data-svg="${i}">下载 SVG</button><button data-png="${i}">下载高清 PNG</button></div></div>`;
  }).join('')||'<div class="empty-state">还没有图片或公式。试试在编辑区直接粘贴一张截图。</div>'}`,'ARTICLE ASSETS');
  if(publisher==='wechat'&&current.stickers?.length){const notice=document.createElement('div');notice.className='notice';notice.innerHTML=`文中有 ${current.stickers.length} 张贴纸。选中贴纸可切换左右轮廓环绕，也可合成局部图片。<br><button id="download-sticker-regions" class="text-button">生成并下载贴纸局部图 ↗</button>`;$('modal-body').prepend(notice);bind('download-sticker-regions',showStickerRegions);}
  $('modal-body').querySelectorAll<HTMLElement>('.asset-fields').forEach(fields=>{const id=fields.querySelector<HTMLElement>('[data-asset-id]')?.dataset.assetId;const a=id&&assets.get(id);if(a)fields.insertAdjacentHTML('beforeend',`<label class="asset-caption">图号（如 图 1）<input data-asset-field="figureLabel" data-asset-id="${a.id}" value="${esc(a.figureLabel||'')}"></label><label class="asset-caption">来源信息<input data-asset-field="source" data-asset-id="${a.id}" value="${esc(a.source||'')}" placeholder="作者、机构、文献或网址"></label>`);});
  $('modal-body').querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-asset-field]').forEach(el=>el.onchange=()=>{
    const a=assets.get(el.dataset.assetId!)!;const field=el.dataset.assetField!;
    if(field==='width'){a.width=Math.max(10,Math.min(100,Number(el.value)||100));el.value=String(a.width);}
    else if(field==='alt'){
      a.alt=el.value;const id=a.id;const newText=current.markdown.replace(new RegExp('!\\[[^\\]]*\\]\\(asset:'+id+'\\)','g'),()=>`![${a.alt.replace(/[\[\]\\\r\n]/g,'')}](asset:${id})`);editor.setText(newText);current.markdown=newText;
    }else (a as any)[field]=el.value;
    dirtyAssets.add(a.id);markDirty();render();
  });
  $('modal-body').querySelectorAll<HTMLElement>('[data-download-asset]').forEach(el=>el.onclick=()=>{const a=assets.get(el.dataset.downloadAsset!)!;download(bytesFromData(a.data) as BlobPart,safeName(a.name),a.mime);});
  $('modal-body').querySelectorAll<HTMLElement>('[data-svg]').forEach(el=>el.onclick=()=>{const svg=nodes[Number(el.dataset.svg)].querySelector('svg')!;const clone=svg.cloneNode(true) as SVGElement;clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.style.color='#1f2937';download(new XMLSerializer().serializeToString(clone),`公式-${Number(el.dataset.svg)+1}.svg`,'image/svg+xml');});
  $('modal-body').querySelectorAll<HTMLElement>('[data-png]').forEach(el=>el.onclick=()=>void(async()=>{try{const svg=nodes[Number(el.dataset.png)].querySelector('svg')!;download(await svgToPNG(svg),`公式-${Number(el.dataset.png)+1}.png`,'image/png');}catch(e){toast(errorMessage(e),true);}})());
  $('modal-body').querySelectorAll<HTMLElement>('[data-localize]').forEach(el=>el.onclick=()=>void(async()=>{
    const node=nodes[Number(el.dataset.localize)],url=node.dataset.source!;const target=current;
    try{el.textContent='正在读取…';const response=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('网络请求失败');const blob=await response.blob();const a=await fileToAsset(new File([blob],'网络图片.'+extension(blob.type),{type:blob.type}));assets.set(a.id,a);dirtyAssets.add(a.id);target.markdown=target.markdown.split(url).join('asset:'+a.id);markDirty(target);if(current.id===target.id){editor.setText(target.markdown);showAssets();}toast('已导入本地副本');}
    catch{el.textContent='导入本地副本';toast('网站不允许读取或图片不可用。请先下载图片，再用「图片」插入。',true);}
  })());
  $('modal-body').querySelectorAll<HTMLElement>('[data-compress-asset]').forEach(el=>el.onclick=()=>void compressImage(el.dataset.compressAsset!).catch(e=>toast(errorMessage(e),true)));
}
async function compressImage(id:string){
  const original=assets.get(id)!,target=current;const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('无法读取图片'));img.src=original.data;});
  const ratio=Math.min(1,1600/img.naturalWidth);const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*ratio);canvas.height=Math.round(img.naturalHeight*ratio);canvas.getContext('2d')!.drawImage(img,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL('image/webp',.85);const copy={...original,id:uid(),name:original.name.replace(/\.[^.]+$/,'')+'-压缩.webp',mime:'image/webp',data};
  snapshot(target,true);assets.set(copy.id,copy);dirtyAssets.add(copy.id);target.markdown=target.markdown.replaceAll('asset:'+id,'asset:'+copy.id);for(const sticker of target.stickers||[])if(sticker.assetId===id)sticker.assetId=copy.id;markDirty(target);
  if(current.id===target.id){editor.setText(target.markdown);showAssets();}toast('已换用压缩副本，原图仍保留在之前的恢复版本中');
}

function makeSticker(assetId:string){
  snapshot(current,true);
  const pattern=new RegExp('!\\[[^\\]]*\\]\\(asset:'+assetId+'(?:\\s+"[^"]*")?\\)');
  const match=pattern.exec(current.markdown);if(!match){toast('请先将图片单独放在一个段落中。',true);return;}
  const old=current.markdown,line=old.slice(0,match.index).split('\n').length-1;
  const updated=old.slice(0,match.index)+old.slice(match.index+match[0].length);
  updateStickerLines(current.stickers,old,updated);current.markdown=updated;
  const sticker=stickerController.make(assetId,Math.min(line+2,updated.split('\n').length-1));
  (current.stickers??=[]).push(sticker);editor.setText(updated);markDirty();render();stickerController.select(sticker.id);
  toast('已开启右侧轮廓环绕。拖动可换段落或左右侧，菜单可切换自由叠放。');
}
function restoreSticker(id:string){
  const sticker=current.stickers?.find(s=>s.id===id);if(!sticker)return;snapshot(current,true);
  current.stickers=current.stickers!.filter(s=>s.id!==id);const lines=current.markdown.split('\n');const asset=assets.get(sticker.assetId)!;
  lines.splice(Math.min(sticker.line,lines.length),0,`![${asset.alt.replace(/[\[\]\\\r\n]/g,'')}](asset:${sticker.assetId})`,'');const text=lines.join('\n');updateStickerLines(current.stickers,current.markdown,text);current.markdown=text;editor.setText(text);markDirty();render();toast('贴纸已恢复为正文图片');
}
async function showStickerRegions(){
  toast('正在本地合成贴纸区域…');const {regions}=await flattenStickers($('preview'));
  openModal('贴纸局部图',`<p class="modal-subtitle">这些图片保留贴纸的叠放效果。复制到公众号后，若局部图未保留，可按顺序补插。</p>${regions.map((region,i)=>`<div class="asset-card"><div class="asset-number">${i+1} / COMPOSITION</div><img src="${region.data}" alt="贴纸局部排版图 ${i+1}" style="max-width:100%;max-height:380px;display:block;margin:0 auto"><div class="asset-actions"><button data-region-download="${i}">下载局部图 ${i+1}</button></div></div>`).join('')||'<p class="empty-state">当前文章还没有自由贴纸。</p>'}`);
  $('modal-body').querySelectorAll<HTMLElement>('[data-region-download]').forEach(el=>el.onclick=()=>{const index=Number(el.dataset.regionDownload);download(bytesFromData(regions[index].data) as BlobPart,`${safeName(current.title)}-贴纸局部-${index+1}.png`,'image/png');});
}

async function init(){
  let storageError='';
  try{await openStore();const stored=await loadStore();for(const a of stored.articles){if(!a.titleMode)a.titleMode='manual';articles.set(a.id,a);}for(const a of stored.assets)assets.set(a.id,a);}catch(e){storageError=errorMessage(e);}
  let recovered=false;
  try{const draft=JSON.parse(readPreference('recovery','null')) as Article|null;if(draft?.version===1&&typeof draft.markdown==='string'&&typeof draft.id==='string'&&typeof draft.title==='string'&&Number.isFinite(draft.updated)){
    const saved=articles.get(draft.id);if(!saved?.deleted&&(!saved||draft.updated>saved.updated)){articles.set(draft.id,{...freshArticle(),...saved,...draft,titleMode:draft.titleMode||saved?.titleMode||'manual',revisions:saved?.revisions||[]});preference('current',draft.id);recovered=true;}
  }}catch{/* A corrupt recovery checkpoint cannot block the saved library. */}
  const active=[...articles.values()].filter(a=>!a.deleted).sort((a,b)=>b.updated-a.updated);
  current=active.find(a=>a.id===readPreference('current',''))||active[0]||current;
  const first=!articles.has(current.id);if(first)articles.set(current.id,current);
  const editorTheme=readPreference(night?'editor-theme-night':'editor-theme','dark');
  $<HTMLSelectElement>('editor-theme').innerHTML=Object.entries(editorThemes).map(([id,t])=>`<option value="${id}">${t.name}</option>`).join('');$<HTMLSelectElement>('editor-theme').value=editorThemes[editorTheme]?editorTheme:'dark';
  editor=new MarkdownEditor($('editor'),current.markdown,editorTheme,text=>{updateStickerLines(current.stickers,current.markdown,text);current.markdown=text;markDirty();queueRender();},(files,pos)=>void addImages(files,pos).catch(e=>toast(errorMessage(e),true)),()=>exportBackup());
  editorChrome(editorTheme);applyAppearance();
  sync=new ScrollSync(editor,$('preview-scroll'),$('preview'));
  previewEditor=new PreviewEditor($('preview'),editor,render,toast);
  stickerController=new StickerController($('preview'),()=>current,assets,()=>{markDirty();requestAnimationFrame(()=>sync.rebuild());},makeSticker,restoreSticker,()=>void showStickerRegions().catch(e=>toast(errorMessage(e),true)));
  bind('modal-close',closeModal);modal.addEventListener('cancel',e=>{e.preventDefault();closeModal();});modal.addEventListener('click',e=>{if(e.target===modal){const b=modal.getBoundingClientRect();const m=e as MouseEvent;if(m.clientX<b.left||m.clientX>b.right||m.clientY<b.top||m.clientY>b.bottom)closeModal();}});
  bind('library-toggle',toggleLibrary);bind('library-button',toggleLibrary);bind('library-close',toggleLibrary);
  bind('new-folder',e=>folderEditor(e.currentTarget as HTMLElement));
  $('folder-list').addEventListener('click',e=>{const target=e.target as HTMLElement,edit=target.closest<HTMLElement>('[data-folder-edit]'),folder=target.closest<HTMLElement>('[data-folder]');if(edit)folderEditor(edit,edit.dataset.folderEdit!);else if(folder){libraryFolder=folder.dataset.folder!;saveFolders();renderLibrary();}});
  bind('new-article',()=>addArticle());bind('active-tab',()=>{trash=false;renderLibrary();});bind('trash-tab',()=>{trash=true;renderLibrary();});bind('library-search',renderLibrary,'input');
  const titleMode=document.createElement('button');titleMode.id='title-mode';titleMode.className='title-mode-button';titleMode.setAttribute('aria-label','切换文章名来源');$('document-title').after(titleMode);titleMode.onclick=()=>{current.titleMode=current.titleMode==='manual'?'auto':'manual';markDirty();renderLibrary();};
  bind('document-title',()=>{current.titleMode='manual';current.title=$<HTMLInputElement>('document-title').value;markDirty();renderLibrary();},'input');
  bind('theme-button',()=>showThemes());bind('samples-button',showSamples);bind('style-button',e=>{const p=$('style-panel');p.hidden=!p.hidden;if(!p.hidden){renderStylePanel();if((e as MouseEvent).detail===0)$('style-close').focus();}});
  document.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.defaultPrevented||modal.open)return;const target=e.target as Node;if(!$('style-panel').hidden&&($('style-panel').contains(target)||target===$('style-button'))){e.preventDefault();$('style-panel').hidden=true;$('style-button').focus();}else if(!$('library').hidden&&($('library').contains(target)||target===$('library-button'))){e.preventDefault();toggleLibrary();$('library-button').focus();}});
  bind('inline-style-button',showInlineStyle);bind('selection-style-button',showInlineStyle);
  bind('editor-theme',()=>{const value=$<HTMLSelectElement>('editor-theme').value;editor.theme(value);editorChrome(value);preference(night?'editor-theme-night':'editor-theme',value);},'change');
  bind('night-button',()=>{night=!night;preference('appearance',night?'night':'day');const id=readPreference(night?'editor-theme-night':'editor-theme','dark');const value=editorThemes[id]?id:'dark';$<HTMLSelectElement>('editor-theme').value=value;editor.theme(value);editorChrome(value);applyAppearance();});
  bind('preview-brightness',()=>{brightness=Number($<HTMLInputElement>('preview-brightness').value);preference('preview-brightness',String(brightness));applyAppearance();},'input');
  bind('preview-edit-button',()=>{previewEditor.enabled=!previewEditor.enabled;$('preview-edit-button').setAttribute('aria-pressed',String(previewEditor.enabled));$('preview-edit-button').textContent=previewEditor.enabled?'完成修改':'编辑文字';render();if(previewEditor.enabled)toast('点击标题或正文修改文字。格式、公式、图片保持锁定；换行请在左侧修改。');});
  for(const mode of ['edit','preview'])bind('mobile-'+mode,()=>{document.body.dataset.mobilePane=mode;for(const id of ['edit','preview'])$('mobile-'+id).setAttribute('aria-selected',String(id===mode));editor.view.requestMeasure();sync.rebuild();});
  const savedWidth=readPreference('preview-width','375');
  $<HTMLSelectElement>('preview-width').value=['375','430','wide'].includes(savedWidth)?savedWidth:'375';
  $('preview').style.maxWidth=savedWidth==='wide'?'760px':(['375','430'].includes(savedWidth)?savedWidth:'375')+'px';
  const savedShare=Number(readPreference('split-share','49'));$('split-workspace').style.setProperty('--editor-share',(Number.isFinite(savedShare)?Math.max(25,Math.min(75,savedShare)):49)+'%');
  bind('sync-button',()=>{sync.enabled=!sync.enabled;$('sync-button').classList.toggle('active',sync.enabled);$('sync-button').setAttribute('aria-pressed',String(sync.enabled));toast(sync.enabled?'双向同步滚动已开启':'已关闭同步，可独立浏览两侧');});
  bind('preview-width',()=>{const v=$<HTMLSelectElement>('preview-width').value;preference('preview-width',v);const line=sync.capture();$('preview').style.maxWidth=v==='wide'?'760px':v+'px';document.querySelector<HTMLElement>('.preview-caption')!.style.maxWidth=v==='wide'?'760px':v+'px';requestAnimationFrame(()=>{sync.rebuild();sync.restore(line);});},'change');
  bind('image-button',()=>$('image-input').click());bind('image-input',async()=>{const input=$<HTMLInputElement>('image-input');const files=[...(input.files||[])];input.value='';await addImages(files,editor.view.state.selection.main.head);},'change');
  const layoutButton=document.createElement('button');layoutButton.id='image-layout-button';layoutButton.textContent='组图 ▾';layoutButton.title='切换图片组排版';$('image-button').after(layoutButton);layoutButton.onclick=()=>showImageLayouts('',layoutButton);
  $('preview').addEventListener('click',event=>{if(previewEditor.enabled||publisher!=='wechat')return;const target=event.target as HTMLElement,group=target.closest<HTMLElement>('.image-gallery');if(group){event.stopImmediatePropagation();showImageLayouts(group.dataset.gallery!,layoutButton);return;}const image=target.closest<HTMLElement>('.image-wrap');if((themeById(current.theme).baseId||current.theme)==='magazine'&&image){event.stopImmediatePropagation();showMagazineImage(image);}},true);
  const dividerButton=document.createElement('button');dividerButton.id='divider-button';dividerButton.textContent='分割线 ▾';$('image-layout-button').after(dividerButton);dividerButton.onclick=()=>showDividers(dividerButton);
  const indentButton=document.createElement('button');indentButton.id='indent-toggle';indentButton.textContent='段首空两格';indentButton.title='自动缩进正文首行；不改变 Markdown 内容';$('inline-style-button').before(indentButton);indentButton.onclick=()=>{current.typography.indent=!(current.typography.indent??themeDefaults(themeById(current.theme)).indent);markDirty();render();if(!$('style-panel').hidden)renderStylePanel();};
  bind('math-button',showFormulas);bind('assets-button',showAssets);bind('toc-button',showTOC);bind('undo-button',()=>editor.undo());bind('redo-button',()=>editor.redo());bind('search-button',()=>editor.search());
  bind('publisher',()=>{publisher=$<HTMLSelectElement>('publisher').value;preference('publisher',publisher);render();},'change');
  bind('copy-button',copyArticle);bind('export-toggle',showExport);bind('backup-library',()=>exportBackup(true));bind('import-button',()=>$('import-input').click());bind('import-input',async()=>{const input=$<HTMLInputElement>('import-input');const files=[...(input.files||[])];input.value='';await importFiles(files);},'change');
  document.querySelectorAll<HTMLElement>('[data-format]').forEach(el=>el.onclick=()=>{
    const type=el.dataset.format;
    if(type==='bold')boldSelection(editor,toast);
    else if(type==='italic'){if(hasSelectedStyle(editor))toggleTextStyle(editor,'italic');else editor.wrap('*');}
    else if(type==='strike'||type==='underline'||type==='wave'){
      const selection=editor.view.state.selection.main;if(editor.view.state.sliceDoc(selection.from,selection.to).includes('\n')){toast('请在同一行 Markdown 中选中文字。');return;}
      if(type==='strike'&&!hasSelectedStyle(editor))editor.wrap('~~');else toggleTextStyle(editor,type);
    }else if(type==='heading')showBlockMenu(el);
    else if(type==='quote'||type==='poem')blockFormat(editor,type);
    else if(type==='code')codeFormat(editor);
    else if(type==='footnote'){insertFootnote(editor);toast('脚注标记已插入，直接填写文末选中的注释内容。');}
    else if(type==='link')editor.wrap('[','](https://example.com)');
    else if(type==='table')showTableMenu(el);
  });
  bind('selection-block-button',e=>showBlockMenu(e.currentTarget as HTMLElement));
  bind('table-style-button',e=>showTableMenu(e.currentTarget as HTMLElement));
  $('article-list').addEventListener('click',e=>{
    const target=e.target as HTMLElement,item=target.closest<HTMLElement>('[data-id]');if(!item)return;const article=articles.get(item.dataset.id!)!;
    const action=target.dataset.action;
    if(action==='delete'){snapshot(article,true);article.deleted=true;markDirty(article);if(article.id===current.id){const next=[...articles.values()].find(a=>!a.deleted);if(next)switchArticle(next.id);else addArticle();}renderLibrary();toast('已移入回收站，可以随时恢复');}
    else if(action==='restore'){article.deleted=false;markDirty(article);renderLibrary();toast('文章已恢复到草稿');}
    else if(action==='move')moveArticle(target,article);
    else if(action==='history')showHistory(article);
    else if(action==='duplicate'){
      const copy=freshArticle(article.title+' · 副本',article.markdown);copy.titleMode='manual';copy.folder=article.folder;copy.theme=article.theme;copy.typography=structuredClone(article.typography);copy.stickers=structuredClone(article.stickers||[]).map(s=>({...s,id:uid()}));
      for(const id of new Set([...assetRefs(copy.markdown),...copy.stickers.map(s=>s.assetId)])){const a=assets.get(id);if(a){const cloned={...a,id:uid()};assets.set(cloned.id,cloned);dirtyAssets.add(cloned.id);copy.markdown=copy.markdown.replaceAll('asset:'+id,'asset:'+cloned.id);for(const s of copy.stickers)if(s.assetId===id)s.assetId=cloned.id;}}
      articles.set(copy.id,copy);markDirty(copy);switchArticle(copy.id);
    }else if(!trash)switchArticle(article.id);
  });
  $('article-list').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.target as HTMLElement).classList.contains('article-item'))(e.target as HTMLElement).click();});
  bind('render-state',()=>{if(renderResult.errors.length){editor.goto(renderResult.errors[0].line);toast(renderResult.errors[0].message,true);}else if(renderResult.missing.length)showAssets();});
  const splitter=$('splitter');splitter.addEventListener('pointerdown',e=>{splitter.setPointerCapture(e.pointerId);document.body.style.userSelect='none';});
  splitter.addEventListener('pointermove',e=>{if(!splitter.hasPointerCapture(e.pointerId))return;const rect=$('split-workspace').getBoundingClientRect();const share=Math.max(25,Math.min(75,(e.clientX-rect.left)/rect.width*100));$('split-workspace').style.setProperty('--editor-share',share+'%');editor.view.requestMeasure();sync.rebuild();});
  const rememberSplit=()=>{document.body.style.userSelect='';preference('split-share',$('split-workspace').style.getPropertyValue('--editor-share').replace('%',''));sync.rebuild();};
  splitter.addEventListener('pointerup',e=>{splitter.releasePointerCapture(e.pointerId);rememberSplit();});splitter.addEventListener('pointercancel',rememberSplit);
  splitter.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const current=Number.parseFloat($('split-workspace').style.getPropertyValue('--editor-share'))||49;$('split-workspace').style.setProperty('--editor-share',Math.max(25,Math.min(75,current+(e.key==='ArrowRight'?2:-2)))+'%');rememberSplit();requestAnimationFrame(()=>sync.rebuild());}});
  new ResizeObserver(()=>requestAnimationFrame(()=>{stickerController.reposition();sync.rebuild();})).observe($('preview'));
  window.addEventListener('beforeunload',e=>{if(dirtyGeneration!==savedGeneration){e.preventDefault();e.returnValue='';}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirtyArticles.size)void save();});
  switchArticle(current.id);
  if(themeLibraryError())toast(themeLibraryError(),true);
  if(storageError){$('save-state').className='save-error';$('save-state').textContent='本地存储不可用 · 请导出备份';toast('浏览器未开放本地存储。可继续编辑，请用文件备份保存。',true);}else if(first||recovered){markDirty();if(recovered)toast('已找回上次尚未保存完成的文字。');}else $('save-state').innerHTML='<i></i> 已保存到浏览器';
}
void init().catch(e=>{toast('初始化失败：'+errorMessage(e),true);$('save-state').textContent='初始化失败，请重新打开';});
