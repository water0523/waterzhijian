import type MarkdownIt from 'markdown-it';
import {containerEnd,registerContainers} from './container-scan';

export const workshopBlocks={
  lead:'导语摘要',toc:'目录导航',tip:'实用提示',note:'知识补充',warning:'避坑警告',
  kpi:'数据指标',figure:'配图与图注',steps:'步骤流程',timeline:'时间轴',compare:'双栏对比',
  gallery:'双图画廊',dialogue:'问答对话',checklist:'要点清单',poster:'金句海报',
  references:'参考资料',author:'作者名片',recommend:'往期推荐',footer:'文末引导',item:'单项卡片'
} as const;
export type WorkshopBlock=keyof typeof workshopBlocks;
export const workshopTags=Object.keys(workshopBlocks).map(kind=>'workshop-'+kind);
export const workshopColumns=['kpi','compare','gallery'] as const;

export function workshopComponent(kind:WorkshopBlock,body:string,title=''){
  return ':::workshop-'+kind+(title?' '+title:'')+'\n'+body+'\n:::';
}

export function installWorkshopBlocks(md:MarkdownIt){
  registerContainers(workshopTags);
  md.block.ruler.before('fence','workshop_block',(state,start,end,silent)=>{
    if(state.sCount[start]-state.blkIndent>=4)return false;
    const line=state.src.slice(state.bMarks[start]+state.tShift[start],state.eMarks[start]);
    const opening=/^:::workshop-([a-z]+)(?:[ \t]+(.*))?[ \t]*$/.exec(line);
    if(!opening||!Object.hasOwn(workshopBlocks,opening[1]))return false;
    const next=containerEnd(state,start,end);
    if(next>=end)return false;
    if(silent)return true;

    const [,kind,title]=opening;
    const box=state.push('workshop_open','section',1);
    box.map=[start,next+1];
    box.attrSet('class','workshop-block workshop-'+kind);
    if(title?.trim()){
      state.push('workshop_title_open','header',1).attrSet('class','workshop-title');
      const label=state.push('inline','',0);
      label.content=title.trim();
      label.children=[];
      label.map=[start,start+1];
      state.push('workshop_title_close','header',-1);
    }
    state.push('workshop_body_open','section',1).attrSet('class','workshop-content');
    const parent=state.parentType,lineMax=state.lineMax;
    state.parentType='root';
    state.lineMax=next;
    try{state.md.block.tokenize(state,start+1,next);}
    finally{state.parentType=parent;state.lineMax=lineMax;}
    state.push('workshop_body_close','section',-1);
    state.push('workshop_close','section',-1);
    state.line=next+1;
    return true;
  },{alt:['paragraph','reference','blockquote','list']});
}

export function flattenWorkshopBlocks(node:HTMLElement){
  for(const box of [...node.querySelectorAll('.workshop-block')].reverse()){
    const header=box.querySelector(':scope > .workshop-title');
    const body=box.querySelector(':scope > .workshop-content');
    if(!body)continue;
    const title=document.createElement('h3');
    if(header)title.append(...header.childNodes);
    box.replaceWith(...(title.textContent?[title]:[]),...body.childNodes);
  }
}
