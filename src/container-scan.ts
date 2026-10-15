import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';
const kinds=new Set<string>();
export function registerContainers(names:Iterable<string>){for(const name of names)kinds.add(name);}
export function containerEnd(state:StateBlock,start:number,end:number){
  const line=(n:number)=>state.src.slice(state.bMarks[n]+state.tShift[n],state.eMarks[n]).trim();
  let depth=1,fence='',fenceLength=0,opaque=false;
  for(let next=start+1;next<end;next++){
    const value=line(next),code=/^(`{3,}|~{3,})/.exec(value);
    if(opaque){if(value===':::'){opaque=false;depth--;}continue;}
    if(fence){if(code&&code[1][0]===fence&&code[1].length>=fenceLength&&!value.slice(code[1].length).trim())fence='';continue;}
    if(state.sCount[next]-state.blkIndent>=4)continue;
    if(code){fence=code[1][0];fenceLength=code[1].length;continue;}
    if(/^:::(?:poem(?:\s+(?:left|center))?|gallery\s+(?:stack|grid2|grid3|featured)\s+[\w-]+)$/.test(value)){opaque=true;depth++;continue;}
    const opening=/^:::([a-z][\w-]*)(?:\s|$)/.exec(value);
    if(opening&&kinds.has(opening[1]))depth++;
    else if(value===':::'&&!--depth)return next;
  }
  return end;
}
