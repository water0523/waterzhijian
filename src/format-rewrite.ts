import {escapeHTML as esc} from './model';
import {themeById,visibleThemes} from './themes';
import {buildFormatPrompt,formatProfile,formatRequest} from './format-prompts';
import type {Theme} from './theme-types';
type Host={current:()=>string;article:()=>string;open:(title:string,html:string,eyebrow?:string)=>void;notify:(message:string,error?:boolean)=>void;};
export function showFormatRewrite(host:Host){
 const current=themeById(host.current()),special=visibleThemes().filter(t=>formatProfile(t)!=='standard');
 const options:Theme[]=special.some(t=>t.id===current.id)?special:[current,...special];
 const label=(t:Theme)=>t.name+(t.id===current.id?' · 当前主题':'')+(formatProfile(t)==='standard'?'（通用格式）':'');
 host.open('格式改写 · 只改格式，保留原文',`<section class="format-rewrite"><p class="format-rewrite-intro">让 AI 理解你的具体文章，自主选择合适的主题特色格式，兼顾丰富度与阅读节奏。复制提示词和文章一起发给 AI，将返回的完整 Markdown 粘回左侧，再选择对应主题。</p><div class="format-rewrite-controls"><label for="format-rewrite-theme">排版主题<select id="format-rewrite-theme">${options.map(t=>`<option value="${esc(t.id)}" ${t.id===current.id?'selected':''}>${esc(label(t))}</option>`).join('')}</select></label><span id="format-rewrite-kind"></span></div><p class="format-rewrite-rule">原文逐字保留 · 按文意自主选版 · 不增删、不润色、不补写</p><label class="format-rewrite-label" for="format-rewrite-prompt">可直接发给 AI 的完整提示词</label><textarea id="format-rewrite-prompt" readonly spellcheck="false"></textarea><div class="format-rewrite-actions"><button id="format-rewrite-copy" class="button primary">复制提示词</button><button id="format-rewrite-with-article" class="button outline">连同当前文章复制</button><span id="format-rewrite-status" role="status" aria-live="polite"></span></div><div id="format-rewrite-fallback" hidden><label for="format-rewrite-manual">自动复制不可用，内容已选中，请按 Ctrl+C</label><textarea id="format-rewrite-manual" readonly spellcheck="false"></textarea></div><p class="format-rewrite-footnote">这里只生成并复制提示词，不会调用 AI、发送文章或修改原稿。选择提示词也不会切换当前文章主题。</p></section>`,'FORMAT ONLY / AI PROMPTS');
 const find=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
 const select=find<HTMLSelectElement>('format-rewrite-theme'),prompt=find<HTMLTextAreaElement>('format-rewrite-prompt'),status=find('format-rewrite-status');
 const update=()=>{const theme=themeById(select.value);prompt.value=buildFormatPrompt(theme);find('format-rewrite-kind').textContent=formatProfile(theme)==='standard'?'普通 Markdown · 自动主题样式':'主题专用标签 · 与排版器语法一致';status.textContent='';find('format-rewrite-fallback').hidden=true;};
 const copy=async(includeArticle:boolean)=>{
  const value=includeArticle?formatRequest(prompt.value,host.article()):prompt.value;
  try{await navigator.clipboard.writeText(value);if(!status.isConnected)return;find('format-rewrite-fallback').hidden=true;status.textContent=includeArticle?'已复制提示词与完整原文':'已复制提示词';host.notify(status.textContent);}
  catch{if(!status.isConnected)return;const manual=find<HTMLTextAreaElement>('format-rewrite-manual');find('format-rewrite-fallback').hidden=false;manual.value=value;manual.focus();manual.select();status.textContent='请按 Ctrl+C 完成复制';host.notify('自动复制不可用，已选中内容，请按 Ctrl+C。');}
 };
 select.addEventListener('change',update);find('format-rewrite-copy').onclick=()=>void copy(false);find('format-rewrite-with-article').onclick=()=>void copy(true);update();
}
