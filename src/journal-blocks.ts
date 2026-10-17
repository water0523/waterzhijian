import type MarkdownIt from 'markdown-it';
import {containerEnd,registerContainers} from './container-scan';
const names={abstract:'CORE ABSTRACT · 科学导读',theorem:'核心定律',equation:'',derivation:'数学物理推导专栏',takeaways:'本文核心要点回顾',references:'REFERENCES & FURTHER READING · 参考文献'};
export const journalKinds=Object.keys(names) as (keyof typeof names)[];

export function installJournalBlocks(md:MarkdownIt){
  registerContainers(journalKinds);
  md.block.ruler.before('fence','journal_subtitle',(state,start,_end,silent)=>{
    if(state.sCount[start]-state.blkIndent>=4)return false;
    const raw=state.src.slice(state.bMarks[start]+state.tShift[start],state.eMarks[start]),m=/^:::subtitle\s+(.+)$/.exec(raw);if(!m)return false;if(silent)return true;
    const open=state.push('journal_subtitle_open','span',1);open.block=false;open.attrSet('class','journal-subtitle');open.map=[start,start+1];
    const text=state.push('inline','',0);text.content=m[1];text.children=[];text.map=[start,start+1];state.push('journal_subtitle_close','span',-1).block=false;state.line=start+1;return true;
  },{alt:['paragraph']});
  md.block.ruler.before('fence','journal_block',(state,start,end,silent)=>{
    if(state.sCount[start]-state.blkIndent>=4)return false;
    const line=(n:number)=>state.src.slice(state.bMarks[n]+state.tShift[n],state.eMarks[n]);
    const match=/^:::(abstract|theorem|equation|derivation|takeaways|references)(?:\s+(.*))?$/.exec(line(start));if(!match)return false;
    const next=containerEnd(state,start,end);
    if(next>=end)return false;if(silent)return true;
    const kind=match[1] as keyof typeof names,tag=kind==='derivation'?'details':'section';
    const open=state.push('journal_open',tag,1);open.block=true;open.map=[start,next+1];open.attrs=[['class','journal-block journal-'+kind]];if(tag==='details')open.attrSet('open','');
    const header=state.push('journal_title_open',tag==='details'?'summary':'header',1);header.attrSet('class','journal-block-title');
    if(kind==='equation'&&!match[2]){state.push('journal_equation_number','span',0).block=false;}
    else {const title=state.push('inline','',0);title.content=match[2]||names[kind];title.children=[];if(match[2])title.map=[start,start+1];}
    state.push('journal_title_close',header.tag,-1);
    const body=state.push('journal_body_open','section',1);body.attrSet('class','journal-content');
    const oldParent=state.parentType,oldMax=state.lineMax;state.parentType='root';state.lineMax=next;
    try{state.md.block.tokenize(state,start+1,next);}finally{state.parentType=oldParent;state.lineMax=oldMax;}
    state.push('journal_body_close','section',-1);state.push('journal_close',tag,-1);state.line=next+1;return true;
  },{alt:['paragraph','reference','blockquote','list']});
  const heading=md.renderer.rules.heading_open;
  md.renderer.rules.heading_open=(tokens,i,o,env,self)=>{
    if(tokens[i].tag==='h2'&&tokens[i].level===0){env.journalSection=(env.journalSection||0)+1;env.journalEquation=0;}
    return heading?heading(tokens,i,o,env,self):self.renderToken(tokens,i,o);
  };
  md.renderer.rules.journal_equation_number=(_tokens,_i,_o,env)=>env.equationNumbers?'':`(式 ${env.journalSection||0}.${env.journalEquation=(env.journalEquation||0)+1})`;
  // The article-wide TeX tags replace only generated component numbers;
  // user-written component titles stay intact.
  for(const [type,offset] of [['journal_title_open',1],['journal_title_close',-1]] as const){
    md.renderer.rules[type]=(tokens,i,_o,env,self)=>env.equationNumbers&&tokens[i+offset]?.type==='journal_equation_number'?'':self.renderToken(tokens,i,_o);
  }
}

// Standard documents retain headings, paragraphs and lists without themed boxes.
export function flattenJournalBlocks(node:HTMLElement){
  for(const block of [...node.querySelectorAll<HTMLElement>('.journal-block')].reverse()){
    const header=block.querySelector<HTMLElement>(':scope > .journal-block-title'),body=block.querySelector<HTMLElement>(':scope > .journal-content');
    if(!body)continue;
    const label=document.createElement(block.classList.contains('journal-equation')?'p':'h3');if(header)label.append(...header.childNodes);
    block.replaceWith(...(label.textContent?[label]:[]),...body.childNodes);
  }
}
