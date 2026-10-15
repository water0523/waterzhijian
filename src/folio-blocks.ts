import type MarkdownIt from 'markdown-it';
import {containerEnd,registerContainers} from './container-scan';
export const folioNames={
  masthead:'物候 · 山窗读画',preface:'卷首题记',byline:'',prose:'',ci:'词笺',scroll:'诗词选读',classical:'文言评点',gloss:'典故笺注与字词考据',modern:'阶梯诗笺',letter:'尺牍',hanging:'立轴 · 题画',handscroll:'手卷 · 四景',album:'双联册页',colophon:'古籍木记 · 牌记'
};
export type FolioKind=keyof typeof folioNames;
export function installFolioBlocks(md:MarkdownIt){
  registerContainers(Object.keys(folioNames).map(k=>'folio-'+k));
  md.block.ruler.before('fence','folio_block',(state,start,end,silent)=>{
    if(state.sCount[start]-state.blkIndent>=4)return false;
    const raw=state.src.slice(state.bMarks[start]+state.tShift[start],state.eMarks[start]);
    const match=/^:::folio-([a-z]+)(?:\s+(.*))?$/.exec(raw);if(!match||!Object.hasOwn(folioNames,match[1]))return false;
    const next=containerEnd(state,start,end);if(next>=end)return false;if(silent)return true;
    const kind=match[1] as FolioKind,tag=kind==='gloss'?'details':'section';
    const outer=state.push('folio_open',tag,1);outer.attrs=[['class','folio-block folio-'+kind]];outer.map=[start,next+1];if(tag==='details')outer.attrSet('open','');
    const title=match[2]??folioNames[kind];
    if(title){const header=state.push('folio_title_open',tag==='details'?'summary':'header',1);header.attrSet('class','folio-title');const text=state.push('inline','',0);text.content=title;text.children=[];if(match[2])text.map=[start,start+1];state.push('folio_title_close',header.tag,-1);}
    state.push('folio_body_open','section',1).attrSet('class','folio-content');
    const parent=state.parentType,max=state.lineMax;state.parentType='root';state.lineMax=next;
    try{state.md.block.tokenize(state,start+1,next);}finally{state.parentType=parent;state.lineMax=max;}
    state.push('folio_body_close','section',-1);state.push('folio_close',tag,-1);state.line=next+1;return true;
  },{alt:['paragraph','reference','blockquote','list']});
}
export function flattenFolioBlocks(node:HTMLElement){
  for(const box of [...node.querySelectorAll<HTMLElement>('.folio-block')].reverse()){
    const header=box.querySelector(':scope > .folio-title'),body=box.querySelector(':scope > .folio-content');if(!body)continue;
    const title=document.createElement('h3');if(header)title.append(...header.childNodes);
    box.replaceWith(...(title.textContent?[title]:[]),...body.childNodes);
  }
}
