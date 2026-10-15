import type MarkdownIt from 'markdown-it';
import {containerEnd,registerContainers} from './container-scan';
export const editionCatalog={
 digest:{masthead:'拾光漫读',category:'人物 · 世相',byline:'',note:'卷首手记 · EDITOR’S NOTE',polaroid:'',stories:'微故事 · 向右翻一页',story:'一则故事',quote:'摘抄本',epiphany:'文摘漫评 · 火柴盒点睛',footer:'补白 · 读者微语'},
 press:{masthead:'COVER STORY · 封面特稿',deck:'',byline:'',brief:'30-SECOND EXECUTIVE BRIEF · 核心提要',photo:'',photos:'现场图集',pullquote:'',data:'DATA JOURNALISM · 数据观察',timeline:'CHRONOLOGY · 事件脉络',event:'事件',keyevent:'关键转折',interview:'HARDTALK INTERVIEW · 现场交锋',q:'记者',a:'受访者',dossier:'名词深读档案'},
 gewu:{masthead:'格物文史 · 专题长文',tags:'',byline:'',preface:'卷首导读',quote:'史料实录',poetry:'诗词与科学共读',analysis:'文史赏析',equation:'物理模型推导',symbols:'符号释义',knowledge:'知新匣 · 原理解析',figure:'',aside:'格物边注',timeline:'古今交响 · 跨学科脉络',event:'事件',"event-gold":'事件',"event-blue":'事件',caption:'',colophon:'格物文史 · 寻绎字里行间的科学律令'}
} as const;
export type Edition=keyof typeof editionCatalog;
export const editionTitles:Record<Edition,string>={digest:'青年文摘风 · 红枫暖刊',press:'深度新闻周刊',gewu:'格物文史'};
const definitions=new Map(Object.entries(editionCatalog).flatMap(([group,kinds])=>Object.entries(kinds).map(([kind,title])=>[group+'-'+kind,{group,kind,title}])));
export function installEditionBlocks(md:MarkdownIt){
 registerContainers(definitions.keys());
 md.block.ruler.before('fence','edition_block',(state,start,end,silent)=>{
  if(state.sCount[start]-state.blkIndent>=4)return false;
  const raw=state.src.slice(state.bMarks[start]+state.tShift[start],state.eMarks[start]),m=/^:::([a-z]+-[a-z-]+)(?:\s+(.*))?$/.exec(raw),d=m&&definitions.get(m[1]);if(!m||!d)return false;
  const next=containerEnd(state,start,end);if(next>=end)return false;if(silent)return true;
  const tag=m[1]==='press-dossier'?'details':'section',open=state.push('edition_open',tag,1);open.map=[start,next+1];open.attrs=[['class','edition-block '+m[1]]];if(tag==='details')open.attrSet('open','');
  const title=m[2]??d.title;
  if(title){const header=state.push('edition_title_open',tag==='details'?'summary':'header',1);header.attrSet('class','edition-title');const text=state.push('inline','',0);text.content=title;text.children=[];if(m[2])text.map=[start,start+1];state.push('edition_title_close',header.tag,-1);}
  state.push('edition_body_open','section',1).attrSet('class','edition-content');
  const parent=state.parentType,max=state.lineMax;state.parentType='root';state.lineMax=next;
  try{state.md.block.tokenize(state,start+1,next);}finally{state.parentType=parent;state.lineMax=max;}
  state.push('edition_body_close','section',-1);state.push('edition_close',tag,-1);state.line=next+1;return true;
 },{alt:['paragraph','reference','blockquote','list']});
}
export function flattenEditionBlocks(node:HTMLElement){
 for(const box of [...node.querySelectorAll<HTMLElement>('.edition-block')].reverse()){
  const header=box.querySelector(':scope > .edition-title'),body=box.querySelector(':scope > .edition-content');if(!body)continue;
  const title=document.createElement('h3');if(header)title.append(...header.childNodes);
  box.replaceWith(...(title.textContent?[title]:[]),...body.childNodes);
 }
}
