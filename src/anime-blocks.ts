import type MarkdownIt from 'markdown-it';
import {containerEnd,registerContainers} from './container-scan';

export const animeCatalog={banner:'',meta:'',tags:'',quote:'台词摘录 / 设定手札',chat:'小剧场',left:'',right:'',figure:'',panels:'分镜手记',panel:'',equation:'公式手札',note:'',profile:'设定档案',spoiler:'彩蛋手记',footer:''} as const;
export type AnimeKind=keyof typeof animeCatalog;
export const animeTags=Object.keys(animeCatalog).map(k=>'anime-'+k);
export function installAnimeBlocks(md:MarkdownIt){
 registerContainers(animeTags);
 md.block.ruler.before('fence','anime_block',(state,start,end,silent)=>{
  if(state.sCount[start]-state.blkIndent>=4)return false;
  const raw=state.src.slice(state.bMarks[start]+state.tShift[start],state.eMarks[start]),m=/^:::anime-([a-z]+)(?:\s+(.*))?$/.exec(raw);
  if(!m||!Object.hasOwn(animeCatalog,m[1]))return false;
  const next=containerEnd(state,start,end);if(next>=end)return false;if(silent)return true;
  const kind=m[1] as AnimeKind,open=state.push('anime_open','section',1);open.map=[start,next+1];open.attrSet('class','anime-block anime-'+kind);
  const title=m[2]??animeCatalog[kind];
  if(title){state.push('anime_title_open','header',1).attrSet('class','anime-title');const text=state.push('inline','',0);text.content=title;text.children=[];if(m[2]){text.map=[start,start+1];text.meta={sourceFrom:state.bMarks[start]+state.tShift[start]+raw.length-m[2].length};}state.push('anime_title_close','header',-1);}
  state.push('anime_body_open','section',1).attrSet('class','anime-content');
  const parent=state.parentType,max=state.lineMax;state.parentType='root';state.lineMax=next;
  try{state.md.block.tokenize(state,start+1,next);}finally{state.parentType=parent;state.lineMax=max;}
  state.push('anime_body_close','section',-1);state.push('anime_close','section',-1);state.line=next+1;return true;
 },{alt:['paragraph','reference','blockquote','list']});
}
export function flattenAnimeBlocks(node:HTMLElement){
 for(const box of [...node.querySelectorAll('.anime-block')].reverse()){
  const title=box.querySelector(':scope > .anime-title'),body=box.querySelector(':scope > .anime-content');if(!body)continue;
  const heading=document.createElement('h3');if(title)heading.append(...title.childNodes);
  box.replaceWith(...(heading.textContent?[heading]:[]),...body.childNodes);
 }
}
