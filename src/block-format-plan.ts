import {sourceBlockTokens} from './render';
export type BlockKind='quote'|'poem'|'h1'|'h2'|'h3'|'h4'|'h5'|'h6'|'paragraph'|'ordered'|'bullet';
export interface BlockEdit{from:number;to:number;insert:string}
export interface BlockPlan{changes:BlockEdit[];error?:string;selection?:{anchor:number;head:number}}
const columns=(s:string)=>{let n=0;for(const c of s)n+=c==='\t'?4-n%4:1;return n;};
function parts(text:string){const leading=text.match(/^[ \t]*(?:>[ \t]*)*/)?.[0]||'',at=leading.lastIndexOf('>'),end=at<0?0:at+1+(/[ \t]/.test(leading[at+1]||'')?1:0);return {quote:leading.slice(0,end),indent:leading.slice(end),body:text.slice(leading.length),prefix:leading};}

/** Produce source edits only. Rejected selections never partially change. */
export function blockFormatPlan(source:string,from:number,to:number,kind:BlockKind):BlockPlan{
 const rows=source.split('\n'),starts:number[]=[];let position=0;for(const row of rows){starts.push(position);position+=row.length+1;}
 const text=(i:number)=>rows[i]?.replace(/\r$/,'')??'',end=(i:number)=>starts[i]+text(i).length;
 const lineAt=(at:number)=>{let lo=0,hi=starts.length;while(lo<hi){const m=(lo+hi)>>>1;if(starts[m]<=at)lo=m+1;else hi=m;}return Math.max(0,lo-1);};
 from=Math.max(0,Math.min(source.length,from));to=Math.max(from,Math.min(source.length,to));let first=lineAt(from),last=lineAt(to>from&&source[to-1]==='\n'?to-1:to);const tokens=sourceBlockTokens(source),changes:BlockEdit[]=[];
 const headings=tokens.filter(t=>t.type==='heading_open'),items=tokens.filter(t=>t.type==='list_item_open'),lists=tokens.filter(t=>t.type==='ordered_list_open'||t.type==='bullet_list_open'),listMode=kind==='ordered'||kind==='bullet',eol=source.includes('\r\n')?'\r\n':'\n';
 const fail=(message:string):BlockPlan=>({changes:[],error:message});
 const prefixChange=(i:number,old:string,value:string)=>{if(old!==value)changes.push({from:starts[i],to:starts[i]+old.length,insert:value});};
 const headingAt=(i:number)=>headings.find(t=>t.map[0]<=i&&t.map[1]>i);
 const containingItem=(i:number)=>items.filter(t=>t.map[0]<=i&&t.map[1]>i).sort((a,b)=>b.level-a.level)[0];
 if(listMode&&from===to){const item=containingItem(first);if(item){first=item.map[0];last=item.map[1]-1;while(last>first&&!text(last).trim())last--;}}
 for(const h of headings)if(h.map[0]<=last&&h.map[1]>first){first=Math.min(first,h.map[0]);last=Math.max(last,h.map[1]-1);}
 const poem=tokens.find(t=>t.type==='poem_open'&&t.map[0]<=first&&t.map[1]>last);
 if(kind==='poem'&&poem){const a=poem.map[0],b=poem.map[1]-1,closed=parts(text(b)).body.trim()===':::';
  if(items.some(item=>item.level<poem.level&&item.map[0]<=a&&item.map[1]>b))return fail('这段诗歌嵌套在列表内，请在 Markdown 栏调整，避免改变外层列表。');
  if(closed&&(first===a&&last===b||first===a+1&&last===b-1)){
   if(b<=a+1)return {changes:[{from:starts[a],to:end(b),insert:''}]};
   return {changes:[{from:starts[a],to:starts[a+1],insert:''},{from:end(b-1),to:end(b),insert:''}]};
  }return fail('请选中完整诗歌或全部诗行后取消诗歌格式。');
 }
 const protectedNames:Record<string,string>={fence:'代码块',code_block:'缩进代码',math_block:'公式块',table_open:'表格',hr:'分割线',decorative_divider:'分割线',poem_open:'诗歌',gallery_open:'组图'};
 for(const token of tokens){const label=protectedNames[token.type];if(label&&token.map[0]<=last&&token.map[1]>first)return fail(`第 ${Math.max(first,token.map[0])+1} 行属于${label}，请单独选择正文或标题后转换。`);}
 for(let i=first;i<=last;i++){const p=parts(text(i)),body=p.body.replace(/^(?:[-+*]|\d{1,9}[.)])(?:[ \t]+|$)/,'');if(/^:::/.test(body))return fail(`第 ${i+1} 行是组件边界，请选择组件内部的普通段落。`);if(/^\[[^\]]+\]:/.test(body))return fail(`第 ${i+1} 行是链接或脚注定义，请在源码中单独修改。`);}
 if(kind==='quote'){
  const nonblank=rows.slice(first,last+1).filter(l=>l.trim()),remove=nonblank.length>0&&nonblank.every(l=>/^[ \t]*>/.test(l));
  for(let i=first;i<=last;i++){if(remove){const m=/^([ \t]*)> ?/.exec(text(i));if(m)changes.push({from:starts[i]+m[1].length,to:starts[i]+m[0].length,insert:''});}else changes.push({from:starts[i],to:starts[i],insert:'> '});}return {changes};
 }
 if(kind==='poem'){
  if(headings.some(h=>h.map[0]<=last&&h.map[1]>first)||items.some(t=>t.map[0]<=last&&t.map[1]>first)||rows.slice(first,last+1).some(l=>/^[ \t]*>/.test(l)))return fail('请只选择普通正文诗行，再转换为诗歌。');
  if(first===last&&!text(first)) {const body='第一行诗'+eol+'第二行诗',prefix=':::poem center'+eol;return {changes:[{from:starts[first],to:end(last),insert:prefix+body+eol+':::'}],selection:{anchor:starts[first]+prefix.length,head:starts[first]+prefix.length+body.length}};}
  return {changes:[{from:starts[first],to:starts[first],insert:':::poem center'+eol},{from:end(last),to:end(last),insert:eol+':::'}]};
 }
 // Interleaved list/quote markers need a container-aware prefix writer. Keep
 // these less common structures unchanged rather than flattening a quote.
 if(tokens.some(t=>t.type==='blockquote_open'&&t.map[0]<=last&&t.map[1]>first&&items.some(item=>item.level<t.level&&item.map[0]<=t.map[0]&&item.map[1]>=t.map[1])))return fail('选区包含列表内引用，请单独选择普通列表项，或在 Markdown 栏修改这段结构。');
 const setext=headings.filter(h=>h.markup[0]!=='#'&&h.map[0]<=last&&h.map[1]>first),underlines=new Set<number>();
 for(const h of setext){if(h.map[1]-h.map[0]>2&&kind!=='paragraph')return fail('这个下划线式标题包含多行，请先整理为单行后转换，原文已保留。');const row=h.map[1]-1;underlines.add(row);changes.push({from:end(row-1),to:end(row),insert:''});}
 const closeHeading=(i:number,body:string,contentFrom:number)=>{const m=/[ \t]+#+[ \t]*$/.exec(body);if(m){const at=Math.max(contentFrom,end(i)-m[0].length);if(at<end(i))changes.push({from:at,to:end(i),insert:''});}};
 if(!listMode){
  for(let i=first;i<=last;i++){if(underlines.has(i)||!text(i).trim())continue;const p=parts(text(i)),item=items.find(t=>t.map[0]===i),mark=item?/^(?:[-+*]|\d{1,9}[.)])(?:[ \t]+|$)/.exec(p.body)?.[0]||'':'',body=p.body.slice(mark.length),h=headingAt(i),atx=h?.map[0]===i?/^(#{1,6})(?:[ \t]+|$)/.exec(body):null,old=p.prefix+mark+(atx?.[0]||'');
   const value=kind==='paragraph'?'':atx&&atx[1].length===Number(kind[1])?atx[0]:'#'.repeat(Number(kind[1]))+' ';const keepMarker=kind!=='paragraph'&&mark&&!/[ \t]$/.test(mark)?mark+' ':mark;prefixChange(i,old,p.prefix+keepMarker+value);if(kind==='paragraph'&&atx)closeHeading(i,body,starts[i]+old.length);
  }
  if(first===last&&!text(first)&&kind!=='paragraph'){const prefix='#'.repeat(Number(kind[1]))+' ',name='新的章节';changes.push({from:starts[first],to:starts[first],insert:prefix+name});return {changes,selection:{anchor:starts[first]+prefix.length,head:starts[first]+prefix.length+name.length}};}
  return {changes:changes.sort((a,b)=>a.from-b.from||a.to-b.to)};
 }
 const selectedItems=items.filter(t=>t.map[0]>=first&&t.map[0]<=last),startsItem=new Map(selectedItems.map(t=>[t.map[0],t]));
 for(let i=first;i<=last;i++)if(text(i).trim()&&!underlines.has(i)){const owner=containingItem(i);if(owner&&owner.map[0]<first)return fail('请选中完整列表项（包括续行和子项）后转换。');}
 for(const item of selectedItems)if(rows.slice(last+1,item.map[1]).some(l=>l.trim()))return fail('选区只包含列表项的一部分，请同时选中它的续行和子项。');
 const eligible=[] as number[];for(let i=first;i<=last;i++)if(!underlines.has(i)&&(text(i).trim()||first===last)&&(!containingItem(i)||startsItem.has(i)))eligible.push(i);
 const markerAt=(i:number)=>startsItem.has(i)?/^(?:[-+*]|\d{1,9}[.)])(?:[ \t]+|$)/.exec(parts(text(i)).body)?.[0]||'':'';
 const remove=eligible.length>0&&eligible.every(i=>kind==='ordered'?/^\d/.test(markerAt(i)):/^[-+*]/.test(markerAt(i))),counters=new Map<string,number>(),newMarkers=new Map<number,string>(),deltas=new Map<number,number>(),plainPadding=new Map<number,string>(),plainStacks=new Map<string,{indent:number;padding:number;count:number;width:number}[]>();
 for(const i of eligible){const p=parts(text(i)),item=startsItem.get(i),container=item?lists.find(t=>t.level===item.level-1&&t.map[0]<=i&&t.map[1]>i):undefined;let n:number,plain:{indent:number;padding:number;count:number;width:number}|undefined;
  if(container){const key=container.type+':'+container.map[0]+':'+container.level;n=(counters.get(key)||0)+1;counters.set(key,n);}else{const stack=plainStacks.get(p.quote)||[];plainStacks.set(p.quote,stack);const indent=columns(p.indent);while(stack.length&&stack.at(-1)!.indent>indent)stack.pop();if(!stack.length||stack.at(-1)!.indent<indent){const parent=stack.at(-1);stack.push({indent,padding:parent?parent.padding+parent.width:indent,count:0,width:0});}plain=stack.at(-1)!;n=++plain.count;plainPadding.set(i,' '.repeat(plain.padding));}
  const next=remove?'':kind==='ordered'?`${n}. `:'- ';if(plain)plain.width=next.length;newMarkers.set(i,next);deltas.set(i,next.length-markerAt(i).length);
 }
 for(let i=first;i<=last;i++){
  if(underlines.has(i)||!text(i).trim()&&first!==last)continue;const p=parts(text(i)),oldMarker=markerAt(i);let indent=columns(p.indent),adjust=0;
  for(const item of selectedItems)if(item.map[0]<i&&item.map[1]>i){const parent=parts(text(item.map[0])),width=columns(parent.indent)+markerAt(item.map[0]).length;if(parent.quote===p.quote&&indent>=width)adjust+=deltas.get(item.map[0])||0;}
  const padding=plainPadding.get(i)??(adjust?' '.repeat(Math.max(0,indent+adjust)):p.indent),newMarker=newMarkers.get(i)??oldMarker,body=p.body.slice(oldMarker.length),h=headingAt(i),atx=!oldMarker&&h?.map[0]===i?/^#{1,6}(?:[ \t]+|$)/.exec(body)?.[0]||'':'';prefixChange(i,p.prefix+oldMarker+atx,p.quote+padding+newMarker);if(atx)closeHeading(i,body,starts[i]+p.prefix.length+atx.length);
 }
 return {changes:changes.sort((a,b)=>a.from-b.from||a.to-b.to)};
}
