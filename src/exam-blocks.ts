import type MarkdownIt from 'markdown-it';
import {containerEnd,registerContainers} from './container-scan';
export const examKinds=['meta','info','notice','passage','question','options','answer','key','analysis'] as const;
export const examTags=examKinds.map(k=>'exam-'+k);
export function installExamBlocks(md:MarkdownIt){
  registerContainers(examTags);
  md.block.ruler.before('fence','exam_block',(state,start,end,silent)=>{
    if(state.sCount[start]-state.blkIndent>=4)return false;
    const raw=state.src.slice(state.bMarks[start]+state.tShift[start],state.eMarks[start]);
    if(/^:::exam-pagebreak\s*$/.test(raw)){
      if(silent)return true;
      const token=state.push('exam_pagebreak','section',0);token.map=[start,start+1];state.line=start+1;return true;
    }
    const match=/^:::exam-(meta|info|notice|passage|question|options|answer|key|analysis)(?:\s+(.*))?$/.exec(raw);if(!match)return false;
    const next=containerEnd(state,start,end);if(next>=end)return false;if(silent)return true;
    const kind=match[1],argument=match[2]||'',open=state.push('exam_open','section',1);open.map=[start,next+1];open.attrs=[['class','exam-block exam-'+kind]];
    if(kind==='options')open.attrSet('data-exam-columns',['1','2','4'].includes(argument)?argument:'2');
    if(kind==='answer')open.attrSet('data-exam-lines',/^(?:[1-9]|1[0-2])$/.test(argument)?argument:'3');
    if(argument&&!['options','answer'].includes(kind)){
      const title=state.push('exam_title_open','div',1);title.attrSet('class','exam-title');
      const text=state.push('inline','',0);text.content=argument;text.children=[];text.map=[start,start+1];state.push('exam_title_close','div',-1);
    }
    state.push('exam_body_open','section',1).attrSet('class','exam-content');
    const parent=state.parentType,max=state.lineMax;state.parentType='root';state.lineMax=next;
    try{state.md.block.tokenize(state,start+1,next);}finally{state.parentType=parent;state.lineMax=max;}
    if(kind==='answer'){
      const lines=state.push('exam_answer_lines','',0);lines.meta={count:/^(?:[1-9]|1[0-2])$/.test(argument)?Number(argument):3};
    }
    state.push('exam_body_close','section',-1);state.push('exam_close','section',-1);state.line=next+1;return true;
  },{alt:['paragraph','reference','blockquote','list']});
  md.renderer.rules.exam_answer_lines=(ts,i)=>Array.from({length:ts[i].meta.count},()=>'<p class="exam-answer-line">&nbsp;</p>').join('');
  md.renderer.rules.exam_pagebreak=(ts,i)=>`<section class="exam-pagebreak" data-line="${ts[i].map?.[0]||0}" role="separator" aria-label="分页"></section>`;
}
// Use table cells rather than CSS grid so publication copies keep the option
// columns. Preserve the inline nodes and source mapping for every option.
export function layoutExamOptions(root:HTMLElement){
  for(const block of root.querySelectorAll<HTMLElement>('.exam-options')){
    const list=block.querySelector(':scope > .exam-content > ul');if(!list)continue;
    const columns=Number(block.dataset.examColumns)||2,table=document.createElement('table');table.className='exam-options-table';table.setAttribute('role','presentation');
    const body=document.createElement('tbody');table.append(body);let row:HTMLTableRowElement;
    [...list.children].forEach((li,i)=>{if(i%columns===0){row=document.createElement('tr');body.append(row);}const cell=document.createElement('td');for(const attr of [...li.attributes])cell.setAttribute(attr.name,attr.value);cell.style.width=100/columns+'%';cell.append(...li.childNodes);row!.append(cell);});
    list.replaceWith(table);
  }
}
export function flattenExamBlocks(root:HTMLElement){
  for(const block of [...root.querySelectorAll<HTMLElement>('.exam-block')].reverse()){
    const title=block.querySelector(':scope > .exam-title'),body=block.querySelector(':scope > .exam-content');if(!body)continue;
    const label=document.createElement('p');if(title)label.append(...title.childNodes);
    if(block.classList.contains('exam-meta')){label.className='exam-center';body.querySelectorAll(':scope > p').forEach(p=>p.classList.add('exam-center'));}
    if(block.classList.contains('exam-passage'))body.querySelectorAll('p,li,td,th').forEach(p=>p.classList.add('exam-reading'));
    if(block.classList.contains('exam-question'))label.className='exam-question-heading';
    if(block.classList.contains('exam-key')){label.classList.add('exam-key-text');body.querySelectorAll('p,li,td,th').forEach(p=>p.classList.add('exam-key-text'));}
    if(block.classList.contains('exam-analysis')){label.classList.add('exam-analysis-text');body.querySelectorAll('p,li,td,th').forEach(p=>p.classList.add('exam-analysis-text'));}
    block.replaceWith(...(label.textContent?[label]:[]),...body.childNodes);
  }
}
export function normalizeExamPublication(root:HTMLElement){
  if(root.classList.contains('exam-paper')){root.style.boxShadow='none';root.style.outline='0';root.style.border='0';}
  for(const line of root.querySelectorAll<HTMLElement>('.exam-pagebreak')){line.style.breakBefore='page';line.style.pageBreakBefore='always';line.style.border='0';line.style.margin='0';line.style.height='0';}
  for(const question of root.querySelectorAll<HTMLElement>('.exam-question,.exam-answer-line')){question.style.breakInside='avoid';question.style.pageBreakInside='avoid';}
  for(const title of root.querySelectorAll<HTMLElement>('.exam-title'))title.style.breakAfter='avoid';
}
