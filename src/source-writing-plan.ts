import {mappedInlineTokens,sourceBlockTokens} from './render';
import type {BlockEdit} from './block-format-plan';
export interface WritingPlan{changes:BlockEdit[];selection?:{anchor:number;head:number};reveal?:boolean;message?:string;error?:string}
const fail=(error:string):WritingPlan=>({changes:[],error});
function context(source:string){
 const rows=source.split('\n'),starts:number[]=[];let at=0;for(const row of rows){starts.push(at);at+=row.length+1;}
 const text=(line:number)=>rows[line]?.replace(/\r$/,'')||'',end=(line:number)=>starts[line]+text(line).length,eol=source.includes('\r\n')?'\r\n':'\n';
 const lineAt=(position:number)=>{let lo=0,hi=starts.length;while(lo<hi){const mid=(lo+hi)>>>1;if(starts[mid]<=position)lo=mid+1;else hi=mid;}return Math.max(0,lo-1);};
 const blocks=sourceBlockTokens(source),inline=mappedInlineTokens(source).flat(),range=(token:typeof blocks[number])=>({from:starts[token.map[0]],to:starts[token.map[1]]??source.length});
 // Markdown normalizes CRLF before inline mapping. Translate those offsets
 // back to the original source so pure plans also preserve Windows files.
 if(source.includes('\r\n')){const offsets:number[]=[];for(let i=0;i<source.length;i++){offsets.push(i);if(source[i]==='\r'&&source[i+1]==='\n')i++;}offsets.push(source.length);for(const token of inline){const r=token.meta?.protectedRange;if(r)token.meta={...token.meta,protectedRange:{from:offsets[r.from],to:offsets[r.to]}};if(token.meta?.editFrom!==undefined)token.meta={...token.meta,editFrom:offsets[token.meta.editFrom],editTo:offsets[token.meta.editTo]};}}
 const escaped=(position:number)=>{let n=0;while(position>0&&source[--position]==='\\')n++;return n%2===1;};
 const fence=(token:typeof blocks[number])=>{const a=token.map[0],b=token.map[1]-1,open=/^([ \t]*(?:>[ \t]*)*)(`{3,}|~{3,})(.*)$/.exec(text(a));if(!open)return null;const marker=open[2],closed=b>a&&new RegExp('^(?: {0,3}>[ \\t]?)* {0,3}'+marker[0]+'{'+marker.length+',}[ \\t]*$').test(text(b));return {a,b,open,marker,closed,from:starts[a],to:end(b),bodyFrom:starts[a+1]??end(a),bodyTo:closed?b===a+1?starts[b]:end(b-1):end(b)};};
 return {source,rows,starts,text,end,eol,lineAt,blocks,inline,range,escaped,fence};
}

/** Source-only plans: untouched content is never replaced or reserialized. */
export function codeWritingPlan(source:string,from:number,to:number,mode:'auto'|'inline'|'block'='auto'):WritingPlan{
 from=Math.max(0,Math.min(source.length,from));to=Math.max(from,Math.min(source.length,to));
 const c=context(source),selected=source.slice(from,to),spans=c.inline.filter(t=>t.type==='code_inline'&&t.meta?.protectedRange).map(t=>{const {from:a,to:b}=t.meta.protectedRange as {from:number;to:number},n=/^`+/.exec(source.slice(a,b))![0].length;let contentFrom=a+n,contentTo=b-n;const raw=source.slice(contentFrom,contentTo);if(raw.startsWith(' ')&&raw.endsWith(' ')&&!/^ +$/.test(raw)){contentFrom++;contentTo--;}return {from:a,to:b,contentFrom,contentTo};});
 const whole=(a:number,b:number)=>from<=a&&to>=b&&!source.slice(from,a).trim()&&!source.slice(b,to).trim();
 for(const token of c.blocks.filter(t=>t.type==='fence')){
  const range=c.range(token),f=c.fence(token);
  const intersects=from===to?from>=range.from&&from<=(f?.to??range.to):from<range.to&&to>range.from;
  if(intersects&&mode==='inline')return fail('这是代码块，请用代码块快捷键或在 Markdown 栏修改。');
  if(intersects&&c.blocks.some(t=>t.type==='list_item_open'&&t.level<token.level&&t.map[0]<=token.map[0]&&t.map[1]>=token.map[1]))return fail('代码块嵌套在列表内，请在 Markdown 栏调整，避免改变外层列表。');
  if(!f)continue;
  const inside=from>=f.from&&to<=f.to,body=from===f.bodyFrom&&to===f.bodyTo,complete=whole(f.from,f.to);
  if((inside||complete)&&mode!=='inline'){
   if(!complete&&!body)return fail('请选中完整代码块或全部代码行后取消格式。');
   if(!f.closed)return {changes:[{from:f.to,to:f.to,insert:c.eol+f.open[1]+f.marker}],message:'已补上代码块的结束围栏。'};
   if(f.b===f.a+1)return {changes:[{from:f.from,to:f.to,insert:''}]};
   return {changes:[{from:f.from,to:f.bodyFrom,insert:''},{from:f.bodyTo,to:f.to,insert:''}]};
  }
  if(intersects&&!complete&&!(from<=range.from&&to>=f.to))return fail('选区只包含代码块的一部分，请选择完整代码块。');
 }
 const existing=spans.find(s=>whole(s.from,s.to)||from===s.contentFrom&&to===s.contentTo||from===to&&from>s.from&&from<s.to);
 if(existing&&mode!=='block')return {changes:[{from:existing.from,to:existing.contentFrom,insert:''},{from:existing.contentTo,to:existing.to,insert:''}]};
 if(spans.some(s=>(from===to?from>s.from&&from<s.to:from<s.to&&to>s.from)&&!(from<=s.from&&to>=s.to)&&!(existing===s)))return fail('请选中完整行内代码或全部代码文字后取消格式。');
 const newBlock=mode==='block'||mode==='auto'&&selected.includes('\n');
 const blocked=c.blocks.find(t=>(['code_block','math_block','gallery_open','hr','decorative_divider'].includes(t.type)||newBlock&&['table_open','poem_open'].includes(t.type))&&(from===to?from>=c.range(t).from&&from<c.range(t).to:from<c.range(t).to&&to>c.range(t).from));
 if(blocked)return fail('此处属于代码、公式、表格或特殊区块，请在 Markdown 栏单独修改。');
 if(c.inline.some(t=>{const r=t.meta?.protectedRange;return t.type!=='code_inline'&&r&&(from===to?from>r.from&&from<r.to:from<r.to&&to>r.from)&&!(from<=r.from&&to>=r.to);}))return fail('选区只包含公式或图片的一部分，请选择完整元素或普通文字。');
 if(c.blocks.some(t=>t.type==='table_open'&&from<c.range(t).to&&to>c.range(t).from)){if([...selected.matchAll(/\|/g)].some(m=>!c.escaped(from+m.index!))||!c.inline.some(t=>t.type==='text'&&t.meta?.editFrom<to&&t.meta?.editTo>from))return fail('请只选择同一表格单元格中的文字，不要包含列分隔符。');}
 for(let row=c.lineAt(from);row<=c.lineAt(to>from&&source[to-1]==='\n'?to-1:to);row++)if(/^[ \t]*(?:>[ \t]*)*:::/.test(c.text(row)))return fail('选区包含组件边界，请只选择组件内部的文字。');
 if(mode==='inline'&&selected.includes('\n'))return fail('行内代码请选择一行文字；多行内容可使用代码块。');
 let a=from,b=to,outerFrom=from,outerTo=to;if(existing&&mode==='block'){a=existing.contentFrom;b=existing.contentTo;outerFrom=existing.from;outerTo=existing.to;}
 const value=source.slice(a,b)||'代码',block=mode==='block'||mode==='auto'&&value.includes('\n'),n=Math.max(block?3:1,...[...value.matchAll(/`+/g)].map(m=>m[0].length+1)),marker='`'.repeat(n),padding=!block&&(/^`|`$/.test(value)||value.startsWith(' ')&&value.endsWith(' ')&&!/^ +$/.test(value))?' ':'';
 const before=block?c.eol+c.eol+marker+c.eol:marker+padding,after=block?c.eol+marker+c.eol+c.eol:padding+marker;
 if(a===b)return {changes:[{from:outerFrom,to:outerTo,insert:before+value+after}],selection:{anchor:outerFrom+before.length,head:outerFrom+before.length+value.length},reveal:true};
 return {changes:[{from:outerFrom,to:a,insert:before},{from:b,to:outerTo,insert:after}],selection:{anchor:outerFrom+before.length,head:outerFrom+before.length+value.length}};
}

export function footnoteWritingPlan(source:string,from:number,to:number):WritingPlan{
 from=Math.max(0,Math.min(source.length,from));to=Math.max(from,Math.min(source.length,to));
 const c=context(source),protectedTypes=['fence','code_block','math_block','gallery_open','hr','decorative_divider'];
 const blocked=(point:number)=>c.blocks.some(t=>protectedTypes.includes(t.type)&&point>=c.range(t).from&&point<c.range(t).to)||c.inline.some(t=>{const r=t.meta?.protectedRange;return r&&point>r.from&&point<r.to;});
 const definitions:{id:string;from:number;to:number;bodyFrom:number;bodyTo:number}[]=[];
 for(let row=0;row<c.rows.length;row++){const text=c.text(row),m=/^([ \t]*(?:(?:>[ \t]*)|(?:(?:[-+*]|\d{1,9}[.)])[ \t]+))*)\[\^([^\]\s]+)\]:[ \t]*(.*)$/.exec(text);if(m&&!blocked(c.starts[row]+m[1].length))definitions.push({id:m[2],from:c.starts[row]+m[1].length,to:c.end(row),bodyFrom:c.end(row)-m[3].length,bodyTo:c.end(row)});}
 let point=to;if(from<to)point-=source.slice(from,to).match(/[ \t\r\n]+$/)?.[0].length||0;
 const definition=definitions.find(d=>point>=d.from&&point<=d.to),refs=[...source.matchAll(/\[\^([^\]\s]+)\]/g)].filter(m=>!c.escaped(m.index!)&&!blocked(m.index!));
 const ref=refs.find(m=>from===to?from>=m.index!&&from<=m.index!+m[0].length:from>=m.index!&&to<=m.index!+m[0].length),id=definition?.id||ref?.[1];
 if(id){const matches=definitions.filter(d=>d.id===id);if(matches.length>1)return fail('同名脚注定义有多处，请先在 Markdown 栏整理。');if(matches[0])return {changes:[],selection:{anchor:matches[0].bodyFrom,head:matches[0].bodyTo},reveal:true,message:'已定位脚注「'+id+'」，可直接修改选中的注释。'};}
 if(blocked(point)||/^[ \t]*(?:>[ \t]*)*:::/.test(c.text(c.lineAt(point))))return fail('代码、公式、图片和组件边界内不能插入脚注，请把光标放在正文中。');
 let linkDepth=0,inLink=false,plain=false;for(const t of c.inline){if(t.type==='link_open')linkDepth++;if(t.type==='link_close')linkDepth--;const a=t.meta?.editFrom,b=t.meta?.editTo;if(t.type==='text'&&a!==undefined&&point>=a&&point<=b&&(b-a===t.content.length||point===a||point===b)){if(linkDepth)inLink=true;else plain=true;}}
 if(inLink||!plain&&point!==c.end(c.lineAt(point)))return fail('请把光标放在正文文字或完整格式标记外，不要放在链接地址或 Markdown 标记内部。');
 for(const t of c.blocks){if(t.map[1]<c.rows.length-1)continue;if(t.type==='fence'&&!c.fence(t)?.closed||['poem_open','gallery_open'].includes(t.type)&&!/^\s*:::\s*$/.test(c.text(t.map[1]-1)))return fail('文末有未闭合的代码或特殊区块，请先补上结束标记再添加脚注。');}
 let label=id;if(!label){let number=1;const used=new Set([...source.matchAll(/\[\^([^\]\s]+)\]/g)].map(m=>m[1]));while(used.has(String(number)))number++;label=String(number);}
 const marker=id?'':'[^'+label+']',prefix=/(?:\r?\n){2}$/.test(source)?'':/\r?\n$/.test(source)?c.eol:c.eol+c.eol,body='脚注内容',append=prefix+'[^'+label+']: '+body,changes:BlockEdit[]=[];
 if(marker&&point===source.length)changes.push({from:point,to:point,insert:marker+append});else{if(marker)changes.push({from:point,to:point,insert:marker});changes.push({from:source.length,to:source.length,insert:append});}
 const head=source.length+marker.length+append.length;return {changes,selection:{anchor:head-body.length,head},reveal:true,message:id?'已补上脚注「'+label+'」的说明。':'脚注已插入，直接填写选中的注释内容。'};
}
