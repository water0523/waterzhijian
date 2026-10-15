import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import {mathjax} from 'mathjax-full/js/mathjax.js';
import {TeX} from 'mathjax-full/js/input/tex.js';
import {SVG} from 'mathjax-full/js/output/svg.js';
import {liteAdaptor} from 'mathjax-full/js/adaptors/liteAdaptor.js';
import {RegisterHTMLHandler} from 'mathjax-full/js/handlers/html.js';
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js';
import 'mathjax-full/js/input/tex/newcommand/NewcommandConfiguration.js';
import 'mathjax-full/js/input/tex/noundefined/NoUndefinedConfiguration.js';
import 'mathjax-full/js/input/tex/color/ColorConfiguration.js';
import 'mathjax-full/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import {escapeHTML, type Asset} from './model';
import {installTextMapping} from './text-mapping';
import {installInlineStyles} from './inline-style';
import {dividerOptions,dividerSVG} from './dividers';
import {installJournalBlocks} from './journal-blocks';

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const tex = new TeX({packages:['base','ams','newcommand','noundefined','color','boldsymbol'],tags:'ams',maxBuffer:20000});
const mathDocument = mathjax.document('',{InputJax:tex,OutputJax:new SVG({fontCache:'none'})});
const cache = new Map<string,{html:string; error?:string; nextNumber?:number}>();
export interface RenderResult {html:string; errors:{line:number;message:string}[]; external:string[]; missing:string[]}
export function renderMath(source:string,display:boolean,startNumber=0): {html:string;error?:string;nextNumber?:number} {
  const key=(display?'D':'I')+startNumber+':'+source;
  const cached=cache.get(key); if(cached) return cached;
  let result: {html:string;error?:string;nextNumber?:number};
  try {
    tex.reset(startNumber);
    const node=mathDocument.convert(source,{display,em:16,ex:8,containerWidth:327});
    const html=adaptor.outerHTML(node);
    const match=html.match(/data-mjx-error="([^"]*)"/);
    const unknown=/data-mml-node="mtext"[^>]*fill="red"/.test(html)||html.includes('data-mjx-error');
    result=match||unknown?{html:'',error:match?.[1]||'无法识别的公式命令'}:{html,nextNumber:(tex.parseOptions.tags as unknown as {counter:number}).counter};
  } catch(e) { result={html:'',error:e instanceof Error?e.message:'公式语法错误'}; }
  if(cache.size>1000) cache.delete(cache.keys().next().value!);
  cache.set(key,result); return result;
}

const md = new MarkdownIt({html:false,linkify:true,typographer:true,breaks:false,
  highlight:(s,lang)=>lang&&hljs.getLanguage(lang)?hljs.highlight(s,{language:lang,ignoreIllegals:true}).value:escapeHTML(s)
}).use(footnote as unknown as (instance:MarkdownIt)=>void);
const baseValidate=md.validateLink;
installJournalBlocks(md);
md.validateLink=(url:string)=>/^asset:[a-zA-Z0-9-]+$/.test(url)||baseValidate(url);

md.inline.ruler.before('escape','math_inline',(state,silent)=>{
  const p=state.pos;
  if(state.src[p]!=='$'||state.src[p+1]==='$'||/\s/.test(state.src[p+1]||' ')) return false;
  let end=p+1;
  while((end=state.src.indexOf('$',end))!==-1) {
    if(state.src[end-1]==='\\'){end++;continue;}
    break;
  }
  if(end<0||/\s/.test(state.src[end-1])||/\d/.test(state.src[end+1]||''))return false;
  if(!silent){const t=state.push('math_inline','span',0);t.content=state.src.slice(p+1,end);}
  state.pos=end+1;return true;
});
md.block.ruler.before('fence','math_block',(state,start,end,silent)=>{
  const pos=state.bMarks[start]+state.tShift[start];
  const first=state.src.slice(pos,state.eMarks[start]).trim();
  if(!first.startsWith('$$'))return false;
  if(silent)return true;
  let content=first.slice(2),next=start+1;
  if(content.endsWith('$$')&&content.length>=2) content=content.slice(0,-2);
  else {
    let closed=false;
    for(;next<end;next++){
      const line=state.src.slice(state.bMarks[next]+state.tShift[next],state.eMarks[next]);
      const at=line.indexOf('$$');
      if(at>=0){content+='\n'+line.slice(0,at);next++;closed=true;break;}
      content+='\n'+line;
    }
    if(!closed)return false;
  }
  const token=state.push('math_block','section',0);token.block=true;token.content=content.trim();token.map=[start,next];state.line=next;return true;
},{alt:['paragraph','reference','blockquote','list']});
md.block.ruler.before('fence','poem',(state,start,end,silent)=>{
  const text=state.src.slice(state.bMarks[start]+state.tShift[start],state.eMarks[start]).trim();
  const match=/^:::poem(?:\s+(left|center))?$/.exec(text);if(!match)return false;
  if(silent)return true;
  let next=start+1;const lines:string[]=[];
  for(;next<end;next++){
    const line=state.src.slice(state.bMarks[next],state.eMarks[next]);if(line.trim()===':::')break;lines.push(line);
  }
  const t=state.push('poem_open','section',1);t.block=false;t.attrSet('class','poem');if(match[1])t.attrSet('data-align',match[1]);t.map=[start,Math.min(next+1,end)];
  lines.forEach((line,i)=>{
    const open=state.push('poem_line_open','span',1);open.block=false;open.attrSet('class','poem-line');open.map=[start+1+i,start+2+i];
    const inline=state.push('inline','',0);inline.content=line;inline.children=[];inline.map=open.map;
    state.push('poem_line_close','span',-1).block=false;
    if(i<lines.length-1)state.push('poem_newline','',0);
  });
  state.push('poem_close','section',-1).block=false;state.line=Math.min(next+1,end);return true;
});
md.renderer.rules.poem_newline=()=> '\n';
md.block.ruler.before('fence','divider',(state,start,_end,silent)=>{
  const text=state.src.slice(state.bMarks[start]+state.tShift[start],state.eMarks[start]).trim();
  const kind=/^:::divider ([a-z]+)$/.exec(text)?.[1];if(!kind||!dividerOptions.some(([id])=>id===kind))return false;
  if(silent)return true;const t=state.push('decorative_divider','section',0);t.info=kind;t.map=[start,start+1];state.line=start+1;return true;
},{alt:['paragraph']});
md.renderer.rules.decorative_divider=(tokens,i)=>`<section class="decorative-divider" data-divider="${tokens[i].info}" data-line="${tokens[i].map![0]}" data-end="${tokens[i].map![1]}" role="separator" aria-label="分割线" style="clear:both;text-indent:0">${dividerSVG(tokens[i].info)}</section>`;
// Parse image rows during the block phase; references, validation and source maps
// then follow the same path as ordinary Markdown images.
md.block.ruler.before('fence','gallery',(state,start,end,silent)=>{
  const first=state.src.slice(state.bMarks[start]+state.tShift[start],state.eMarks[start]).trim();
  const match=/^:::gallery (stack|grid2|grid3|featured) ([\w-]+)$/.exec(first);if(!match)return false;
  let next=start+1;const rows:{text:string;line:number}[]=[];
  for(;next<end;next++){const text=state.src.slice(state.bMarks[next],state.eMarks[next]).trim();if(text===':::')break;if(text){if(!/^!\[[^\n]*\]\([^\n]+\)$/.test(text))return false;rows.push({text,line:next});}}
  if(next===end||!rows.length)return false;if(silent)return true;
  const section=state.push('gallery_open','section',1);section.attrs=[['class','image-gallery'],['data-gallery',match[2]],['data-layout',match[1]]];section.map=[start,next+1];
  const table=state.push('gallery_table_open','table',1);table.attrSet('role','presentation');table.attrSet('style','width:100%;table-layout:fixed;border:0;border-collapse:separate;border-spacing:0;background:transparent;margin:16px 0;');
  state.push('gallery_body_open','tbody',1);
  const columns=match[1]==='stack'?1:match[1]==='grid3'?3:2;
  for(let i=0;i<rows.length;){
    state.push('gallery_row_open','tr',1);
    const count=match[1]==='featured'&&i===0?1:columns;
    for(let j=0;j<count&&i<rows.length;j++,i++){
      const cell=state.push('gallery_cell_open','td',1);cell.attrSet('style',`width:${100/count}%;vertical-align:top;border:0;background:transparent;padding:4px;color:inherit;`);if(count===1&&columns>1)cell.attrSet('colspan',String(columns));
      const item=state.push('inline','',0);item.content=rows[i].text;item.children=[];item.map=[rows[i].line,rows[i].line+1];state.push('gallery_cell_close','td',-1);
    }
    state.push('gallery_row_close','tr',-1);
  }
  state.push('gallery_body_close','tbody',-1);state.push('gallery_table_close','table',-1);state.push('gallery_close','section',-1);state.line=next+1;return true;
});
md.core.ruler.after('inline','source_lines',state=>{
  let line=0;
  for(const token of state.tokens){
    if(token.map)line=token.map[0];
    if(token.map&&(token.nesting===1||token.type==='fence'||token.type==='code_block'||token.type==='hr')){
      token.attrSet('data-line',String(token.map[0]));token.attrSet('data-end',String(token.map[1]));
    }
    for(const child of token.children||[])child.meta={...child.meta,line};
  }
});
function mathHTML(source:string,display:boolean,line:number,env:any){
  const result=renderMath(source,display,env.equationNumber||0);
  if(!result.error)env.equationNumber=result.nextNumber??env.equationNumber;
  if(result.error){env.errors.push({line:line+1,message:result.error});return `<span class="math-error" data-line="${line}" title="第 ${line+1} 行：${escapeHTML(result.error)}">${escapeHTML(source)}<br>公式错误：${escapeHTML(result.error)}</span>`;}
  return `<${display?'section':'span'} class="math-${display?'display':'inline'}" data-tex="${escapeHTML(source)}" data-line="${line}">${result.html}</${display?'section':'span'}>`;
}
md.renderer.rules.math_inline=(ts,i,_o,env)=>mathHTML(ts[i].meta?.mathBold?`\\boldsymbol{${ts[i].content}}`:ts[i].content,false,ts[i].meta?.line||0,env);
md.renderer.rules.math_block=(ts,i,_o,env)=>mathHTML(ts[i].content,true,ts[i].map?.[0]||0,env);
md.renderer.rules.image=(ts,i,_o,env)=>{
  const t=ts[i],src=t.attrGet('src')||'',alt=t.content||'';
  let url=src,caption=t.attrGet('title')||'',width=100,align='center',assetId='';
  let figureLabel='',source='';
  if(src.startsWith('asset:')) {
    assetId=src.slice(6);const asset:Asset|undefined=env.assets.get(assetId);
    if(!asset){env.missing.push(src);return `<span class="missing-image">图片缺失：${escapeHTML(alt||src)}</span>`;}
    url=asset.data;caption=asset.caption||caption;width=asset.width;align=asset.align;
    figureLabel=asset.figureLabel||'';source=asset.source||'';
  } else if(/^https?:\/\//i.test(src))env.external.push(src);
  else if(!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(src)){
    env.missing.push(src);return `<span class="missing-image">请通过「图片」添加本地图片：${escapeHTML(alt||src)}</span>`;
  }
  const description=[figureLabel,caption].filter(Boolean).join(' · ');
  return `<span class="image-wrap" data-asset="${assetId}" data-source="${escapeHTML(src)}" style="text-align:${align}"><img src="${escapeHTML(url)}" alt="${escapeHTML(alt||env.assets.get(assetId)?.alt||'')}" style="width:${width}%;max-width:100%" loading="eager">${description?`<span class="image-caption" style="display:block;text-indent:0">${escapeHTML(description)}</span>`:''}${source?`<span class="image-source" style="display:block;text-indent:0">来源：${escapeHTML(source)}</span>`:''}</span>`;
};
const originalFence=md.renderer.rules.fence!;
md.renderer.rules.fence=(ts,i,o,env,self)=>originalFence(ts,i,o,env,self).replace('<pre',`<pre data-line="${ts[i].map?.[0]||0}" data-end="${ts[i].map?.[1]||0}"`);
installInlineStyles(md);
installTextMapping(md);
md.core.ruler.after('text_join','math_text_styles',state=>{
  for(const block of state.tokens){const stack:boolean[]=[];let bold=0;
    for(const token of block.children||[]){
      if(token.nesting===1){const active=token.type==='strong_open'||(token.type==='text_style_open'&&/font-weight:700/.test(token.attrGet('style')||''));stack.push(active);if(active)bold++;}
      else if(token.nesting===-1){if(stack.pop())bold--;}
      else if(token.type==='math_inline'&&bold)token.meta={...token.meta,mathBold:true};
    }
  }
});
export function renderMarkdown(source:string,assets:Map<string,Asset>,editable=false):RenderResult{
  const env={assets,editable,source,equationNumber:0,errors:[] as RenderResult['errors'],missing:[] as string[],external:[] as string[]};
  const raw=md.render(source,env);
  const html=DOMPurify.sanitize(raw,{ADD_TAGS:['mjx-container'],ADD_ATTR:['xmlns','display','focusable'],FORBID_TAGS:['script','iframe','object','embed','foreignObject'],ALLOW_DATA_ATTR:true});
  return {html,errors:env.errors,missing:[...new Set(env.missing)],external:[...new Set(env.external)]};
}
export function firstArticleHeading(source:string):string|null{
  const tokens=md.parse(source,{});
  const heading=tokens.findIndex(t=>t.type==='heading_open'&&t.tag==='h1'&&t.level===0);
  if(heading<0)return null;
  const text=(tokens[heading+1]?.children||[]).filter(t=>['text','code_inline','math_inline','image'].includes(t.type)).map(t=>t.content).join('').trim();
  return text||null;
}

const copiedProperties=['color','background-color','font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-align','text-indent','text-decoration','white-space','word-break','overflow-wrap','vertical-align','display','float','clear','text-wrap','margin-top','margin-bottom','margin-left','margin-right','padding-top','padding-bottom','padding-left','padding-right','border-top','border-bottom','border-left','border-right','border-radius','box-shadow','outline','background-image','background-size','background-position','background-repeat','opacity','border-collapse','table-layout','max-width','list-style-type','box-sizing'];
export function exportFragment(article:HTMLElement):string{
  const clone=article.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.classList.remove('text-editing');
  const originals=[article,...article.querySelectorAll<HTMLElement>('*')];
  const copies=[clone,...clone.querySelectorAll<HTMLElement>('*')];
  originals.forEach((el,i)=>{
    const target=copies[i];
    if(el.namespaceURI!=='http://www.w3.org/2000/svg'){
      const cs=getComputedStyle(el);
      for(const p of copiedProperties)target.style.setProperty(p,cs.getPropertyValue(p));
      // Responsive widths are kept relative; never freeze all paragraphs to preview pixel widths.
      if(['TABLE','IMG','SVG'].includes(el.tagName))target.style.maxWidth='100%';
      if(el.tagName==='TABLE')target.style.width='100%';
      if(el.tagName==='MJX-CONTAINER') {target.style.height='auto';target.style.maxWidth='100%';}
    }
    // MathJax SVG roots live in the SVG namespace, so the HTML style loop
    // above deliberately skips them. Retain responsive sizing in every export.
    if(el.tagName.toLowerCase()==='svg'){target.style.maxWidth='100%';target.style.height='auto';}
    for(const attr of [...target.attributes])if(attr.name.startsWith('data-')||['contenteditable','loading'].includes(attr.name))target.removeAttribute(attr.name);
  });
  clone.style.width='100%';clone.style.maxWidth='100%';clone.style.margin='0';
  clone.querySelectorAll('.footnote-backref').forEach(el=>el.remove());
  clone.querySelectorAll('.sticker-handle').forEach(el=>el.remove());
  clone.querySelectorAll('.sticker-item').forEach(el=>{el.classList.remove('selected');el.removeAttribute('tabindex');el.removeAttribute('role');});
  clone.querySelectorAll('.preview-text-run').forEach(el=>{
    if(el.matches('.journal-initial,.magazine-initial,.text-initial'))el.classList.remove('preview-text-run');
    else el.replaceWith(...el.childNodes);
  });
  // Publication has no fixed-height reading windows: export every derivation,
  // even when its on-screen disclosure was closed.
  clone.querySelectorAll<HTMLElement>('.journal-derivation').forEach(el=>{
    const section=document.createElement('section');for(const attr of [...el.attributes])if(attr.name!=='open')section.setAttribute(attr.name,attr.value);
    const summary=el.querySelector(':scope > summary');if(summary){const header=document.createElement('header');for(const attr of [...summary.attributes])header.setAttribute(attr.name,attr.value);header.style.display='block';header.style.listStyleType='none';header.append(...summary.childNodes);summary.replaceWith(header);}
    section.append(...el.childNodes);section.style.overflow='visible';section.style.maxHeight='none';
    const content=section.querySelector<HTMLElement>(':scope > .journal-content');if(content){content.style.maxHeight='none';content.style.height='auto';content.style.overflow='visible';content.style.display='block';}
    el.replaceWith(section);
  });
  // Inline styles are authoritative, so no dependency on editor CSS remains.
  return clone.outerHTML;
}
