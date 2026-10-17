import {journalKinds} from './journal-blocks';
import {folioNames} from './folio-blocks';
import {editionCatalog} from './edition-blocks';
const names=new Set([...journalKinds,...Object.keys(folioNames).map(k=>'folio-'+k),...Object.entries(editionCatalog).flatMap(([group,parts])=>Object.keys(parts).map(k=>group+'-'+k))]);
export function inspectComponentStructure(source:string){
  if(!/^\s*(?:>\s*)*:::/m.test(source))return [];
  const stack:{name:string;line:number}[]=[],lines=source.split('\n');let opaque=false,math=false,fence='',fenceLength=0;
  for(let i=0;i<lines.length;i++){
    const raw=lines[i].replace(/^(?: {0,3}> ?)+/,''),text=raw.trim(),code=/^(`{3,}|~{3,})(.*)$/.exec(text);
    if(opaque){if(text===':::'){opaque=false;stack.pop();}continue;}
    if(math){if(text.includes('$$'))math=false;continue;}
    if(fence){if(code&&code[1][0]===fence&&code[1].length>=fenceLength&&!code[2].trim())fence='';continue;}
    if(/^(?: {4}|\t)/.test(raw))continue;
    if(code&&(code[1][0]!=='`'||!code[2].includes('`'))){fence=code[1][0];fenceLength=code[1].length;continue;}
    if(text.startsWith('$$')){if(text.length<4||!text.endsWith('$$'))math=true;continue;}
    if(text===':::'){stack.pop();continue;}
    const open=/^:::([a-z][\w-]*)(?:\s|$)/.exec(text);if(!open)continue;
    const special=/^:::(?:poem(?:\s+(?:left|center))?|gallery\s+(?:stack|grid2|grid3|featured)\s+[\w-]+)$/.test(text);
    if(names.has(open[1])||special){stack.push({name:open[1],line:i+1});opaque=special;}
  }
  return stack.slice(0,80).map(({name,line})=>({line,title:'组件缺少结束标记',detail:`第 ${line} 行的 :::${name} 尚未闭合，请在内容末尾补上一行 :::。原文不会自动修改。`}));
}
