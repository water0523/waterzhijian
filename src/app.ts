import {MarkdownEditor,ScrollSync,editorThemes} from './editor';
import {themes,themeById,themeCSS,visibleThemes,themeDefaults,planThemeImports,themeLibraryError} from './themes';
import type {ThemeDefinition} from './theme-types';
import {showThemeManager,chooseThemeFile} from './theme-manager';
import {decorateTheme,themeDesign} from './theme-design';
import {renderMarkdown,renderMath,exportFragment,firstArticleHeading,type RenderResult} from './render';
import {freshArticle,escapeHTML as esc,uid,fontNames,type Article,type Asset,type Typography,type Revision} from './model';
import {openStore,loadStore,persist,preference,readPreference} from './storage';
import {download,safeName,createBackup,readBackup,fileToAsset,assetRefs,svgToPNG,bytesFromData,extension} from './files';
import {standardCSS,standardBody,standardFragment,createWord,preparePrintWindow} from './documents';
import {science,equations,poetry} from './samples';
import {journalSample,journalFigure,journalPreviewSample} from './journal-sample';
import {folioSample,folioAssets} from './folio-sample';
import {folioNames,type FolioKind} from './folio-blocks';
import {isFolio} from './folio-design';
import {editionAssets,editionSamples} from './edition-samples';
import {editionCatalog,editionTitles,type Edition} from './edition-blocks';
import {themeMatches} from './theme-search';
import {showRewrite,cancelRewrite} from './rewrite';
import {inspectFonts} from './font-inspection';
import {StickerController,updateStickerLines,flattenStickers,publicationHTML} from './stickers';
import {PreviewEditor} from './preview-editor';
import {styleAttributes,parseInlineStyle,literaryRoles,type InlineStyle} from './inline-style';
import {showInlineMenu,mountInlineMenus,type InlineMenu} from './inline-picker';
import {appendReferences} from './references';
import {boldSelection,selectedMath,applyMathStyle} from './math-format';
import {selectedTextRuns,textStyleChanges,selectionStyleKeys} from './text-selection';
import {createLongImage} from './long-image';
import {saveImageFile} from './image-delivery';
import {openPopover,closePopover,enhanceColors,mountPopoverHover} from './popover';
import {blockFormat,toggleTextStyle,hasSelectedStyle,codeFormat,insertFootnote} from './formatting';
import {dividerOptions,dividerSVG} from './dividers';
import {mountElementPanel} from './element-panel';
import {ArticleAssetMap,appearance,captureAssets} from './asset-view';
import {checkpoint,clearCheckpoint,recoverDrafts,publishRecoverySidecar} from './recovery';
import {compareText,compactDiff} from './revision-diff';
import {inspectWriting,tidyMarkdown,stripHeadingNumbers,writingOutlines} from './writing-tools';
import {isolateHistory} from '@codemirror/commands';
import {mountThemeSidebar} from './theme-sidebar';
import {exportOptionsHTML} from './export-options';
import {showFormatRewrite} from './format-rewrite';
import {uiIcon} from './ui-icons';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const assetStore=new Map<string,Asset>();const articles=new Map<string,Article>();
const headingCache=new WeakMap<Article,{markdown:string;heading:string|null}>();
let current:Article=freshArticle('光的来信 · 科普示例',science);
const assets=new ArticleAssetMap(assetStore,()=>current);
let editor:MarkdownEditor,sync:ScrollSync;
let stickerController:StickerController;
let previewEditor:PreviewEditor;
let night=readPreference('appearance','day')==='night';
let fontInspection=readPreference('font-inspection','false')==='true';
const savedBrightness=Number(readPreference('preview-brightness','78'));
let brightness=Number.isFinite(savedBrightness)?Math.max(35,Math.min(100,savedBrightness)):78;
let renderResult:RenderResult={html:'',errors:[],missing:[],external:[]};
let renderTimer=0,saveTimer=0,toastTimer=0,dirtyGeneration=0,savedGeneration=0,trash=false;
let savePromise:Promise<boolean>|undefined,recoveryWarning=false;
const dirtyArticles=new Set<string>(),dirtyAssets=new Set<string>();
const articleEdits=new Map<string,number>(),assetEdits=new Map<string,number>();
function trackArticle(id:string){dirtyArticles.add(id);articleEdits.set(id,++dirtyGeneration);}
function trackAsset(id:string){dirtyAssets.add(id);assetEdits.set(id,++dirtyGeneration);}
let lastRenderMS=0;
let publisher=readPreference('publisher','wechat')==='zhihu'?'zhihu':'wechat';
// Legacy documents keep an explicitly chosen preference; new documents start
// with direct hyperlinks. The current choice travels with the article.
const legacyReferences=readPreference('references-enabled','false')==='true';
const referencesEnabled=()=>current.linkMode?current.linkMode==='end':legacyReferences;
function setLinkMode(mode:'direct'|'end'){if(current.linkMode===mode)return;snapshot(current,true);current.linkMode=mode;markDirty();render();const input=document.getElementById('setting-references') as HTMLInputElement|null;if(input)input.checked=referencesEnabled();}
let folders:string[]=[];try{const raw=JSON.parse(readPreference('folders','[]'));if(Array.isArray(raw))folders=raw.filter(n=>typeof n==='string'&&n.length<=40&&n!=='*'&&!/[\\/\r\n]/.test(n));}catch{}
let libraryFolder=readPreference('library-folder','*'),libraryRecent=false;
function saveFolders(){folders=[...new Set(folders)];preference('folders',JSON.stringify(folders));preference('library-folder',libraryFolder);}
const modal=$<HTMLDialogElement>('modal');
let copyMessage='',copyTone='',copyTimer=0;
function paintCopyButton(){const button=$<HTMLButtonElement>('copy-button');button.innerHTML=uiIcon(copyTone==='success'?'check':copyTone==='error'?'alert':'plane')+'<span>'+esc(copyMessage||(publisher==='zhihu'?'复制到知乎':'复制到公众号'))+'</span>';button.dataset.state=copyTone;button.disabled=copyTone==='busy';button.setAttribute('aria-busy',String(copyTone==='busy'));button.setAttribute('aria-live','polite');}
function copyFeedback(message:string,tone:string,timeout=3000){clearTimeout(copyTimer);copyMessage=message;copyTone=tone;paintCopyButton();if(timeout)copyTimer=window.setTimeout(()=>{copyMessage='';copyTone='';paintCopyButton();},timeout);}
const themeGalleryResize=new ResizeObserver(entries=>{for(const entry of entries){const el=entry.target as HTMLElement;const sample=el.querySelector<HTMLElement>('.theme-sample');if(sample){const scale=el.clientWidth/375;sample.style.transform=`scale(${scale})`;el.style.height=Math.round(390*scale)+'px';}}});

function toast(text:string,error=false){$('toast').textContent=text;$('toast').className='visible'+(error?' error':'');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('toast').className='',error?6500:3500);}
function errorMessage(e:unknown){return e instanceof Error?e.message:String(e);}
function bind(id:string,handler:(e:Event)=>unknown,type='click'){$(id).addEventListener(type,e=>{try{Promise.resolve(handler(e)).catch(err=>toast(errorMessage(err),true));}catch(err){toast(errorMessage(err),true);}});}
function openModal(title:string,html:string,eyebrow='非水·成章 · 本地写作'){clearThemePreview();cancelRewrite();closePopover();$('modal-title').textContent=title;$('modal-eyebrow').textContent=eyebrow;$('modal-body').innerHTML=html;enhanceColors($('modal-body'));if(!modal.open)modal.showModal();}
function closeModal(){cancelRewrite();themeGalleryResize.disconnect();modal.close();$('modal-body').replaceChildren();}
function markDirty(article=current){
  syncArticleTitle(article);
  article.updated=Date.now();article.assets=[...new Set([...assetRefs(article.markdown),...(article.stickers||[]).map(s=>s.assetId)])];article.assetSettings=captureAssets(article,assetStore);trackArticle(article.id);
  if(!checkpoint(article,article===current)&&!recoveryWarning){recoveryWarning=true;toast('临时恢复空间不足，正在尝试保存到文章库；建议导出文件备份。',true);}
  paintSaveState('saving');
  clearTimeout(saveTimer);saveTimer=window.setTimeout(()=>void save(),1000);
}
function syncArticleTitle(article:Article){
  let cached=headingCache.get(article);if(!cached||cached.markdown!==article.markdown){cached={markdown:article.markdown,heading:firstArticleHeading(article.markdown)};headingCache.set(article,cached);}
  article.title=cached.heading||'未命名文章';article.titleMode='auto';
  if(article.id===current.id){$('document-title').textContent=article.title;$('document-title').title=article.title+' · 在正文中修改 H1 即可改名';}
  const name=$('article-list')?.querySelector<HTMLElement>(`[data-id="${article.id}"] strong`);if(name)name.textContent=article.title;
}
function paintSaveState(kind:'saving'|'saved'|'error',message=''){
  const state=$('save-state');state.className=kind==='error'?'save-error':'';state.dataset.state=kind;
  const time=new Date(kind==='saved'?current.updated:Date.now()).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
  state.innerHTML=uiIcon(kind==='error'?'alert':'cloud')+'<span>'+esc(message||(kind==='saved'?'已保存 '+time:kind==='saving'?'正在保存…':'保存失败 · 请导出备份'))+'</span>';
  state.title=kind==='saved'?'已自动保存到当前浏览器 '+time:state.textContent||'';
}
function snapshot(a:Article,force=false){
  const settings=captureAssets(a,assetStore);
  const last=a.revisions.at(-1);
  if(last&&last.markdown===a.markdown&&last.title===a.title&&last.titleMode===a.titleMode&&last.theme===a.theme&&last.linkMode===a.linkMode&&JSON.stringify(last.typography)===JSON.stringify(a.typography)&&JSON.stringify(last.stickers||[])===JSON.stringify(a.stickers||[])&&JSON.stringify(last.assetSettings||{})===JSON.stringify(settings))return false;
  if(!force&&last&&Date.now()-last.at<30000)return false;
  a.revisions.push({at:Date.now(),title:a.title,titleMode:a.titleMode,markdown:a.markdown,theme:a.theme,typography:structuredClone(a.typography),assets:[...new Set([...assetRefs(a.markdown),...(a.stickers||[]).map(s=>s.assetId)])],stickers:structuredClone(a.stickers||[]),assetSettings:structuredClone(settings),linkMode:a.linkMode});
  a.revisions=a.revisions.slice(-20);
  return true;
}
async function save():Promise<boolean>{
  if(savePromise){const ok=await savePromise;return ok&&(dirtyArticles.size||dirtyAssets.size)?save():ok;}
  if(!dirtyArticles.size&&!dirtyAssets.size)return true;
  savePromise=saveBatch();try{return await savePromise;}finally{savePromise=undefined;}
}
async function saveBatch(){
  const generation=dirtyGeneration,ids=new Map([...dirtyArticles].map(id=>[id,articleEdits.get(id)])),imageIds=new Map([...dirtyAssets].map(id=>[id,assetEdits.get(id)]));
  try{
    const articleCopies=[...ids.keys()].map(id=>{const a=articles.get(id);if(!a)throw new Error('待保存文章不存在');snapshot(a);return structuredClone(a);});
    const imageCopies=[...imageIds.keys()].map(id=>{const a=assetStore.get(id);if(!a)throw new Error('待保存图片不存在');return structuredClone(a);});
    const result=await persist(articleCopies,imageCopies);let conflicts=0;
    for(const image of result.foreignAssets)assetStore.set(image.id,image);
    for(const commit of result.commits){
      const live=articles.get(commit.inputId)!;const pending=articleEdits.get(commit.inputId)!==ids.get(commit.inputId),edit=articleEdits.get(commit.inputId)!;
      if(commit.article.id!==commit.inputId){
        conflicts++;articles.delete(commit.inputId);if(commit.original){commit.original.titleMode??='manual';articles.set(commit.original.id,commit.original);}
        live.id=commit.article.id;live.title=pending?live.title+' · '+(commit.original?'冲突副本':'恢复稿'):commit.article.title;live.titleMode='manual';live.created=commit.article.created;
        articles.set(live.id,live);dirtyArticles.delete(commit.inputId);articleEdits.delete(commit.inputId);
        if(pending){dirtyArticles.add(live.id);articleEdits.set(live.id,edit);}else dirtyArticles.delete(live.id);
      }else if(!pending)dirtyArticles.delete(live.id);
      if(!pending)Object.assign(live,commit.article);else {
        live.storeRevision=commit.article.storeRevision;
        const seen=new Set<string>();live.revisions=[...commit.article.revisions,...live.revisions].sort((a,b)=>a.at-b.at).filter(r=>{const key=JSON.stringify(r);if(seen.has(key))return false;seen.add(key);return true;}).slice(-20);
      }
      clearCheckpoint(commit.inputId);if(pending)checkpoint(live);
      if(live===current){preference('current',live.id);syncArticleTitle(live);publishRecoverySidecar(live);}
    }
    for(const [id,edit] of imageIds)if(assetEdits.get(id)===edit)dirtyAssets.delete(id);
    if(!dirtyArticles.size&&!dirtyAssets.size){savedGeneration=dirtyGeneration;paintSaveState('saved');}
    else {savedGeneration=generation;clearTimeout(saveTimer);saveTimer=window.setTimeout(()=>void save(),500);}
    renderLibrary();
    if(conflicts)toast('另一窗口更新了同一篇文章，已保留原稿和冲突副本。');
    return true;
  }catch(e){paintSaveState('error','保存失败 · 请立即导出备份');toast('浏览器保存失败，当前内容仍在。请导出文件备份。'+errorMessage(e),true);return false;}
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
  document.body.dataset.appearance=night?'night':'day';document.documentElement.style.background=night?'#131f2b':'';
  document.body.style.setProperty('--preview-brightness',String(brightness/100));
  $('night-button').innerHTML='<span class="'+(!night?'active':'')+'">'+uiIcon('sun')+'</span><span class="'+(night?'active':'')+'">'+uiIcon('moon')+'</span>';$('night-button').setAttribute('aria-pressed',String(night));$('night-button').setAttribute('aria-label',night?'切换日间模式':'切换夜间模式');
  $('preview-dimming').hidden=!night;$<HTMLInputElement>('preview-brightness').value=String(brightness);$('brightness-value').textContent=brightness+'%';
}
function editorChrome(id:string){const t=editorThemes[id]||editorThemes.dark;const pane=document.querySelector<HTMLElement>('.editor-pane')!;for(const [name,value] of Object.entries({bg:t.bg,fg:t.fg,surface:t.line,muted:t.muted,accent:t.accent,border:t.muted+'40'}))pane.style.setProperty('--editor-'+name,value);}
function setWorkspaceView(mode:'compare'|'preview'){
  document.body.dataset.workspaceView=mode;
  for(const other of ['compare','preview'])$('view-'+other).setAttribute('aria-pressed',String(other===mode));
  const preview=mode==='preview';$('header-preview-button').setAttribute('aria-pressed',String(preview));
  $('header-preview-button').innerHTML=uiIcon(preview?'columns':'eye')+'<span>'+(preview?'返回对照':'预览')+'</span>';
  editor.view.requestMeasure();sync.rebuild();
}
function setPreviewWidth(value:string){
  const width=['375','430','wide'].includes(value)?value:'430',line=sync.capture();
  $<HTMLSelectElement>('preview-width').value=width;preference('preview-width',width);
  const max=width==='wide'?'760px':width+'px';$('preview').style.maxWidth=max;
  document.querySelector<HTMLElement>('.preview-caption')!.style.maxWidth=max;
  $('preview-narrow').setAttribute('aria-pressed',String(width!=='wide'));$('preview-wide').setAttribute('aria-pressed',String(width==='wide'));
  requestAnimationFrame(()=>{sync.rebuild();sync.restore(line);});
}
let renderedArticleId='';
// A hover preview never becomes part of the saved article or its history.
let peekThemeId='';
let themeSidebar:ReturnType<typeof mountThemeSidebar>|undefined;
function clearThemePreview(repaint=true){if(!peekThemeId)return;peekThemeId='';delete document.body.dataset.themePeek;if(repaint)render();}
function previewArticleTheme(id:string){if(publisher!=='wechat'||$('theme-sidebar').hidden||modal.open||peekThemeId===id)return;peekThemeId=id;document.body.dataset.themePeek=id;render();}
function syncCatalogLayout(){
  const libraryOpen=!$('library').hidden,themeOpen=!$('theme-sidebar').hidden;
  preference('library-open',String(libraryOpen));document.body.classList.toggle('library-open',libraryOpen);document.body.classList.toggle('theme-sidebar-open',themeOpen);
  $('rail-documents').setAttribute('aria-pressed',String(libraryOpen&&!trash));$('rail-trash').setAttribute('aria-pressed',String(libraryOpen&&trash));$('theme-sidebar-toggle').setAttribute('aria-pressed',String(themeOpen));
  requestAnimationFrame(()=>{editor?.view.requestMeasure();sync?.rebuild();});
}
function toggleThemeSidebar(){const panel=$('theme-sidebar');clearThemePreview();panel.hidden=!panel.hidden;if(!panel.hidden)themeSidebar?.reveal();preference('theme-sidebar-open',String(!panel.hidden));syncCatalogLayout();}
function render(){
  syncArticleTitle(current);
  clearTimeout(renderTimer);const start=performance.now();const reading=sync?.capture()||0;
  try{
    const disclosureKey=(node:HTMLElement)=>node.className+'|'+node.dataset.line+'|'+node.querySelector(':scope > summary')?.textContent;
    const disclosures=new Map(renderedArticleId===current.id?[...$('preview').querySelectorAll<HTMLDetailsElement>('details')].map(n=>[disclosureKey(n),{open:n.open,scroll:n.querySelector<HTMLElement>(':scope > .journal-content,:scope > .folio-content,:scope > .edition-content')?.scrollTop||0}] as const):[]);
    renderResult=renderMarkdown(current.markdown,assets,previewEditor?.enabled);
    const committed=themeById(current.theme),theme=themeById(peekThemeId||current.theme);$('article-style').textContent=publisher==='zhihu'?standardCSS():themeCSS(theme,peekThemeId?{}:current.typography);
    const indentButton=document.getElementById('indent-toggle') as HTMLButtonElement|null;
    if(indentButton){const active=current.typography.indent??themeDefaults(committed).indent;indentButton.classList.toggle('active',active);indentButton.setAttribute('aria-pressed',String(active));indentButton.disabled=publisher==='zhihu';}
    $('preview').innerHTML=(publisher==='zhihu'?standardBody(current,assets,renderResult.html):renderResult.html)||'<p style="color:#a1aa9c;text-align:center;padding-top:70px;text-indent:0">从左侧写下第一句话。</p>';
    if(publisher==='wechat')decorateTheme($('preview'),theme);
    for(const node of $('preview').querySelectorAll<HTMLDetailsElement>('details')){
      const previous=disclosures.get(disclosureKey(node));if(previous){node.open=previous.open;const content=node.querySelector<HTMLElement>(':scope > .journal-content,:scope > .folio-content,:scope > .edition-content');if(content)content.scrollTop=previous.scroll;}
      node.addEventListener('toggle',()=>{if(node.isConnected)requestAnimationFrame(()=>sync?.rebuild());});
    }
    renderedArticleId=current.id;
    if(publisher==='wechat'&&referencesEnabled())appendReferences($('preview'));
    stickerController?.setEnabled(publisher==='wechat'&&!previewEditor?.enabled);if(publisher==='wechat')stickerController?.render();
    previewEditor?.attach();inspectFonts($('preview'),fontInspection);
    $('theme-name').textContent=committed.name;$('theme-dot').style.background=committed.accent;$('preview-caption-name').textContent=publisher==='zhihu'?'知乎 · 标准 Markdown':(peekThemeId?'试看 · ':'')+theme.name;
    const mood=$('folio-font-button');if(mood){mood.hidden=!isFolio(committed)||publisher!=='wechat';mood.textContent=({'noto-serif':'书卷宋体',wenkai:'温润楷体','noto-sans':'现代人文黑'} as Record<string,string>)[current.typography.font||committed.font]||'自定字体';mood.textContent+=' ▾';}
    $<HTMLSelectElement>('publisher').value=publisher;$('preview-target').textContent=publisher==='zhihu'?'知乎样式':peekThemeId?'主题试看 · 点击卡片应用':'公众号样式';paintCopyButton();
    themeSidebar?.updateCurrent();
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
function switchArticle(id:string,resetEditor=true){
  clearThemePreview(false);
  closePopover();
  const next=articles.get(id);if(!next||next.deleted)return;
  if(current.id!==id&&snapshot(current,true))markDirty(current);
  current=next;preference('current',id);syncArticleTitle(current);
  publishRecoverySidecar(current);
  if(resetEditor)editor.setText(current.markdown,true);$('preview-scroll').scrollTop=0;render();renderLibrary();if(!$('style-panel').hidden)renderStylePanel();
  if(window.matchMedia('(max-width:760px)').matches)$('library').hidden=true;
  requestAnimationFrame(()=>$('preview-scroll').scrollTop=0);
}
function addArticle(title='未命名文章',markdown='',theme='rational'){
  const article=freshArticle(title,markdown);article.theme=theme;article.folder=libraryFolder==='*'?undefined:libraryFolder||undefined;trash=false;articles.set(article.id,article);markDirty(article);switchArticle(article.id);return article;
}
function renderLibrary(){
  for(const a of articles.values())syncArticleTitle(a);
  for(const a of articles.values())if(a.folder&&!folders.includes(a.folder))folders.push(a.folder);
  if(libraryFolder!=='*'&&libraryFolder&&!folders.includes(libraryFolder))libraryFolder='*';
  const query=$<HTMLInputElement>('library-search').value.toLowerCase(),all=[...articles.values()],active=all.filter(a=>!a.deleted),recentSince=Date.now()-30*86400000;
  const words=(text:string)=>(text.match(/[\u3400-\u9fff]|[A-Za-z0-9]+/g)||[]).length;
  const list=all.filter(a=>a.deleted===trash&&(trash||libraryFolder==='*'||(a.folder||'')===libraryFolder)&&(!libraryRecent||a.updated>=recentSince)&&(!query||(a.title+'\n'+a.markdown).toLowerCase().includes(query))).sort((a,b)=>b.updated-a.updated);
  $('article-list').innerHTML=list.map(a=>`<div class="article-item ${a.id===current.id?'current':''}" data-id="${a.id}" tabindex="0" role="button" aria-label="${esc(a.title)}"><strong>${esc(a.title)}</strong><small>${words(a.markdown).toLocaleString()} 字 · ${new Date(a.updated).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'})} · ${themeById(a.theme).name}</small><details class="article-actions"><summary aria-label="文章操作" title="文章操作">⋯</summary><div class="item-actions">${trash?'<button data-action="restore">恢复文章</button>':'<button data-action="duplicate">副本</button><button data-action="history">历史</button><button data-action="delete">删除</button>'}</div></details></div>`).join('')||'<div class="empty-state">'+(query?'没有找到相关文章':libraryRecent?'最近 30 天还没有编辑记录':'这里还没有文章')+'</div>';
  $('library-count').textContent=String(active.length);$('rail-document-count').textContent=String(active.length);syncCatalogLayout();
  for(const [id,icon,label,count,selected] of [['active-tab','document','我的文档',active.length,!trash&&!libraryRecent],['recent-tab','history','最近编辑',active.filter(a=>a.updated>=recentSince).length,!trash&&libraryRecent],['trash-tab','trash','回收站',all.length-active.length,trash]] as const){
    $(id).innerHTML=uiIcon(icon)+'<span>'+label+'</span><small>'+count+'</small>';$(id).classList.toggle('active',selected);$(id).setAttribute('aria-pressed',String(selected));
  }
  $('article-list-label').textContent=trash?'回收站':query?'搜索结果':libraryRecent?'最近 30 天':libraryFolder==='*'?'最近编辑':libraryFolder||'未分类';$('article-list-total').textContent=list.length+' 篇';
  $('folder-list').hidden=trash;
  document.querySelector<HTMLElement>('.folder-heading')!.hidden=trash;
  $('folder-list').innerHTML=[['*','全部文章'],['','未分类'],...folders.map(n=>[n,n])].map(([id,name])=>`<div class="folder-row"><button data-folder="${esc(id)}" class="${id===libraryFolder&&!libraryRecent?'active':''}"><span>${uiIcon(id==='*'?'document':'folder')}${esc(name)}</span><small>${active.filter(a=>id==='*'||(a.folder||'')===id).length}</small></button>${id&&id!=='*'?`<button data-folder-edit="${esc(id)}" aria-label="管理${esc(name)}" title="重命名 / 删除文件夹">···</button>`:''}</div>`).join('');
  if(!trash)for(const item of $('article-list').querySelectorAll<HTMLElement>('[data-id]')){const a=articles.get(item.dataset.id!)!;item.querySelector('.item-actions')!.insertAdjacentHTML('afterbegin','<button data-action="move">移动</button>');if(a.folder)item.querySelector('small')!.append(' · '+a.folder);}
  const today=new Date();today.setHours(0,0,0,0);const days=Array.from({length:7},(_,i)=>{const from=today.getTime()-(6-i)*86400000;return {from,count:active.filter(a=>a.updated>=from&&a.updated<from+86400000).reduce((n,a)=>n+words(a.markdown),0)};}),max=Math.max(1,...days.map(d=>d.count));
  $('library-stats').innerHTML=`<div><strong>写作统计</strong><span>${active.length} 篇文章 · ${active.reduce((n,a)=>n+words(a.markdown),0).toLocaleString()} 字</span></div><div class="writing-spark" aria-label="最近七天编辑文章字数">${days.map(d=>`<i style="height:${4+Math.round(d.count/max*25)}px" title="${new Date(d.from).toLocaleDateString('zh-CN')} · ${d.count.toLocaleString()} 字"></i>`).join('')}</div>`;
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
function toggleLibrary(){const panel=$('library');panel.hidden=!panel.hidden;syncCatalogLayout();}
let pinnedThemes:string[]=[];try{const raw=JSON.parse(readPreference('pinned-themes','[]'));if(Array.isArray(raw))pinnedThemes=[...new Set(raw.filter((id:unknown)=>typeof id==='string'&&themes.some(t=>t.id===id)))];}catch{}
const themePreviews=new Map<string,string>();
function themeThumbnail(id:string){
  if(themePreviews.has(id))return themePreviews.get(id)!;
  const t=themeById(id),node=document.createElement('div');node.className='theme-sample theme-sample-'+id;
  node.innerHTML=`<h2>${t.group==='文学'?'在平凡里，收集微光':'从一个好问题开始'}</h2><h3>${t.group==='文学'?'把日子，写成一页诗':'观察 · 探索 · 发现'}</h3><blockquote><p>${t.group==='文学'?'让文字留下温柔的回声。':'真正的发现，始于认真观察。'}</p></blockquote><p>让<strong>值得记住的句子</strong>拥有自己的光。</p>`;
  if(id==='classical')node.innerHTML='<h1>陋室铭</h1><h2>原文选读</h2><p>山不在高，有仙则名。水不在深，有龙则灵。<strong>斯是陋室，惟吾德馨。</strong>苔痕上阶绿，草色入帘青。</p><blockquote><p>铭，古代刻在器物上用来警戒自己或者称述功德的文字。</p></blockquote><h2>读一读，想一想</h2><p>谈笑有鸿儒，往来无白丁。</p>';
  if(t.variant==='journal')node.innerHTML=renderMarkdown('## 从一个好问题开始\n:::subtitle SCIENCE & IDEAS\n\n:::theorem 核心定律 · 理解世界\n用清晰的概念，建立**可检验的联系**。\n:::\n\n> 从一次认真观察出发。',new Map()).html;
  if(isFolio(t))node.innerHTML=renderMarkdown('## 江南雨声里的旧宣纸\n:::subtitle PROSE · 散文随笔卷\n\n:::folio-preface 卷首题记\n古人把一扇窗，借给了一座山。\n:::',new Map()).html;
  const edition=t.baseId||t.id;
  if(editionSamples[edition])node.innerHTML=renderMarkdown(editionSamples[edition].split(':::'+edition+(edition==='digest'?'-note':edition==='press'?'-byline':'-preface'))[0],new Map()).html;
  decorateTheme(node,t);
  const html=`<style>${themeCSS(t).replaceAll('.article','.theme-sample-'+id)}</style><div class="theme-live-window">${node.outerHTML}</div>`;
  themePreviews.set(id,html);return html;
}
function applyArticleTheme(id:string){clearThemePreview(false);snapshot(current,true);current.theme=id;current.typography={};markDirty();render();if(!$('style-panel').hidden)renderStylePanel();closeModal();toast('已切换为「'+themeById(id).name+'」');}
function themeHost(){return {open:openModal,close:closeModal,notify:toast,current:()=>current.theme,apply:applyArticleTheme,changed:()=>{themePreviews.clear();themeSidebar?.refresh();render();if(!$('style-panel').hidden)renderStylePanel();}};}
function showThemes(filter='全部'){
  let selectedDetail='';
  openModal('为文字，挑一件合适的衣裳',`<div class="theme-gallery-intro"><p class="modal-subtitle">点缩略图查看完整排版，点「使用」应用。应用时恢复主题默认设置。</p><input id="theme-search" class="field" placeholder="搜索名称、颜色、装饰…" aria-label="搜索主题"></div><div class="theme-tabs">${['全部','已置顶','自定义','装饰精选','科普','文学','通用'].map(g=>`<button data-group="${g}" class="${g===filter?'active':''}">${g==='已置顶'?'收藏':g}${g==='全部'?' · '+visibleThemes().length:''}</button>`).join('')}</div><div class="theme-pin-summary"><span id="theme-pin-count"></span><span id="theme-result-count"></span></div><div class="theme-browser"><div id="theme-results" class="theme-grid"></div><aside id="theme-detail" hidden aria-label="完整主题预览"></aside></div><div class="theme-gallery-footer"><p class="theme-gallery-foot">☆ 收藏不限数量 · 在侧栏「收藏」中拖动排序</p><div><button id="theme-import-button" class="button outline">导入主题</button><button id="theme-manage-button" class="button outline">完整主题库 / 管理</button></div></div>`,'THE THEME COLLECTION / '+themes.length);
  const applyTheme=applyArticleTheme;
  bind('theme-import-button',()=>chooseThemeFile(themeHost()));bind('theme-manage-button',()=>showThemeManager(themeHost()));
  const showDetail=(id:string,keyboard=false)=>{
    selectedDetail=id;
    const t=themeById(id),sample=document.createElement('article');sample.className='theme-detail-article';
    const sampleText=t.group==='文学'?'# 在平凡里，收集微光\n\n## 写在日常的页边\n\n风从窗边经过，留下一页值得珍藏的文字。\n\n### 片刻的停留\n\n> 让文字留下温柔的回声。\n\n:::poem center\n光落在纸上\n也落在**未说完的故事**里\n\n愿你记得\n每一次出发\n:::\n\n## 留住那些瞬间\n\n- 一段散步的时光\n- 一封写给自己的信': '# 一束光，读懂宇宙\n\n## 从一个好问题开始\n\n科学始于好奇，也来自一次次**认真观察**。好的排版让推理更清晰。\n\n### 观察与证据\n\n> 我们用可重复的观察，检验关于世界的猜想。\n\n## 把现象写成规律\n\n$$E=mc^2$$\n\n| 观测对象 | 特征 |\n| --- | --- |\n| 光 | 传播与能量 |\n| 物质 | 质量与运动 |\n\n- 提出可检验的问题\n- 记录证据，比较结果\n\n---\n\n继续探索，让知识成为自己的理解。';
    sample.innerHTML=renderMarkdown(editionSamples[t.baseId||t.id]||(isFolio(t)?folioSample:t.variant==='journal'?journalPreviewSample:sampleText),new Map((editionSamples[t.baseId||t.id]?editionAssets():isFolio(t)?folioAssets():[]).map(a=>[a.id,a]))).html;decorateTheme(sample,t);
    const detail=$('theme-detail');detail.hidden=false;detail.innerHTML=`<header><div><strong>${esc(t.name)}</strong><small>${esc(t.description)}</small></div><button id="theme-detail-close" aria-label="关闭完整预览">×</button></header><div id="theme-detail-scroll" class="theme-detail-scroll" tabindex="0" aria-label="主题完整排版示例"><style>${themeCSS(t).replaceAll('.article','.theme-detail-article')}</style>${sample.outerHTML}</div><footer><span>375px 手机阅读效果</span><button id="theme-detail-apply" class="button primary">使用此主题</button></footer>`;
    document.querySelector('.theme-browser')!.classList.add('has-detail');
    $('theme-results').querySelectorAll<HTMLElement>('[data-theme-preview]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themePreview===id)));
    bind('theme-detail-close',()=>{selectedDetail='';detail.hidden=true;detail.replaceChildren();document.querySelector('.theme-browser')!.classList.remove('has-detail');$('theme-results').querySelectorAll('[data-theme-preview]').forEach(b=>b.setAttribute('aria-pressed','false'));($('theme-results').querySelector<HTMLElement>(`[data-theme-preview="${id}"]`)||$('theme-search')).focus();});
    bind('theme-detail-apply',()=>applyTheme(id));
    if(keyboard)$('theme-detail-close').focus({preventScroll:true});
  };
  const renderCards=()=>{
    themeGalleryResize.disconnect();
    const query=$<HTMLInputElement>('theme-search').value.trim().toLowerCase();
    const pinRank=(id:string)=>pinnedThemes.includes(id)?pinnedThemes.indexOf(id):Infinity;
    $('theme-pin-count').textContent=`已收藏 ${pinnedThemes.length} 套 · 按自定顺序优先显示`;
    const visible=visibleThemes().filter(t=>(filter==='全部'||(filter==='已置顶'?pinnedThemes.includes(t.id):filter==='自定义'?!!t.definition:filter==='装饰精选'?!['plain','minimal','academic','wild'].includes(t.id):t.group===filter))&&themeMatches(t,query,themeDesign(t).tags)).sort((a,b)=>pinRank(a.id)-pinRank(b.id));
    if(selectedDetail&&!visible.some(t=>t.id===selectedDetail)){selectedDetail='';$('theme-detail').hidden=true;$('theme-detail').replaceChildren();document.querySelector('.theme-browser')!.classList.remove('has-detail');}
    $('theme-result-count').textContent=`${visible.length} 个主题`;
    $('theme-results').innerHTML=visible.map(t=>`<div class="theme-card ${current.theme===t.id?'selected':''} ${pinnedThemes.includes(t.id)?'pinned':''}"><button class="theme-preview-button" data-theme-preview="${t.id}" aria-label="查看${esc(t.name)}完整预览" aria-pressed="${String(selectedDetail===t.id)}"><div class="theme-card-topline"><span>${t.group}</span><span>${current.theme===t.id?'使用中':'点击放大'}</span></div>${themeThumbnail(t.id)}</button><div class="theme-card-info"><strong title="${esc(t.description)}">${esc(t.name)}</strong><button class="theme-apply" data-theme="${t.id}" aria-label="使用${esc(t.name)}主题">使用</button><small>${esc(themeDesign(t).tags.join(' · '))}</small></div><button class="theme-pin ${pinnedThemes.includes(t.id)?'active':''}" data-pin="${t.id}" aria-label="${pinnedThemes.includes(t.id)?'取消收藏':'收藏'}${esc(t.name)}" aria-pressed="${pinnedThemes.includes(t.id)}" title="${pinnedThemes.includes(t.id)?'取消收藏':'收藏主题'}">${pinnedThemes.includes(t.id)?'★':'☆'}</button></div>`).join('')||'<div class="empty-state">没有匹配的主题。<p><button data-clear-theme-search>清空搜索</button> <button data-all-theme-groups>搜索全部分类</button></p></div>';
    $('theme-results').querySelectorAll<HTMLElement>('.theme-live-window').forEach(el=>themeGalleryResize.observe(el));
  };
  renderCards();bind('theme-search',renderCards,'input');
  $('theme-results').addEventListener('click',event=>{const target=event.target as HTMLElement;if(target.closest('[data-clear-theme-search]')){$<HTMLInputElement>('theme-search').value='';renderCards();$('theme-search').focus();}if(target.closest('[data-all-theme-groups]')){filter='全部';$('modal-body').querySelectorAll<HTMLElement>('[data-group]').forEach(b=>b.classList.toggle('active',b.dataset.group===filter));renderCards();$('theme-search').focus();}});
  $('modal-body').querySelectorAll<HTMLElement>('[data-group]').forEach(el=>el.onclick=()=>{filter=el.dataset.group!;$('modal-body').querySelectorAll<HTMLElement>('[data-group]').forEach(b=>b.classList.toggle('active',b===el));renderCards();});
  $('theme-results').addEventListener('click',event=>{
    const pin=(event.target as HTMLElement).closest<HTMLElement>('[data-pin]');if(pin){
      const id=pin.dataset.pin!;if(pinnedThemes.includes(id))pinnedThemes=pinnedThemes.filter(v=>v!==id);else pinnedThemes.push(id);
      preference('pinned-themes',JSON.stringify(pinnedThemes));themeSidebar?.refresh();renderCards();($('theme-results').querySelector<HTMLElement>('[data-pin="'+id+'"]')||$('theme-search')).focus();return;
    }
    const preview=(event.target as HTMLElement).closest<HTMLElement>('[data-theme-preview]');if(preview){showDetail(preview.dataset.themePreview!,(event as MouseEvent).detail===0);return;}
    const el=(event.target as HTMLElement).closest<HTMLElement>('[data-theme]');if(el)applyTheme(el.dataset.theme!);
  });
}

function renderStylePanel(){
  const t=themeById(current.theme),o={...themeDefaults(t),...current.typography};
  const options=(value:string)=>Object.entries(fontNames).map(([key,name])=>`<option value="${key}" ${key===value?'selected':''}>${name}</option>`).join('');
  $('style-panel').innerHTML=`<div class="panel-title"><div><span class="eyebrow">TYPOGRAPHY</span><h2>排版设置</h2></div><button id="style-close" class="icon-button" aria-label="关闭排版设置">×</button></div><p class="help">${esc(t.name)} · 设置随当前文章保存</p><label>正文字体</label><select id="setting-font">${options(o.font||t.font)}</select><label>标题字体</label><select id="setting-headingFont">${options(o.headingFont||t.headingFont||o.font||t.font)}</select>${[['size','正文字号',12,24,.5,o.size??16,'px'],['lineHeight','行高',1.3,2.8,.05,o.lineHeight,''],['paragraphGap','段落间距',0,40,.5,o.paragraphGap??20,'px'],['padding','正文边距',12,48,1,o.padding??24,'px']].map(([key,label,min,max,step,value,unit])=>`<label>${label}<output id="value-${key}">${value}${unit}</output></label><div class="numeric-setting"><input id="setting-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}滑块"><input id="number-${key}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}数值"></div>`).join('')}<label>强调色</label><input id="setting-accent" type="color" value="${o.accent||t.accent}"><label class="switch-row">段首自动空两格<input id="setting-indent" type="checkbox" ${(o.indent??t.id==='classical')?'checked':''}></label><button id="reset-style" class="button outline full">恢复主题默认设置</button><p class="help">字体按设备可用字体自动回退，公众号读者看到的字形可能有所不同。</p>`;
  bind('style-close',()=>{$('style-panel').hidden=true;$('style-button').focus();});
  $('reset-style').insertAdjacentHTML('afterend','<button id="manage-theme-library" class="button outline full">完整主题库 / 导入与恢复</button>');bind('manage-theme-library',()=>showThemeManager(themeHost()));
  $('reset-style').insertAdjacentHTML('beforebegin',`<label class="switch-row">外部链接转文末参考<input id="setting-references" type="checkbox" ${referencesEnabled()?'checked':''}></label><p class="help">关闭时保留直接超链接（默认）。选择随当前文章保存；知乎模式始终保留超链接。</p>`);
  bind('setting-references',()=>setLinkMode($<HTMLInputElement>('setting-references').checked?'end':'direct'),'change');
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
function applySelectedTextStyle(plan:ReturnType<typeof selectedTextRuns>,patch:InlineStyle){
  if(plan.source!==editor.view.state.doc.toString()){toast('选区内容已经变化，请重新选择文字。');return false;}
  if(plan.error){toast(plan.error);return false;}
  if(!plan.selected.length){toast('选区内没有可设置样式的正文文字；代码和公式请分别选择。');return false;}
  if(patch.size!==undefined&&(!Number.isFinite(patch.size)||patch.size<10||patch.size>64||Math.round(patch.size*10)!==patch.size*10)){toast('选区字号范围是 10–64 px，最多一位小数。');return false;}
  const changes=textStyleChanges(plan,patch);closePopover();if(changes.length)editor.formatTextRanges(changes);else editor.view.focus();return true;
}
function showInlineStyle(event?:Event){
  const selection=editor.view.state.selection.main,selected=editor.view.state.sliceDoc(selection.from,selection.to);
  if(!selected){toast('先在 Markdown 栏选中需要设置样式的文字。');return;}
  const math=selectedMath(editor);
  const target=(event?.currentTarget as HTMLElement)||$('inline-style-button'),kind=(target.dataset.inlineMenu||'font') as InlineMenu;
  if(math){
    if(math.error){toast(math.error);return;}
    if(!['color','size','highlight','effect'].includes(kind)){toast('公式支持字色、字号、荧光、加粗、斜体、下划线和删除线；字体、文体和半高荧光用于普通文字。');return;}
    showInlineMenu(target,kind,math.style,()=>{},style=>{
      if(style.size!==undefined&&(!Number.isFinite(style.size)||style.size<10||style.size>64||Math.round(style.size*10)!==style.size*10)){toast('选区字号范围是 10–64 px，最多一位小数。');return false;}
      if(!applyMathStyle(editor,math,style,toast,(tex,display)=>renderMath(tex,display).error))return false;
      closePopover();return true;
    },true);return;
  }
  if(selected.includes('\n')){
    const plan=selectedTextRuns(editor.view.state.doc.toString(),selection.from,selection.to);
    if(plan.error){toast(plan.error);return;}
    if(!plan.selected.length){toast('选区内没有可设置样式的正文文字；代码和公式请分别选择。');return;}
    showInlineMenu(target,kind,plan.common,(root,markdown)=>{
      root.innerHTML=renderMarkdown(markdown,assets).html;if(publisher==='wechat')decorateTheme(root,themeById(current.theme));
    },(style,change)=>{
      let patch:InlineStyle;
      if(change?.clear)patch=Object.fromEntries(selectionStyleKeys.map(key=>[key,undefined]));
      else if(kind==='effect'){
        const key=change!.effect!;patch={[key]:style[key]};if(key==='gold'&&style.gold)Object.assign(patch,{marker:undefined,markerColor:undefined});
      }else if(kind==='marker')patch={marker:style.marker,markerColor:style.markerColor,...(style.marker?{gold:undefined}:{})};
      else patch={[kind]:style[kind]};
      return applySelectedTextStyle(plan,patch);
    });return;
  }
  const before=editor.view.state.doc.toString();
  const suffix=before.slice(selection.to).match(/^\]\{([^}]+)\}/);
  const existing=before[selection.from-1]==='['&&suffix?parseInlineStyle(suffix[1]):null;
  showInlineMenu(target,kind,existing,(root,markdown)=>{
    root.innerHTML=renderMarkdown(markdown,assets).html;
    if(publisher==='wechat')decorateTheme(root,themeById(current.theme));
  },style=>{
    if(before!==editor.view.state.doc.toString()){toast('选区内容已经变化，请重新选择文字。',true);return false;}
    if(style.size!==undefined&&(!Number.isFinite(style.size)||style.size<10||style.size>64||Math.round(style.size*10)!==style.size*10)){toast('选区字号范围是 10–64 px，最多一位小数。');return false;}
    const attrs=styleAttributes(style);
    const from=existing?selection.from-1:selection.from,to=existing?selection.to+suffix![0].length:selection.to;
    const insert=attrs?`[${selected}]{${attrs}}`:selected,anchor=from+(attrs?1:0);closePopover();
    if(insert!==before.slice(from,to))editor.formatSelection(selection.from,selection.to,from,to,attrs);
    else editor.view.dispatch({selection:{anchor,head:anchor+selected.length}});
    editor.view.focus();return true;
  });
}
async function addImages(files:File[],position:number){
  if(!files.length)return;
  const target=current;const baseMarkdown=target.markdown;toast('正在读取图片…');
  const imported:Asset[]=[];for(const file of files)imported.push(await fileToAsset(file));
  for(const asset of imported){assets.set(asset.id,asset);trackAsset(asset.id);}
  const imagesSaved=await stageAssets(imported);
  const group=imported.length>1?uid():'';
  const images=imported.map(a=>`![${a.name.replace(/[\[\]\\\r\n]/g,'')}](asset:${a.id})`).join(group?'\n':'\n\n');
  const text='\n\n'+(group?`:::gallery grid2 ${group}\n${images}\n:::`:images)+'\n\n';
  // If typing continued while files were decoded, insert at the current caret instead of a stale offset.
  if(current.id===target.id){editor.insert(text,target.markdown===baseMarkdown?position:editor.view.state.selection.main.head);}
  else {target.markdown+=text;markDirty(target);}
  render();if(imagesSaved)toast(`已插入 ${imported.length} 张图片，随文章一起备份`);
  if(group&&current.id===target.id)showImageLayouts(group,$('image-layout-button'));
}
async function stageAssets(imported:Asset[]){
  const edits=new Map(imported.map(a=>[a.id,assetEdits.get(a.id)]));
  try{await persist([],imported.map(a=>structuredClone(a)));for(const [id,edit] of edits)if(assetEdits.get(id)===edit)dirtyAssets.delete(id);return true;}
  catch{toast('图片已保留在当前页面，但原图尚未保存到浏览器。请保留页面并导出备份。',true);return false;}
}
function changeAssetAppearance(id:string,patch:Partial<ReturnType<typeof appearance>>){
  const asset=assets.get(id);if(!asset)return;
  current.assetSettings={...current.assetSettings,[id]:{...appearance(asset),...patch}};markDirty();render();
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
  let captured=false;
  const update=(size:number,side:string)=>{if(current.id!==owner||(themeById(current.theme).baseId||current.theme)!=='magazine'){closePopover();return;}if(!captured){snapshot(current,true);captured=true;}asset.width=Math.max(20,Math.min(55,size));asset.align=side==='right'?'right':'left';changeAssetAppearance(asset.id,{width:asset.width,align:asset.align});};
  panel.querySelectorAll<HTMLElement>('[data-magazine-side]').forEach(button=>button.onclick=()=>{update(Number($<HTMLInputElement>('magazine-image-number').value)||width,button.dataset.magazineSide!);panel.querySelectorAll('[data-magazine-side]').forEach(el=>el.classList.toggle('active',(el as HTMLElement).dataset.magazineSide===asset.align));});
  for(const id of ['magazine-image-range','magazine-image-number'])bind(id,()=>{const input=$<HTMLInputElement>(id);if(!input.value||!Number.isFinite(input.valueAsNumber))return;update(input.valueAsNumber,asset.align);for(const other of ['magazine-image-range','magazine-image-number'])if(other!==id)$<HTMLInputElement>(other).value=String(asset.width);},'input');
}
function showLinkMenu(anchor:HTMLElement){
  const owner=current,selection=editor.view.state.selection.main,before=current.markdown,selected=editor.view.state.sliceDoc(selection.from,selection.to);
  const panel=openPopover(anchor,'插入链接',`<div class="inline-style-form"><label>显示文字<input id="link-label" class="field" value="${esc(selected)}" placeholder="如：阅读原文"></label><label>链接地址<input id="link-url" type="url" class="field" placeholder="https://…"></label></div>${publisher==='wechat'?`<p class="help" style="margin-top:16px">这篇文章的外部链接</p><div class="quick-choices" id="link-mode-choices"><button data-link-mode="direct" aria-pressed="${!referencesEnabled()}" class="${!referencesEnabled()?'active':''}">直接超链接 · 默认</button><button data-link-mode="end" aria-pressed="${referencesEnabled()}" class="${referencesEnabled()?'active':''}">汇总为文末参考</button></div><p class="help" style="margin-top:10px">预览、公众号复制、主题导出按此选择处理；Markdown 保留原链接。设置随文章保存。</p>`:'<p class="help" style="margin-top:12px">知乎模式保留普通超链接。</p>'}<div class="quick-actions"><button id="link-cancel" class="button outline">取消</button><button id="link-insert" class="button primary">插入链接</button></div>`);
  panel.querySelectorAll<HTMLElement>('[data-link-mode]').forEach(button=>button.onclick=()=>{
    if(current!==owner){closePopover();return;}setLinkMode(button.dataset.linkMode as 'direct'|'end');
    panel.querySelectorAll<HTMLElement>('[data-link-mode]').forEach(el=>{const active=(el.dataset.linkMode==='end')===referencesEnabled();el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
  });
  bind('link-cancel',closePopover);bind('link-insert',()=>{
    if(current!==owner||current.markdown!==before){toast('正文已经变化，请重新选择要插入链接的位置。',true);return;}
    const raw=$<HTMLInputElement>('link-url').value.trim(),label=$<HTMLInputElement>('link-label').value.trim()||raw;
    if(!/^(?:https?:\/\/|mailto:|tel:|#)/i.test(raw)||/[\u0000-\u0020<>]/.test(raw)){toast('请输入完整的 http(s) 地址、邮件地址或文内锚点。',true);return;}
    const url=raw.replace(/[()\\]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
    // Keep the source markup of an unchanged selection (bold, color, math,
    // etc.); only newly entered label text needs literal bracket escaping.
    const text=selected&&label===selected?selected:label.replace(/[\\\[\]\r\n]/g,c=>c==='\r'||c==='\n'?' ':'\\'+c);
    closePopover();editor.replaceText(selection.from,selection.to,`[${text}](${url})`);editor.view.focus();
  });
  (selected?$('link-url'):$('link-label')).focus();
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
function showSamples(){
  openModal('从一个小小的示例开始','<p class="modal-subtitle">示例将作为新文章打开，保留你正在编辑的草稿。</p><div class="option-list"><button class="option-card" data-sample="science"><strong>01 / 一束光，如何告诉我们宇宙的故事？</strong><small>科普文章 · 公式 · 表格 · 脚注</small></button><button class="option-card" data-sample="math"><strong>02 / 在符号之间，理解变化</strong><small>数学公式 · 矩阵 · 多行推导 · 编号</small></button><button class="option-card" data-sample="poetry"><strong>03 / 风经过的地方</strong><small>诗歌 · 散文 · 保留诗行与空行</small></button><button class="option-card" data-sample="journal-indigo"><strong>04 / 深空靛蓝 · 信息与热的期刊长读</strong><small>导读首字下沉 · 双语章节 · 定律 / 公式释义 / 推导 · 科学插图</small></button><button class="option-card" data-sample="journal-jade"><strong>05 / 松石青翠 · 同一篇文章，另一种气质</strong><small>松石绿配色 · 多字体层次 · 三线表 · 要点与参考文献</small></button></div>');
  $('modal-body').querySelector('.option-list')!.insertAdjacentHTML('beforeend','<button class="option-card" data-sample="folio"><strong>06 / 山窗听雪 · 一纸山水清欢</strong><small>古籍题记 · 三种正文气质 · 横排诗笺 / 阶梯新诗 · 朱批笺注 · 水墨装裱</small></button>');
  $('modal-body').querySelector('.option-list')!.insertAdjacentHTML('beforeend',Object.entries(editionSamples).map(([id])=>`<button class="option-card" data-sample="${id}"><strong>${editionTitles[id as Edition]}</strong><small>完整组件示例 · 可改文字、数据、插图与来源</small></button>`).join(''));
  $('modal-body').querySelectorAll<HTMLButtonElement>('[data-sample]').forEach(el=>el.onclick=async()=>{
    try{
      if(el.dataset.sample&&editionSamples[el.dataset.sample]){const id=el.dataset.sample;el.disabled=true;const incoming=editionAssets().filter(a=>editionSamples[id].includes('asset:'+a.id)&&!assetStore.has(a.id));for(const a of incoming){assetStore.set(a.id,a);trackAsset(a.id);}if(incoming.length)await stageAssets(incoming);if(!el.isConnected)return;closeModal();addArticle(editionTitles[id as Edition],editionSamples[id],id);return;}
      if(el.dataset.sample==='folio'){el.disabled=true;const incoming=folioAssets().filter(a=>!assetStore.has(a.id));for(const a of incoming){assetStore.set(a.id,a);trackAsset(a.id);}if(incoming.length)await stageAssets(incoming);if(!el.isConnected)return;closeModal();addArticle('山窗听雪录',folioSample,'folio');return;}
      if(el.dataset.sample?.startsWith('journal-')){el.disabled=true;const asset=journalFigure();assetStore.set(asset.id,asset);trackAsset(asset.id);await stageAssets([asset]);if(!el.isConnected)return;closeModal();addArticle('信息为什么也有物理的重量',journalSample.replace('JOURNAL_FIGURE','asset:'+asset.id),el.dataset.sample);return;}
      closeModal();if(el.dataset.sample==='math')addArticle('在符号之间，理解变化',equations,'math');else if(el.dataset.sample==='poetry')addArticle('风经过的地方',poetry,'moon');else addArticle('一束光，如何告诉我们宇宙的故事？',science);
    }catch(e){el.disabled=false;toast(errorMessage(e),true);}
  });
}
function showFolioElements(anchor:HTMLElement){
  const descriptions:Record<FolioKind,string>={masthead:'卷期、岁次与节气物候',byline:'作者、图像与校勘署名',preface:'四角回纹与文心小印',prose:'下沉首字与起首章',ci:'词牌、小序、居中诗行',scroll:'旧稿兼容的横排诗词',classical:'文言正文与行间朱批',gloss:'可收起的字词考据',modern:'阶梯缩进与行号标尺',letter:'楷体尺牍与落款',hanging:'单幅水墨与题画诗',handscroll:'横向长卷与分段题跋',album:'双联图片册页',colophon:'木记牌记与藏书票'};
  const panel=openPopover(anchor,'古籍文学元素',`<p class="help">点击插入可编辑的 Markdown。展卷、眉批与抽屉保留在预览，复制 / 导出时使用完整横排兼容内容。</p><div class="journal-insert-choices">${Object.entries(folioNames).filter(([kind])=>kind!=='scroll').map(([kind,name])=>`<button data-folio-block="${kind}"><strong>${name||({byline:'署名栏',prose:'散文精排'} as Record<string,string>)[kind]}</strong><small>${descriptions[kind as FolioKind]}</small></button>`).join('')}</div><p class="help" style="margin-top:16px">作用于当前选区 · 未选文字时插入示例文字</p><div class="quick-choices">${Object.entries(literaryRoles).map(([role,name])=>`<button data-folio-role="${role}">${name}</button>`).join('')}<button data-folio-inline="dots">字下着重号</button><button data-folio-inline="gold">泥金金句</button></div>`);
  panel.querySelectorAll<HTMLElement>('[data-folio-block]').forEach(button=>button.onclick=()=>{
    const kind=button.dataset.folioBlock as FolioKind,s=editor.view.state.selection.main,selected=editor.view.state.sliceDoc(s.from,s.to);
    const bodies:Partial<Record<FolioKind,string>>={masthead:'岁次 / 季节 · 节气 · 物候',byline:'撰文 / 作者 · 图像 / 来源',ci:'[这里写下词前小序。]{role=preface}\n\n:::poem center\n第一行诗\n第二行诗\n:::',scroll:':::poem left\n第一行诗\n第二行诗\n:::',modern:':::poem left\n把一句话，轻轻放下\n    让下一行留一点空白\n      再向前一步\n:::',classical:'这里写下文言原文。[朱批：这里写下评点。]{role=note}',hanging:'在这里粘贴一张插图，再在素材面板填写图注。\n\n[这里写下题画诗。]{role=painting}',handscroll:'在这里粘贴横向长卷。\n\n> **第一景**\n> 这里写下题跋。\n\n> **第二景**\n> 这里写下题跋。',album:'在这里一次粘贴两张图片，选择「双列」排版。',colophon:'撰文 / 作者 · 图像 / 来源 · 校勘 / 编辑\n\n这里写下本辑信息与出处。'};
    const content=selected&&['ci','modern'].includes(kind)&&!/^:::poem/m.test(selected)?':::poem '+(kind==='ci'?'center':'left')+'\n'+selected+'\n:::':selected;closePopover();editor.insert('\n\n:::folio-'+kind+'\n'+(content||bodies[kind]||'这里写下正文，可包含加粗、脚注、公式和图片。')+'\n:::\n\n');
  });
  panel.querySelectorAll<HTMLElement>('[data-folio-role],[data-folio-inline]').forEach(button=>button.onclick=()=>{const attrs=button.dataset.folioRole?'role='+button.dataset.folioRole:button.dataset.folioInline!;closePopover();editor.wrap('[',']{'+attrs+'}');});
  enhanceComponentPreviews(panel,'folio-block',folioSample,()=>showFolioElements(anchor));
}
function showFolioFonts(anchor:HTMLElement){
  const fonts=[['noto-serif','书卷宋体','人文衬线，温厚的书卷气'],['wenkai','温润楷体','楷体回退，手书般的叙事'],['noto-sans','现代人文黑','无衬线，更利落的长文阅读']];
  const panel=openPopover(anchor,'散文正文的三种气质',`<div class="journal-insert-choices folio-font-choices">${fonts.map(([id,name,description])=>`<button data-folio-font="${id}" class="${(current.typography.font||themeById(current.theme).font)===id?'active':''}"><strong>${name}</strong><small>${description}</small></button>`).join('')}</div><p class="help" style="margin-top:12px">只更改当前文章的正文字体；诗词、夹批与题画继续使用各自文体字体。本机缺少字体时自动回退。</p>`);
  panel.querySelectorAll<HTMLElement>('[data-folio-font]').forEach(button=>button.onclick=()=>{snapshot(current,true);current.typography.font=button.dataset.folioFont;markDirty();closePopover();render();if(!$('style-panel').hidden)renderStylePanel();});
}
function showJournalBlocks(anchor:HTMLElement){
  const examples=[
    ['abstract','科学导读','导读首字下沉与核心追问',':::abstract\n从一个读者熟悉的问题开始，写下文章导读。\n\n- **▸ 核心追问：**这里写下要回答的问题。\n:::'],
    ['theorem','核心定律','衬线标题与点阵坐标纸',':::theorem 核心定律 · 定律名称\n这里写下核心结论与适用条件，可包含 $E=mc^2$。\n:::'],
    ['equation','公式释义卡','按章节编号与符号释义栏',':::equation\n$$\nE=mc^2\n$$\n\n**符号释义：**$E$ 表示能量，$m$ 表示质量，$c$ 表示光速。\n:::'],
    ['derivation','推导专栏','预览可收起，发布时完整展开',':::derivation 数学物理推导专栏\n**第一步：**说明过程与假设。\n\n$$\n\\begin{aligned}E&=mc^2\\\\m&=E/c^2\\end{aligned}\n$$\n\n**第二步：**解释推导结果。\n:::'],
    ['takeaways','核心要点','配套标题与编号列表',':::takeaways\n1. **第一点：**这里写下值得带走的结论。\n2. **第二点：**说明适用条件或边界。\n:::'],
    ['references','参考文献','清晰的文末资料列表',':::references\n[1] 作者，*资料名称*，年份。\n\n[2] 作者，*资料名称*，年份。\n:::'],
    ['subtitle','英文副标题','插在已有章节标题的下一行',':::subtitle THE ENGLISH SECTION TITLE']
  ];
  const panel=openPopover(anchor,'期刊排版元素',`<p class="help">深空靛蓝 / 松石青翠配套样式；其他主题也可使用。点击插入后在 Markdown 中改字。公式继续使用离线 SVG 渲染。</p><div class="journal-insert-choices">${examples.map(([id,name,description])=>`<button data-journal-block="${id}"><strong>${name}</strong><small>${description}</small></button>`).join('')}</div>`);
  panel.querySelectorAll<HTMLElement>('[data-journal-block]').forEach(button=>button.onclick=()=>{const sample=examples.find(e=>e[0]===button.dataset.journalBlock)!;closePopover();editor.insert('\n\n'+sample[3]+'\n\n');});
  enhanceComponentPreviews(panel,'journal-block',journalPreviewSample,()=>showJournalBlocks(anchor));
}

function enhanceComponentPreviews(panel:HTMLElement,attribute:string,source:string,back:()=>void){
 const theme=themeById(current.theme),resource=new Map([...assets,...folioAssets().map(a=>[a.id,a] as const),...editionAssets().map(a=>[a.id,a] as const)]),article=document.createElement('article');article.innerHTML=renderMarkdown(source,resource).html;decorateTheme(article,theme);
 const style=document.createElement('style');style.textContent=themeCSS(theme,current.typography).replaceAll('.article','.component-preview-article');panel.prepend(style);
 for(const button of panel.querySelectorAll<HTMLButtonElement>('[data-'+attribute+']')){
  const key=button.getAttribute('data-'+attribute)!,cls=attribute==='journal-block'?'journal-'+key:attribute==='folio-block'?'folio-'+key:key;
  const node=article.querySelector('.'+cls)||article.querySelector('.journal-subtitle');if(!node)continue;
  const wrapper=document.createElement('div');wrapper.className='component-choice';button.replaceWith(wrapper);
  const preview=document.createElement('button');preview.className='component-preview-button';preview.dataset.componentPreview=cls;preview.setAttribute('aria-label','预览'+button.textContent);
  preview.innerHTML='<span class="component-mini-window" aria-hidden="true"><article class="component-preview-article">'+node.outerHTML+'</article></span><small>放大预览 ↗</small>';wrapper.append(preview,button);
  preview.onclick=()=>{openModal('组件效果预览',`<p class="modal-subtitle">跟随当前文章的主题色与排版设置。这里展示示例内容，插入后可继续修改。</p><div class="component-full-scroll" tabindex="0"><style>${style.textContent}</style><article class="component-preview-article component-full-article">${node.outerHTML}</article></div><div class="component-preview-actions"><button id="component-back" class="button outline">返回选择</button><button id="component-insert" class="button primary">插入当前文章</button></div>`);bind('component-back',()=>{closeModal();back();document.querySelector<HTMLElement>('[data-component-preview="'+cls+'"]')?.focus();});bind('component-insert',()=>{closeModal();button.click();});};
 }
}
function showEditionElements(anchor:HTMLElement,group:Edition=(['digest','press','gewu'].includes(themeById(current.theme).baseId||current.theme)?(themeById(current.theme).baseId||current.theme):'digest') as Edition){
 const options=editionCatalog[group],panel=openPopover(anchor,'模板专属元素',`<div class="theme-tabs">${Object.entries(editionTitles).filter(([id])=>editionSamples[id]).map(([id,name])=>`<button data-edition-group="${id}" class="${group===id?'active':''}">${name}</button>`).join('')}</div><p class="help">先预览再插入；示例文字、数据、图片与署名可自行替换。</p><div class="journal-insert-choices">${Object.entries(options).map(([kind,title])=>`<button data-edition-block="${group+'-'+kind}"><strong>${title||({byline:'署名栏',deck:'文章导语',photo:'摄影框',polaroid:'拍立得',tags:'学科标签',figure:'插图框',caption:'表格图注',pullquote:'破版大引文'} as Record<string,string>)[kind]||kind}</strong><small>点击插入 · 可编辑 Markdown</small></button>`).join('')}</div>`);
 panel.querySelectorAll<HTMLElement>('[data-edition-group]').forEach(b=>b.onclick=()=>showEditionElements(anchor,b.dataset.editionGroup as Edition));
 const sample=editionSamples[group];
 panel.querySelectorAll<HTMLElement>('[data-edition-block]').forEach(b=>b.onclick=async()=>{const key=b.dataset.editionBlock!,text=editionComponentSource(sample,key),s=editor.view.state.selection.main,selected=editor.view.state.sliceDoc(s.from,s.to),before=editor.view.state.doc.toString(),articleId=current.id;const incoming=editionAssets().filter(a=>text.includes('asset:'+a.id)&&!assetStore.has(a.id));for(const a of incoming){assetStore.set(a.id,a);trackAsset(a.id);}if(incoming.length)await stageAssets(incoming);if(current.id!==articleId||before!==editor.view.state.doc.toString()){toast('文章已变化，请重新选择插入位置。',true);return;}closePopover();editor.insert('\n\n'+(selected?':::'+key+'\n'+selected+'\n:::':text)+'\n\n');});
 enhanceComponentPreviews(panel,'edition-block',sample,()=>showEditionElements(anchor,group));
}
function editionComponentSource(sample:string,key:string){
 const lines=sample.split('\n'),start=lines.findIndex(line=>line===':::'+key||line.startsWith(':::'+key+' '));if(start<0)return':::'+key+'\n这里写下正文。\n:::';let depth=0;
 for(let i=start;i<lines.length;i++){if(/^:::[a-z]/.test(lines[i]))depth++;else if(lines[i]===':::'&&!--depth)return lines.slice(start,i+1).join('\n');}
 return':::'+key+'\n这里写下正文。\n:::';
}


function exportBackup(all=false){if(snapshot(current,true))markDirty();const selected=all?[...articles.values()]:[current];const data=createBackup(selected,assetStore,all?folders:[],all);download(data as BlobPart,all?'非水·成章-文章库备份.zip':safeName(current.title)+'.非水·成章.zip','application/zip');$('last-export').textContent='已导出文件 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});toast(all?'文章库备份已下载（包含回收站）':'文章备份已下载，包含图片和排版设置');}
function checkIssues():string[]{
  return [...renderResult.errors.map(e=>`第 ${e.line} 行公式：${e.message}`),...renderResult.missing.map(p=>`图片缺失：${p}`),...renderResult.external.map(()=>`存在网络图片，离线阅读需先导入本地副本`),...($('preview').querySelector('img')?['本地图片粘贴后可能需要补插，请检查图片是否保留。']:[]),...(publisher==='wechat'&&current.stickers?.length?['贴纸可尝试保留轮廓，或改为普通左右环绕；自由叠放区域需要合成为图片。']:[])];
}
async function copyArticle(){
  clearThemePreview(false);
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
    closeModal();copyFeedback('已复制','success');toast(publisher==='zhihu'?'已复制标准富文本，可粘贴到知乎。请检查公式和图片。':'已复制排版内容。粘贴到公众号后请检查公式和图片。');
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
function showExport(){openModal('把文章，好好保存',`<p class="modal-subtitle">浏览器草稿方便继续写作，文件备份适合长期保存与换电脑恢复。</p>${exportOptionsHTML()}`,'SAVE & EXPORT');bind('export-backup',()=>{exportBackup();closeModal();});bind('export-html',exportHTML);bind('export-longimage',showLongImage);bind('export-pdf',showPDF);bind('export-word',exportWord);bind('export-md',()=>{if(assetRefs(current.markdown).length||current.stickers?.length)exportBackup();else{download(current.markdown,safeName(current.title)+'.md','text/markdown;charset=utf-8');toast('Markdown 已导出');}closeModal();});bind('export-all',()=>{exportBackup(true);closeModal();});}

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
  for(const a of incoming){articles.set(a.id,a);trackArticle(a.id);checkpoint(a);}
  for(const a of images){assets.set(a.id,a);trackAsset(a.id);}
  const first=incoming.find(a=>!a.deleted);if(first)switchArticle(first.id);else renderLibrary();
  await save();if(dirtyGeneration!==savedGeneration)toast(`已加入 ${incoming.length} 篇文章，但尚未全部保存到浏览器。请保留页面并导出文章库备份。`,true);else toast(`已导入 ${incoming.length} 篇文章，同名文章保留为独立副本`);
}
function showHistory(article:Article){
  const revisions=[...article.revisions].reverse();
  openModal('找回之前的文字',`<p class="modal-subtitle">${esc(article.title)} · 保留最近 20 个恢复点。连续输入按约 30 秒合并，切换文章和导出时另存恢复点。先查看变动，再决定是否恢复。</p>${revisions.length?revisions.map((r,i)=>`<div class="history-row"><div>${new Date(r.at).toLocaleString('zh-CN')}<small>${r.markdown.length} 字符 · ${themeById(r.theme).name}</small></div><div class="history-actions"><button data-compare-revision="${i}">对比 / 查看</button><button data-revision="${i}">恢复这个版本</button></div></div>`).join(''):'<div class="empty-state">继续写作后，这里将出现恢复版本。</div>'}`);
  $('modal-body').querySelectorAll<HTMLElement>('[data-revision]').forEach(el=>el.onclick=()=>restoreRevision(article,revisions[Number(el.dataset.revision)]));
  $('modal-body').querySelectorAll<HTMLElement>('[data-compare-revision]').forEach(el=>el.onclick=()=>showRevisionDiff(article,revisions[Number(el.dataset.compareRevision)]));
}
function restoreRevision(article:Article,source:Revision){
  const revision=structuredClone(source);snapshot(article,true);Object.assign(article,{title:revision.title,titleMode:revision.titleMode||'manual',markdown:revision.markdown,theme:revision.theme,typography:revision.typography,assets:revision.assets,stickers:revision.stickers||[],assetSettings:revision.assetSettings||{},linkMode:revision.linkMode});markDirty(article);switchArticle(article.id);closeModal();toast('已恢复版本，恢复前的内容也已保留');
}
function showRevisionDiff(article:Article,revision:Revision){
  const diff=compareText(revision.markdown,article.markdown),view=compactDiff(diff);
  const changes:string[]=[];
  if(revision.title!==article.title)changes.push('文章名称');
  if(revision.theme!==article.theme)changes.push(`主题：${themeById(revision.theme).name} → ${themeById(article.theme).name}`);
  if(JSON.stringify(revision.typography)!==JSON.stringify(article.typography))changes.push('字体 / 排版设置');
  if(JSON.stringify(captureAssets(revision,assetStore))!==JSON.stringify(captureAssets(article,assetStore)))changes.push('图片尺寸 / 图注');
  if(JSON.stringify(revision.stickers||[])!==JSON.stringify(article.stickers||[]))changes.push('贴纸布局');
  if((revision.linkMode||'direct')!==(article.linkMode||'direct'))changes.push('链接发布方式');
  openModal('看看这次改了什么',`<div class="revision-comparison"><div class="revision-labels"><span><small>恢复点</small>${new Date(revision.at).toLocaleString('zh-CN')}</span><span><small>对照稿</small>${esc(article.title)} · 当前内容</span></div><div class="revision-summary"><span class="diff-added">＋ ${diff.added} 行新增</span><span class="diff-removed">− ${diff.removed} 行移除</span><span>按 Markdown 源码行对比</span></div>${changes.length?`<p class="revision-settings">排版变动：${changes.map(esc).join('；')}</p>`:''}<div class="revision-diff" tabindex="0" aria-label="恢复点与当前文章的文字差异">${diff.tooLarge?'<p class="empty-state">行数较多，暂不展开逐行对比。可先导出当前稿，再恢复此版本。</p>':!diff.lines.length?'<p class="empty-state">两份稿件的正文一致。</p>':view.rows.map(row=>row.kind==='gap'?`<div class="diff-gap">··· 省略 ${row.count} 行相同内容 ···</div>`:`<div class="diff-line diff-${row.kind}"><span aria-label="恢复点行号">${row.oldLine??''}</span><span aria-label="当前稿行号">${row.newLine??''}</span><b aria-hidden="true">${row.kind==='added'?'+':row.kind==='removed'?'−':' '}</b><code>${esc(row.text)||' '}</code></div>`).join('')}${view.truncated?'<p class="help">已显示前 600 行变动，更多内容请在编辑区查看。</p>':''}</div><div class="revision-actions"><button id="revision-diff-back" class="button outline">返回恢复点</button><button id="revision-diff-restore" class="button primary">恢复此版本</button></div><p class="help">恢复时同时恢复主题、排版与图片设置，当前稿会先保存为一个恢复点。</p></div>`,'REVISION COMPARISON');
  bind('revision-diff-back',()=>showHistory(article));bind('revision-diff-restore',()=>restoreRevision(article,revision));
}
function showTOC(){const headings=[...$('preview').querySelectorAll<HTMLElement>('h1,h2,h3,h4')];openModal('文章目录',`<ul class="toc-list">${headings.map((h,i)=>`<li><button data-heading="${i}" style="padding-left:${10+(Number(h.tagName.slice(1))-1)*15}px">${esc(h.textContent||'')}</button></li>`).join('')}</ul>${headings.length?'':'<p class="empty-state">添加 Markdown 标题后，目录会自动生成。</p>'}`);$('modal-body').querySelectorAll<HTMLElement>('[data-heading]').forEach(el=>el.onclick=()=>{const h=headings[Number(el.dataset.heading)];closeModal();editor.goto(Number(h.dataset.line||0)+1);h.scrollIntoView({block:'start'});});}

function showWritingTools(anchor:HTMLElement){
  const panel=openPopover(anchor,'写作助手',`<label class="writing-assistant-toggle"><span><strong>公式命令补全</strong><small>输入 \\fr、\\b 等前缀选择公式与希腊字母</small></span><input id="latex-completion-toggle" type="checkbox" role="switch" ${editor.latexCompletionEnabled?'checked':''}></label><div class="writing-tool-list"><button id="writing-check"><strong>发布前检查</strong><small>找出待补标记、占位链接、标题与脚注问题</small></button><button id="writing-tidy"><strong>轻量整理</strong><small>预览整理空行与无意义行尾空格，支持撤销</small></button><button id="writing-history"><strong>版本对比 / 恢复</strong><small>先看改了什么，再找回之前的文字</small></button><button id="writing-checkpoint"><strong>留一个恢复点</strong><small>大幅修改前，手动记录此时的稿件与排版</small></button></div><p class="help" style="margin-top:16px">从写作骨架开始 · 在新文章中打开</p><div class="quick-choices">${writingOutlines.map((o,i)=>`<button data-writing-outline="${i}" title="${esc(o.description)}">${o.name}</button>`).join('')}</div>`);
  const completionToggle=$<HTMLInputElement>('latex-completion-toggle');completionToggle.onchange=()=>{editor.setLatexCompletion(completionToggle.checked);preference('latex-completion',String(completionToggle.checked));};
  bind('writing-check',()=>{closePopover();showWritingCheck();});bind('writing-tidy',()=>{closePopover();showWritingTidy();});bind('writing-history',()=>{closePopover();showHistory(current);});
  bind('writing-checkpoint',async()=>{closePopover();const added=snapshot(current,true);if(added)markDirty();const ok=await save();toast(ok?(added?'已保存此时的恢复点':'此时内容已有恢复点'):'恢复点尚未保存到浏览器，请保留页面并导出备份。',!ok);});
  panel.querySelectorAll<HTMLElement>('[data-writing-outline]').forEach(button=>button.onclick=()=>{const outline=writingOutlines[Number(button.dataset.writingOutline)];closePopover();addArticle(outline.name,outline.text,outline.theme);toast('已在新文章中打开写作骨架，原稿保留在文章库。');});
  const ai=document.createElement('button');ai.id='writing-rewrite';ai.innerHTML='<strong>DeepSeek 选区改写</strong><small>仅发送选区与少量上下文，先比较再应用</small>';panel.querySelector('.writing-tool-list')!.append(ai);ai.onclick=startRewrite;
}
function startRewrite(){const selection=editor.view.state.selection.main,article=current,before=editor.view.state.doc.toString();showRewrite({open:openModal,close:closeModal,notify:toast,unchanged:()=>current===article&&editor.view.state.doc.toString()===before,apply:text=>{snapshot(article,true);editor.replaceText(selection.from,selection.to,text);editor.view.focus();}},before,selection.from,selection.to);}
function showWritingCheck(){
  render();const article=current,issues=inspectWriting(article.markdown);
  for(const error of renderResult.errors)issues.push({line:error.line,title:'公式需要检查',detail:error.message});
  for(const id of renderResult.missing)issues.push({line:Math.max(1,article.markdown.slice(0,article.markdown.indexOf(id)).split('\n').length),title:'图片缺失',detail:'请重新插入本地图片或导入含原图的备份。'});
  openModal('发布前，读一遍这些地方',`<div class="writing-check"><p class="modal-subtitle">检查待补标记和常见格式问题；知识事实与资料可信度仍需要你审阅。代码、公式和诗歌中的留白不纳入整理。</p><div class="writing-check-summary"><strong>${issues.length?issues.length+' 处可检查':'没有发现常见格式问题'}</strong><button id="writing-check-refresh" class="text-button">重新检查</button></div>${issues.map((issue,i)=>`<button class="writing-issue" data-writing-issue="${i}"><span>第 ${issue.line} 行</span><div><strong>${esc(issue.title)}</strong><small>${esc(issue.detail)}</small></div><b aria-hidden="true">↗</b></button>`).join('')||'<p class="empty-state">再读一遍开头、结尾与图注，就可以准备复制或导出了。</p>'}<p class="help">点击任一项回到对应源码。当前显示最多 80 条文字检查结果。</p></div>`,'BEFORE PUBLISHING');
  bind('writing-check-refresh',showWritingCheck);$('modal-body').querySelectorAll<HTMLElement>('[data-writing-issue]').forEach(button=>button.onclick=()=>{if(current!==article){closeModal();return;}const issue=issues[Number(button.dataset.writingIssue)];closeModal();if(window.matchMedia('(max-width:760px)').matches)$('mobile-edit').click();editor.goto(issue.line);});
}
function showWritingTidy(){
  const article=current,before=article.markdown,result=tidyMarkdown(before),diff=compareText(before,result.text),view=compactDiff(diff);
  openModal('轻量整理 · 先看改动',`<div class="revision-comparison"><p class="modal-subtitle">整理普通段落之间过多的空行和单个行尾空格；保留 Markdown 双空格换行，以及代码、公式、诗歌与组图块。</p><p class="revision-settings">${result.singleSpaces} 处单个行尾空格 · ${result.extraBlankLines} 行多余空行${result.newlines?' · 统一换行符':''}</p><div class="revision-diff" tabindex="0" aria-label="文字整理前后对比">${view.rows.map(row=>row.kind==='gap'?`<div class="diff-gap">··· ${row.count} 行相同内容 ···</div>`:`<div class="diff-line diff-${row.kind}"><span>${row.oldLine??''}</span><span>${row.newLine??''}</span><b>${row.kind==='added'?'+':row.kind==='removed'?'−':' '}</b><code>${esc(row.text)||' '}</code></div>`).join('')||`<p class="empty-state">${diff.tooLarge?'行数较多，暂不提供批量整理。':'没有需要整理的内容。'}</p>`}${view.truncated?'<p class="help">已显示前 600 行变动。</p>':''}</div><div class="revision-actions"><button id="writing-tidy-cancel" class="button outline">取消</button><button id="writing-tidy-apply" class="button primary" ${before===result.text||diff.tooLarge?'disabled':''}>应用整理</button></div><p class="help">应用前保留恢复点，应用后可按 Ctrl + Z 撤销。</p></div>`,'GENTLE CLEANUP');
  bind('writing-tidy-cancel',closeModal);bind('writing-tidy-apply',()=>{if(current!==article||article.markdown!==before){toast('正文已经变化，请关闭窗口并重新整理。',true);return;}snapshot(article,true);const head=editor.view.state.selection.main.head;closeModal();editor.view.dispatch({changes:{from:0,to:before.length,insert:result.text},selection:{anchor:Math.min(head,result.text.length)},userEvent:'input.tidy'});editor.view.focus();toast('已整理，可撤销或从恢复点找回。');});
}

function showAssets(){
  render();const nodes=[...$('preview').querySelectorAll<HTMLElement>('.image-wrap,.math-inline,.math-display,.sticker-item')].sort((a,b)=>Number(a.dataset.stickerLine??a.dataset.line??a.closest<HTMLElement>('[data-line]')?.dataset.line??0)-Number(b.dataset.stickerLine??b.dataset.line??b.closest<HTMLElement>('[data-line]')?.dataset.line??0));
  openModal('文章里的图与公式',`<p class="modal-subtitle">按正文顺序排列。可下载原图、公式 SVG 或高清 PNG，在公众号中补插。</p>${renderResult.missing.length?`<div class="notice">${renderResult.missing.length} 张图片缺失。请关闭此面板，用「图片」重新插入本地文件并删除旧引用。</div>`:''}${nodes.map((node,i)=>{
    if(node.classList.contains('image-wrap')||node.classList.contains('sticker-item')){const a=assets.get(node.dataset.asset||'');return `<div class="asset-card"><div class="asset-number">${String(i+1).padStart(2,'0')} / IMAGE</div><div class="asset-card-top"><img class="asset-thumb" src="${esc(node.querySelector('img')?.src||'')}" alt="图片缩略图">${a?`<div class="asset-fields"><label>宽度（%）<input data-asset-field="width" data-asset-id="${a.id}" type="number" min="10" max="100" value="${a.width}"></label><label>对齐<select data-asset-field="align" data-asset-id="${a.id}">${[['left','居左'],['center','居中'],['right','居右']].map(([v,n])=>`<option value="${v}" ${v===a.align?'selected':''}>${n}</option>`).join('')}</select></label><label class="asset-caption">图注<input data-asset-field="caption" data-asset-id="${a.id}" value="${esc(a.caption)}"></label><label class="asset-caption">替代文字<input data-asset-field="alt" data-asset-id="${a.id}" value="${esc(a.alt)}"></label></div>`:'<div class="notice">网络图片尚未随文章备份。可尝试导入本地副本。</div>'}</div><div class="asset-actions">${a?`<button data-download-asset="${a.id}">下载原图</button><button data-compress-asset="${a.id}">生成压缩副本</button>`:`<button data-localize="${i}">导入本地副本</button>`}</div></div>`;}
    return `<div class="asset-card"><div class="asset-number">${String(i+1).padStart(2,'0')} / FORMULA</div><div class="asset-formula">${node.innerHTML}</div><div class="asset-actions"><button data-svg="${i}">下载 SVG</button><button data-png="${i}">下载高清 PNG</button></div></div>`;
  }).join('')||'<div class="empty-state">还没有图片或公式。试试在编辑区直接粘贴一张截图。</div>'}`,'ARTICLE ASSETS');
  if(publisher==='wechat'&&current.stickers?.length){const notice=document.createElement('div');notice.className='notice';notice.innerHTML=`文中有 ${current.stickers.length} 张贴纸。选中贴纸可切换左右轮廓环绕，也可合成局部图片。<br><button id="download-sticker-regions" class="text-button">生成并下载贴纸局部图 ↗</button>`;$('modal-body').prepend(notice);bind('download-sticker-regions',showStickerRegions);}
  $('modal-body').querySelectorAll<HTMLElement>('.asset-fields').forEach(fields=>{const id=fields.querySelector<HTMLElement>('[data-asset-id]')?.dataset.assetId;const a=id&&assets.get(id);if(a)fields.insertAdjacentHTML('beforeend',`<label class="asset-caption">图号（如 图 1）<input data-asset-field="figureLabel" data-asset-id="${a.id}" value="${esc(a.figureLabel||'')}"></label><label class="asset-caption">来源信息<input data-asset-field="source" data-asset-id="${a.id}" value="${esc(a.source||'')}" placeholder="作者、机构、文献或网址"></label>`);});
  let captured=false;
  $('modal-body').querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-asset-field]').forEach(el=>el.onchange=()=>{
    const a=assets.get(el.dataset.assetId!)!;const field=el.dataset.assetField!;
    if(!captured){snapshot(current,true);captured=true;}
    if(field==='width'){a.width=Math.max(10,Math.min(100,Number(el.value)||100));el.value=String(a.width);}
    else if(field==='alt'){
      a.alt=el.value;const id=a.id;const newText=current.markdown.replace(new RegExp('!\\[[^\\]]*\\]\\(asset:'+id+'\\)','g'),()=>`![${a.alt.replace(/[\[\]\\\r\n]/g,'')}](asset:${id})`);editor.setText(newText);current.markdown=newText;
    }else (a as any)[field]=el.value;
    changeAssetAppearance(a.id,appearance(a));
  });
  $('modal-body').querySelectorAll<HTMLElement>('[data-download-asset]').forEach(el=>el.onclick=()=>{const a=assets.get(el.dataset.downloadAsset!)!;download(bytesFromData(a.data) as BlobPart,safeName(a.name),a.mime);});
  $('modal-body').querySelectorAll<HTMLElement>('[data-svg]').forEach(el=>el.onclick=()=>{const svg=nodes[Number(el.dataset.svg)].querySelector('svg')!;const clone=svg.cloneNode(true) as SVGElement;clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.style.color='#1f2937';download(new XMLSerializer().serializeToString(clone),`公式-${Number(el.dataset.svg)+1}.svg`,'image/svg+xml');});
  $('modal-body').querySelectorAll<HTMLElement>('[data-png]').forEach(el=>el.onclick=()=>void(async()=>{try{const svg=nodes[Number(el.dataset.png)].querySelector('svg')!;download(await svgToPNG(svg),`公式-${Number(el.dataset.png)+1}.png`,'image/png');}catch(e){toast(errorMessage(e),true);}})());
  $('modal-body').querySelectorAll<HTMLElement>('[data-localize]').forEach(el=>el.onclick=()=>void(async()=>{
    const node=nodes[Number(el.dataset.localize)],url=node.dataset.source!;const target=current;
    try{el.textContent='正在读取…';const response=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('网络请求失败');const blob=await response.blob();const a=await fileToAsset(new File([blob],'网络图片.'+extension(blob.type),{type:blob.type}));assets.set(a.id,a);trackAsset(a.id);const staged=await stageAssets([a]);snapshot(target,true);target.markdown=target.markdown.split(url).join('asset:'+a.id);markDirty(target);if(current.id===target.id){editor.setText(target.markdown);showAssets();}if(staged)toast('已导入本地副本');}
    catch{el.textContent='导入本地副本';toast('网站不允许读取或图片不可用。请先下载图片，再用「图片」插入。',true);}
  })());
  $('modal-body').querySelectorAll<HTMLElement>('[data-compress-asset]').forEach(el=>el.onclick=()=>void compressImage(el.dataset.compressAsset!).catch(e=>toast(errorMessage(e),true)));
}
async function compressImage(id:string){
  const original=assets.get(id)!,target=current;const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('无法读取图片'));img.src=original.data;});
  const ratio=Math.min(1,1600/img.naturalWidth);const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*ratio);canvas.height=Math.round(img.naturalHeight*ratio);canvas.getContext('2d')!.drawImage(img,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL('image/webp',.85);const copy={...original,id:uid(),name:original.name.replace(/\.[^.]+$/,'')+'-压缩.webp',mime:'image/webp',data};
  assets.set(copy.id,copy);trackAsset(copy.id);const staged=await stageAssets([copy]);snapshot(target,true);target.markdown=target.markdown.replaceAll('asset:'+id,'asset:'+copy.id);for(const sticker of target.stickers||[])if(sticker.assetId===id)sticker.assetId=copy.id;target.assetSettings={...target.assetSettings,[copy.id]:appearance(copy)};markDirty(target);
  if(current.id===target.id){editor.setText(target.markdown);showAssets();}if(staged)toast('已换用压缩副本，原图仍保留在之前的恢复版本中');
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
  const recovery=await recoverDrafts(articles);
  for(const article of articles.values()){article.linkMode??=legacyReferences?'end':'direct';for(const revision of article.revisions)revision.linkMode??=article.linkMode;}
  const newestRecovered=recovery.recovered.filter(a=>!a.deleted).sort((a,b)=>b.updated-a.updated)[0];if(newestRecovered)preference('current',newestRecovered.id);
  const active=[...articles.values()].filter(a=>!a.deleted).sort((a,b)=>b.updated-a.updated);
  current=active.find(a=>a.id===readPreference('current',''))||active[0]||current;
  const first=!articles.has(current.id);if(first)articles.set(current.id,current);
  const requestedEditorTheme=readPreference(night?'editor-theme-night':'editor-theme',night?'dark':'light'),editorTheme=editorThemes[requestedEditorTheme]?requestedEditorTheme:(night?'dark':'light');
  $<HTMLSelectElement>('editor-theme').innerHTML=Object.entries(editorThemes).map(([id,t])=>`<option value="${id}">${t.name}</option>`).join('');$<HTMLSelectElement>('editor-theme').value=editorThemes[editorTheme]?editorTheme:'dark';
  editor=new MarkdownEditor($('editor'),current.markdown,editorTheme,text=>{updateStickerLines(current.stickers,current.markdown,text);current.markdown=text;markDirty();queueRender();},(files,pos)=>void addImages(files,pos).catch(e=>toast(errorMessage(e),true)),()=>exportBackup(),readPreference('latex-completion','true')==='true');
  editorChrome(editorTheme);applyAppearance();
  sync=new ScrollSync(editor,$('preview-scroll'),$('preview'));
  previewEditor=new PreviewEditor($('preview'),editor,render,toast);
  stickerController=new StickerController($('preview'),()=>current,assets,()=>{markDirty();requestAnimationFrame(()=>sync.rebuild());},makeSticker,restoreSticker,()=>void showStickerRegions().catch(e=>toast(errorMessage(e),true)));
  bind('modal-close',closeModal);modal.addEventListener('cancel',e=>{e.preventDefault();const detail=document.getElementById('theme-detail');if(detail&&!detail.hidden)$('theme-detail-close').click();else closeModal();});modal.addEventListener('click',e=>{if(e.target===modal){const b=modal.getBoundingClientRect();const m=e as MouseEvent;if(m.clientX<b.left||m.clientX>b.right||m.clientY<b.top||m.clientY>b.bottom)closeModal();}});
  $('library').hidden=readPreference('library-open','true')!=='true';
  $('theme-sidebar').hidden=readPreference('theme-sidebar-open','false')!=='true';
  themeSidebar=mountThemeSidebar($('theme-sidebar'),{current:()=>current.theme,enabled:()=>publisher==='wechat',pins:()=>pinnedThemes,thumbnail:themeThumbnail,preview:previewArticleTheme,cancel:()=>clearThemePreview(),apply:applyArticleTheme,pin:id=>{if(pinnedThemes.includes(id))pinnedThemes=pinnedThemes.filter(v=>v!==id);else pinnedThemes.push(id);preference('pinned-themes',JSON.stringify(pinnedThemes));},order:ids=>{pinnedThemes=ids;preference('pinned-themes',JSON.stringify(pinnedThemes));},details:()=>showThemes(),close:toggleThemeSidebar});
  bind('theme-sidebar-toggle',toggleThemeSidebar);
  for(const [id,recycle] of [['rail-documents',false],['rail-trash',true]] as const)bind(id,()=>{const same=!$('library').hidden&&trash===recycle;trash=recycle;libraryRecent=false;$('library').hidden=same;renderLibrary();});
  for(const mode of ['compare','preview'] as const)bind('view-'+mode,()=>setWorkspaceView(mode));
  bind('header-preview-button',()=>setWorkspaceView(document.body.dataset.workspaceView==='preview'?'compare':'preview'));setWorkspaceView('compare');
  $('local-button').innerHTML=uiIcon('cloud')+'<span>本地</span>'+uiIcon('chevron');$('export-toggle').innerHTML=uiIcon('export')+'<span>导出</span>'+uiIcon('chevron');
  $('github-link').innerHTML=uiIcon('github');$('bilibili-link').innerHTML=uiIcon('bilibili');
  $('new-article').innerHTML=uiIcon('plus')+'<span>新建文章</span>';$('import-button').innerHTML=uiIcon('import')+'<span>导入 Markdown / 备份</span>';$('library-search-icon').innerHTML=uiIcon('search');
  $('preview-narrow').innerHTML=uiIcon('phone');$('preview-wide').innerHTML=uiIcon('monitor');
  bind('preview-narrow',()=>setPreviewWidth('430'));bind('preview-wide',()=>setPreviewWidth('wide'));
  bind('local-button',()=>{const panel=openPopover($('local-button'),'本地保存',`<p class="help">文章与图片保存在当前浏览器。备份文件可带到其他电脑恢复。</p><div class="local-actions"><button id="local-save-article">${uiIcon('document')}备份当前文章</button><button id="local-save-library">${uiIcon('folder')}备份整个文章库</button><button id="local-import">${uiIcon('import')}导入 Markdown / 备份</button></div>`);bind('local-save-article',()=>{closePopover();exportBackup();});bind('local-save-library',()=>{closePopover();exportBackup(true);});bind('local-import',()=>{closePopover();$('import-input').click();});});
  const fullscreenButton=$<HTMLButtonElement>('fullscreen-button');let fullscreenBusy=false;
  const syncFullscreen=()=>{
    const active=Boolean(document.fullscreenElement),label=active?'退出全屏':'全屏展开';
    fullscreenButton.setAttribute('aria-pressed',String(active));fullscreenButton.setAttribute('aria-label',label);
    fullscreenButton.title=active?'退出全屏（Esc）':'全屏展开编辑器';
    $('fullscreen-label').textContent=active?'退出全屏':'全屏';
    requestAnimationFrame(()=>{editor.view.requestMeasure();sync.rebuild();});
  };
  bind('fullscreen-button',async()=>{
    if(fullscreenBusy)return;
    const exiting=Boolean(document.fullscreenElement);
    if(!exiting&&(!document.fullscreenEnabled||!document.documentElement.requestFullscreen)){toast('此浏览器未开放全屏，可尝试按 F11 展开窗口。');return;}
    fullscreenBusy=true;fullscreenButton.disabled=true;clearThemePreview();closePopover();
    try{
      if(exiting)await document.exitFullscreen();else await document.documentElement.requestFullscreen();
    }catch{toast(exiting?'暂时无法退出全屏，请按 Esc。':'浏览器未允许全屏，可尝试按 F11 展开窗口。',true);}
    finally{fullscreenBusy=false;fullscreenButton.disabled=false;syncFullscreen();}
  });
  document.addEventListener('fullscreenchange',syncFullscreen);syncFullscreen();
  window.addEventListener('blur',()=>clearThemePreview());
  bind('library-toggle',toggleLibrary);bind('library-button',toggleLibrary);bind('library-close',toggleLibrary);
  bind('new-folder',e=>folderEditor(e.currentTarget as HTMLElement));
  $('folder-list').addEventListener('click',e=>{const target=e.target as HTMLElement,edit=target.closest<HTMLElement>('[data-folder-edit]'),folder=target.closest<HTMLElement>('[data-folder]');if(edit)folderEditor(edit,edit.dataset.folderEdit!);else if(folder){libraryFolder=folder.dataset.folder!;libraryRecent=false;saveFolders();renderLibrary();}});
  bind('new-article',()=>addArticle());bind('active-tab',()=>{trash=false;libraryRecent=false;libraryFolder='*';saveFolders();renderLibrary();});bind('recent-tab',()=>{trash=false;libraryRecent=true;libraryFolder='*';saveFolders();renderLibrary();});bind('trash-tab',()=>{trash=true;libraryRecent=false;renderLibrary();});bind('library-search',renderLibrary,'input');
  const fontButton=document.createElement('button');fontButton.id='font-inspect-button';fontButton.innerHTML='Aa <span>字体与标签透视</span>';fontButton.title='显示声明的字体族及本机回退链；不影响复制与导出';fontButton.setAttribute('aria-label','字体与标签透视');fontButton.setAttribute('aria-pressed',String(fontInspection));$('preview-edit-button').after(fontButton);fontButton.onclick=()=>{fontInspection=!fontInspection;preference('font-inspection',String(fontInspection));fontButton.setAttribute('aria-pressed',String(fontInspection));inspectFonts($('preview'),fontInspection);};
  const moodButton=document.createElement('button');moodButton.id='folio-font-button';moodButton.hidden=true;moodButton.title='切换散文正文字体气质';moodButton.setAttribute('aria-label','切换文学正文字体');fontButton.after(moodButton);moodButton.onclick=()=>showFolioFonts(moodButton);
  const folioButton=document.createElement('button');folioButton.id='folio-block-button';folioButton.textContent='古籍元素 ▾';folioButton.title='题记、诗笺、朱批、笺注与水墨装裱';$('math-button').after(folioButton);folioButton.onclick=()=>showFolioElements(folioButton);
  const journalButton=document.createElement('button');journalButton.id='journal-block-button';journalButton.textContent='期刊元素 ▾';journalButton.title='导读、定律、公式释义、推导、要点和参考文献';$('math-button').after(journalButton);journalButton.onclick=()=>showJournalBlocks(journalButton);
  bind('theme-button',()=>showThemes());bind('samples-button',showSamples);bind('style-button',e=>{const p=$('style-panel');p.hidden=!p.hidden;if(!p.hidden){renderStylePanel();if((e as MouseEvent).detail===0)$('style-close').focus();}});
  document.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.defaultPrevented||modal.open)return;const target=e.target as Node;if(!$('style-panel').hidden&&($('style-panel').contains(target)||target===$('style-button'))){e.preventDefault();$('style-panel').hidden=true;$('style-button').focus();}else if(!$('library').hidden&&($('library').contains(target)||target===$('library-button'))){e.preventDefault();toggleLibrary();$('library-button').focus();}else if(document.fullscreenElement&&!fullscreenBusy){e.preventDefault();fullscreenButton.click();}});
  mountInlineMenus(showInlineStyle);const rewriteButton=document.createElement('button');rewriteButton.id='selection-rewrite';rewriteButton.textContent='改写';$('selection-role-button').after(rewriteButton);rewriteButton.onclick=startRewrite;modal.addEventListener('close',cancelRewrite);
  bind('editor-theme',()=>{const value=$<HTMLSelectElement>('editor-theme').value;editor.theme(value);editorChrome(value);preference(night?'editor-theme-night':'editor-theme',value);},'change');
  bind('night-button',()=>{night=!night;preference('appearance',night?'night':'day');const id=readPreference(night?'editor-theme-night':'editor-theme',night?'dark':'light');const value=editorThemes[id]?id:(night?'dark':'light');$<HTMLSelectElement>('editor-theme').value=value;editor.theme(value);editorChrome(value);applyAppearance();});
  bind('preview-brightness',()=>{brightness=Number($<HTMLInputElement>('preview-brightness').value);preference('preview-brightness',String(brightness));applyAppearance();},'input');
  bind('preview-edit-button',()=>{previewEditor.enabled=!previewEditor.enabled;$('preview-edit-button').setAttribute('aria-pressed',String(previewEditor.enabled));$('preview-edit-button').textContent=previewEditor.enabled?'完成修改':'编辑文字';render();if(previewEditor.enabled)toast('点击标题或正文修改文字。格式、公式、图片保持锁定；换行请在左侧修改。');});
  for(const mode of ['edit','preview'])bind('mobile-'+mode,()=>{document.body.dataset.mobilePane=mode;for(const id of ['edit','preview'])$('mobile-'+id).setAttribute('aria-selected',String(id===mode));editor.view.requestMeasure();sync.rebuild();});
  const savedWidth=readPreference('preview-width','430');
  $<HTMLSelectElement>('preview-width').value=['375','430','wide'].includes(savedWidth)?savedWidth:'375';
  $('preview').style.maxWidth=savedWidth==='wide'?'760px':(['375','430'].includes(savedWidth)?savedWidth:'375')+'px';
  const savedShare=Number(readPreference('split-share','49'));$('split-workspace').style.setProperty('--editor-share',(Number.isFinite(savedShare)?Math.max(25,Math.min(75,savedShare)):49)+'%');
  bind('format-rewrite-button',()=>showFormatRewrite({current:()=>current.theme,article:()=>current.markdown,open:openModal,notify:toast}));
  bind('clear-heading-numbers',()=>{
    const result=stripHeadingNumbers(editor.view.state.doc.toString());
    if(!result.count){toast('没有找到可清除的标题序号');return;}
    snapshot(current,true);
    editor.view.dispatch({changes:result.changes,userEvent:'input.strip-heading-numbers',annotations:isolateHistory.of('full')});
    editor.view.focus();toast(`已清除 ${result.count} 处标题序号，可一次撤销`);
  });
  bind('sync-button',()=>{sync.enabled=!sync.enabled;$('sync-button').classList.toggle('active',sync.enabled);$('sync-button').setAttribute('aria-pressed',String(sync.enabled));toast(sync.enabled?'双向同步滚动已开启':'已关闭同步，可独立浏览两侧');});
  bind('preview-width',()=>setPreviewWidth($<HTMLSelectElement>('preview-width').value),'change');setPreviewWidth($<HTMLSelectElement>('preview-width').value);
  bind('image-button',()=>$('image-input').click());bind('image-input',async()=>{const input=$<HTMLInputElement>('image-input');const files=[...(input.files||[])];input.value='';await addImages(files,editor.view.state.selection.main.head);},'change');
  const layoutButton=document.createElement('button');layoutButton.id='image-layout-button';layoutButton.textContent='组图 ▾';layoutButton.title='切换图片组排版';$('image-button').after(layoutButton);layoutButton.onclick=()=>showImageLayouts('',layoutButton);
  $('preview').addEventListener('click',event=>{if(previewEditor.enabled||publisher!=='wechat')return;const target=event.target as HTMLElement,group=target.closest<HTMLElement>('.image-gallery');if(group){event.stopImmediatePropagation();showImageLayouts(group.dataset.gallery!,layoutButton);return;}const image=target.closest<HTMLElement>('.image-wrap');if((themeById(current.theme).baseId||current.theme)==='magazine'&&image){event.stopImmediatePropagation();showMagazineImage(image);}},true);
  const dividerButton=document.createElement('button');dividerButton.id='divider-button';dividerButton.textContent='分割线 ▾';$('image-layout-button').after(dividerButton);dividerButton.onclick=()=>showDividers(dividerButton);
  const indentButton=document.createElement('button');indentButton.id='indent-toggle';indentButton.textContent='段首空两格';indentButton.title='自动缩进正文首行；不改变 Markdown 内容';$('inline-style-button').before(indentButton);indentButton.onclick=()=>{current.typography.indent=!(current.typography.indent??themeDefaults(themeById(current.theme)).indent);markDirty();render();if(!$('style-panel').hidden)renderStylePanel();};
  bind('math-button',showFormulas);bind('assets-button',showAssets);bind('toc-button',showTOC);bind('undo-button',()=>editor.undo());bind('redo-button',()=>editor.redo());bind('search-button',()=>editor.search());
  const writingButton=document.createElement('button');writingButton.id='writing-tools-button';writingButton.className='tool-button';writingButton.setAttribute('aria-label','写作助手');writingButton.title='公式命令补全、写作检查、文字整理与恢复点';writingButton.innerHTML='✎ <span>写作助手</span> ▾';$('assets-button').before(writingButton);writingButton.onclick=()=>showWritingTools(writingButton);
  const editionButton=document.createElement('button');editionButton.id='edition-block-button';editionButton.textContent='模板组件 ▾';editionButton.title='预览与插入杂志、新闻和文学科普组件';$('folio-block-button').after(editionButton);editionButton.onclick=()=>showEditionElements(editionButton);
  bind('publisher',()=>{clearThemePreview(false);publisher=$<HTMLSelectElement>('publisher').value;preference('publisher',publisher);render();},'change');
  bind('copy-button',copyArticle);bind('export-toggle',showExport);bind('backup-library',()=>exportBackup(true));bind('import-button',()=>$('import-input').click());bind('import-input',async()=>{const input=$<HTMLInputElement>('import-input');const files=[...(input.files||[])];input.value='';await importFiles(files);},'change');
  document.querySelectorAll<HTMLElement>('[data-format]').forEach(el=>el.onclick=()=>{
    const type=el.dataset.format;
    if(['bold','italic','underline','strike','wave'].includes(type||''))closePopover();
    const math=selectedMath(editor);
    if(math&&['bold','italic','underline','strike','wave'].includes(type||'')){
      if(type==='wave'){toast('公式可使用普通下划线；波浪线用于普通文字。');return;}
      const key=type as 'bold'|'italic'|'underline'|'strike';applyMathStyle(editor,math,{...math.style,[key]:!math.style[key]},toast,(tex,display)=>renderMath(tex,display).error);return;
    }
    const selection=editor.view.state.selection.main;
    if(['bold','italic','underline','wave','strike'].includes(type||'')&&editor.view.state.sliceDoc(selection.from,selection.to).includes('\n')){
      const plan=selectedTextRuns(editor.view.state.doc.toString(),selection.from,selection.to),key=type as 'bold'|'italic'|'underline'|'wave'|'strike',enabled=plan.common[key]!==true;
      const patch:InlineStyle={[key]:enabled?true:undefined};if(enabled&&key==='wave')patch.underline=undefined;if(enabled&&key==='underline')patch.wave=undefined;
      applySelectedTextStyle(plan,patch);return;
    }
    if(type==='bold')boldSelection(editor,toast);
    else if(type==='italic'){if(hasSelectedStyle(editor))toggleTextStyle(editor,'italic');else editor.wrap('*');}
    else if(type==='strike'||type==='underline'||type==='wave'){
      const selection=editor.view.state.selection.main;if(editor.view.state.sliceDoc(selection.from,selection.to).includes('\n')){toast('请在同一行 Markdown 中选中文字。');return;}
      if(type==='strike'&&!hasSelectedStyle(editor))editor.wrap('~~');else toggleTextStyle(editor,type);
    }else if(type==='heading')showBlockMenu(el);
    else if(type==='quote'||type==='poem')blockFormat(editor,type);
    else if(type==='code')codeFormat(editor);
    else if(type==='footnote'){insertFootnote(editor);toast('脚注标记已插入，直接填写文末选中的注释内容。');}
    else if(type==='link')showLinkMenu(el);
    else if(type==='table')showTableMenu(el);
  });
  bind('selection-block-button',e=>showBlockMenu(e.currentTarget as HTMLElement));
  bind('table-style-button',e=>showTableMenu(e.currentTarget as HTMLElement));
  $('article-list').addEventListener('click',e=>{
    const target=e.target as HTMLElement,item=target.closest<HTMLElement>('[data-id]');if(!item)return;const article=articles.get(item.dataset.id!)!;
    if(target.closest('summary'))return;
    const action=target.dataset.action;
    if(action==='delete'){snapshot(article,true);article.deleted=true;markDirty(article);if(article.id===current.id){const next=[...articles.values()].find(a=>!a.deleted);if(next)switchArticle(next.id);else addArticle();}renderLibrary();toast('已移入回收站，可以随时恢复');}
    else if(action==='restore'){article.deleted=false;markDirty(article);renderLibrary();toast('文章已恢复到草稿');}
    else if(action==='move')moveArticle(target,article);
    else if(action==='history')showHistory(article);
    else if(action==='duplicate'){
      const copy=freshArticle(article.title+' · 副本',article.markdown);copy.titleMode='auto';copy.folder=article.folder;copy.theme=article.theme;copy.typography=structuredClone(article.typography);copy.stickers=structuredClone(article.stickers||[]).map(s=>({...s,id:uid()}));copy.assetSettings=captureAssets(article,assetStore);copy.linkMode=article.linkMode;
      articles.set(copy.id,copy);markDirty(copy);switchArticle(copy.id);
    }else if(!trash)switchArticle(article.id);
  });
  $('article-list').addEventListener('keydown',e=>{if(e.key==='Escape'){const menu=(e.target as HTMLElement).closest<HTMLDetailsElement>('.article-actions[open]');if(menu){e.preventDefault();menu.open=false;menu.querySelector('summary')?.focus();return;}}if(e.key==='Enter'&&(e.target as HTMLElement).classList.contains('article-item'))(e.target as HTMLElement).click();});
  bind('render-state',()=>{if(renderResult.errors.length){editor.goto(renderResult.errors[0].line);toast(renderResult.errors[0].message,true);}else if(renderResult.missing.length)showAssets();});
  const splitter=$('splitter');splitter.addEventListener('pointerdown',e=>{splitter.setPointerCapture(e.pointerId);document.body.style.userSelect='none';});
  splitter.addEventListener('pointermove',e=>{if(!splitter.hasPointerCapture(e.pointerId))return;const rect=$('split-workspace').getBoundingClientRect();const share=Math.max(25,Math.min(75,(e.clientX-rect.left)/rect.width*100));$('split-workspace').style.setProperty('--editor-share',share+'%');editor.view.requestMeasure();sync.rebuild();});
  const rememberSplit=()=>{document.body.style.userSelect='';preference('split-share',$('split-workspace').style.getPropertyValue('--editor-share').replace('%',''));sync.rebuild();};
  splitter.addEventListener('pointerup',e=>{splitter.releasePointerCapture(e.pointerId);rememberSplit();});splitter.addEventListener('pointercancel',rememberSplit);
  splitter.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const current=Number.parseFloat($('split-workspace').style.getPropertyValue('--editor-share'))||49;$('split-workspace').style.setProperty('--editor-share',Math.max(25,Math.min(75,current+(e.key==='ArrowRight'?2:-2)))+'%');rememberSplit();requestAnimationFrame(()=>sync.rebuild());}});
  new ResizeObserver(()=>requestAnimationFrame(()=>{stickerController.reposition();sync.rebuild();})).observe($('preview'));
  window.addEventListener('beforeunload',e=>{if(dirtyGeneration!==savedGeneration){e.preventDefault();e.returnValue='';}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirtyArticles.size)void save();});
  mountPopoverHover(document.querySelectorAll<HTMLElement>('[data-inline-menu],#selection-block-button,.format-toolbar [data-format="heading"],#table-style-button,#image-layout-button,#divider-button,#math-button,#journal-block-button,#folio-block-button,#edition-block-button,#folio-font-button,#writing-tools-button'),target=>{
    if(target.dataset.inlineMenu){const s=editor.view.state.selection.main,text=editor.view.state.sliceDoc(s.from,s.to);if(!text)return false;const math=selectedMath(editor);if(math)return !math.error&&['color','size','highlight','effect'].includes(target.dataset.inlineMenu);if(!text.includes('\n'))return true;const plan=selectedTextRuns(editor.view.state.doc.toString(),s.from,s.to);return !plan.error&&plan.selected.length>0;}
    return target.id!=='image-layout-button'||/^:::gallery /m.test(current.markdown);
  });
  // The constructor already contains the restored document and its settings.
  switchArticle(current.id,false);
  if(themeLibraryError())toast(themeLibraryError(),true);
  for(const article of recovery.recovered)markDirty(article);
  if(first)markDirty();
  if(storageError){paintSaveState('error','本地存储不可用 · 请导出备份');toast('浏览器未开放本地存储。可继续编辑，请用文件备份保存。',true);}
  else if(recovery.recovered.length)toast(`已找回 ${recovery.recovered.length} 篇未完成稿件；有其他窗口更新时会保留恢复副本。`);
  else if(!first)paintSaveState('saved');
  if(recovery.invalid)toast(`有 ${recovery.invalid} 条临时恢复记录损坏，已保留原记录，文章库仍可使用。`,true);
}
void init().catch(e=>{toast('初始化失败：'+errorMessage(e),true);$('save-state').textContent='初始化失败，请重新打开';});
