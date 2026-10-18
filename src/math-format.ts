import {mappedInlineTokens} from './render';
import {syntaxTree} from '@codemirror/language';
import type {MarkdownEditor} from './editor';
import {hasSelectedStyle,toggleTextStyle} from './formatting';
import type {InlineStyle} from './inline-style';

export function mathAt(source:string,from:number,to:number){
  for(let p=0;p<source.length;){
    if(source[p]==='\\'){p+=2;continue;}
    if(source[p]==='`'||(source[p]==='~'&&(p===0||source[p-1]==='\n')&&source.slice(p,p+3)==='~~~')){
      let n=p+1;while(source[n]===source[p])n++;const fence=source.slice(p,n),end=source.indexOf(fence,n);p=end<0?n:end+fence.length;continue;
    }
    if(source[p]!=='$'){p++;continue;}
    const delimiter=source[p+1]==='$'?'$$':'$',a=p+delimiter.length;let end=a;
    for(;end<source.length;end++){
      if(source[end]==='\\'){end++;continue;}
      if(delimiter==='$'&&source[end]==='\n')break;
      if(source.startsWith(delimiter,end))break;
    }
    if(end>=source.length||!source.startsWith(delimiter,end)){p=a;continue;}
    const close=end+delimiter.length;if(from>=p&&to<=close)return {start:p,from:a,to:end,end:close};p=close;
  }
}

type MathRange=NonNullable<ReturnType<typeof mathAt>>;
type Wrapper={start:number;end:number;from:number;to:number;style:InlineStyle};
export type MathStyleSelection={source:string;math:MathRange;from:number;to:number;outerFrom:number;outerTo:number;style:InlineStyle;error?:string};
const hex=/^#[\da-f]{6}$/i;
// Read groups without treating escaped braces or comments as structure.
function group(source:string,start:number,open='{',close='}'){
  if(source[start]!==open)return null;
  let depth=1;
  for(let i=start+1;i<source.length;i++){
    if(source[i]==='\\'){i++;continue;}
    if(source[i]==='%'){const end=source.indexOf('\n',i);if(end<0)return null;i=end;continue;}
    if(source[i]===open)depth++;
    else if(source[i]===close&&!--depth)return {from:start+1,to:i,end:i+1,text:source.slice(start+1,i)};
  }
  return null;
}
function styleWrappers(source:string,math:MathRange){
  const wrappers:Wrapper[]=[];
  for(let i=math.from;i<math.to;i++){
    if(source[i]==='%'){const end=source.indexOf('\n',i);if(end<0)break;i=end;continue;}
    if(source[i]!=='\\')continue;
    const command=/^\\([a-zA-Z]+)\s*/.exec(source.slice(i));if(!command){i++;continue;}
    let p=i+command[0].length,style:InlineStyle|undefined;
    const name=command[1];
    if(name==='boldsymbol')style={bold:true};
    else if(name==='mathit')style={italic:true};
    else if(name==='underline')style={underline:true};
    else if(name==='textcolor'||name==='enclose'){
      const option=group(source,p);if(!option)continue;p=option.end;
      if(name==='textcolor'&&hex.test(option.text))style={color:option.text};
      if(name==='enclose'&&option.text==='horizontalstrike')style={strike:true};
    }else if(name==='bbox'){
      const option=group(source,p,'[',']');if(!option)continue;p=option.end;
      if(hex.test(option.text))style={highlight:option.text};
      const size=/^font-size:(\d+(?:\.\d)?)px$/.exec(option.text);
      if(size&&Number(size[1])>=10&&Number(size[1])<=64)style={size:Number(size[1])};
    }
    if(!style)continue;
    while(/\s/.test(source[p]||'')&&p<math.to)p++;
    const body=group(source,p);if(body&&body.end<=math.to)wrappers.push({start:i,end:body.end,from:body.from,to:body.to,style});
  }
  return wrappers;
}
export function selectedMath(editor:MarkdownEditor):MathStyleSelection|null{
  const s=editor.view.state.selection.main,source=editor.view.state.doc.toString();
  if(s.empty)return null;
  const math=mathAt(source,s.from,s.to);if(!math)return null;
  let from=s.from,to=s.to;
  const result:MathStyleSelection={source,math,from,to,outerFrom:from,outerTo:to,style:{}};
  if(from===math.start&&to===math.end){from=math.from;to=math.to;while(/\s/.test(source[from]||'')&&from<to)from++;while(/\s/.test(source[to-1]||'')&&to>from)to--;}
  else if(from<math.from||to>math.to)return {...result,error:'请只选中公式内部的完整表达式，或连同两侧 $ 完整选中公式。'};
  const wrappers=styleWrappers(source,math),inside:Wrapper[]=[],outside:Wrapper[]=[];
  let outerFrom=from,outerTo=to;
  for(let w=wrappers.find(w=>w.start===from&&w.end===to);w;w=wrappers.find(w=>w.start===from&&w.end===to)){inside.push(w);from=w.from;to=w.to;}
  for(let w=wrappers.find(w=>w.from===outerFrom&&w.to===outerTo);w;w=wrappers.find(w=>w.from===outerFrom&&w.to===outerTo)){outside.unshift(w);outerFrom=w.start;outerTo=w.end;}
  const style=Object.assign({},...outside.map(w=>w.style),...inside.map(w=>w.style));
  return {...result,from,to,outerFrom,outerTo,style};
}
function balancedExpression(source:string,from:number,to:number){
  const text=source.slice(from,to);let depth=0;
  // A selection must never split a control sequence, a comment or a surrogate pair.
  for(const match of source.matchAll(/\\(?:[a-zA-Z]+|[^\r\n])|%[^\r\n]*/g)){
    const start=match.index!,end=start+match[0].length;
    if(from>start&&from<end||to>start&&to<end)return false;
  }
  if(/[\uDC00-\uDFFF]/.test(text[0]||'')||/[\uD800-\uDBFF]/.test(text.at(-1)||''))return false;
  for(let i=0;i<text.length;i++){
    if(text[i]==='\\'){i++;continue;}
    if(text[i]==='%'){const end=text.indexOf('\n',i);if(end<0)return false;i=end;continue;}
    if(text[i]==='{')depth++;
    else if(text[i]==='}'&&--depth<0)return false;
  }
  return depth===0;
}
function mathStyleParts(style:InlineStyle){
  let before='',after='';
  for(const [active,prefix] of [
    [style.strike,'\\enclose{horizontalstrike}{'],[style.underline,'\\underline{'],
    [style.italic,'\\mathit{'],[style.bold,'\\boldsymbol{'],
    [style.size,`\\bbox[font-size:${style.size}px]{`],
    [style.highlight,`\\bbox[${style.highlight}]{`],[style.color,`\\textcolor{${style.color}}{`]
  ] as const)if(active){before=prefix+before;after+='}';}
  return {before,after};
}
export function mathStyleSource(text:string,style:InlineStyle){
  const {before,after}=mathStyleParts(style);return before+text+after;
}
export function applyMathStyle(editor:MarkdownEditor,selection:MathStyleSelection,style:InlineStyle,notify:(message:string)=>void,validate?:(source:string,display:boolean)=>string|undefined){
  if(editor.view.state.doc.toString()!==selection.source){notify('选区内容已经变化，请重新选择公式。');return false;}
  if(selection.error){notify(selection.error);return false;}
  const {source,math,from,to,outerFrom,outerTo}=selection,text=source.slice(from,to);
  if(!text.trim()||!balancedExpression(source,from,to)){notify('请选中完整的公式命令或表达式，保留配对的花括号。');return false;}
  if(style.bold&&/\\begin\s*\{/.test(text)){notify('矩阵、分段或对齐公式请选中其中的表达式逐项加粗，保留环境结构。');return false;}
  const insert=mathStyleSource(text,style),body=source.slice(math.from,outerFrom)+insert+source.slice(outerTo,math.to);
  if(validate?.(body,source.startsWith('$$',math.start))){notify('选区截断了公式结构，请完整选中命令及其参数，或只选中参数中的内容。');return false;}
  if(insert!==source.slice(outerFrom,outerTo)){
    // Replace only wrappers, retaining the selected expression and its DOM mapping.
    const {before,after}=mathStyleParts(style);editor.formatMathSelection(from,to,outerFrom,outerTo,before,after);
  }
  editor.view.focus();return true;
}
export function boldSelection(editor:MarkdownEditor,notify:(message:string)=>void){
  const selection=editor.view.state.selection.main,source=editor.view.state.doc.toString();
  if(selection.empty){editor.wrap('**');return;}
  let node=syntaxTree(editor.view.state).resolveInner(selection.from,1);
  for(let n:typeof node|null=node;n;n=n.parent)if(['FencedCode','InlineCode','CodeBlock'].includes(n.name)){notify('代码内容保持源码形式；请在普通文字或公式中使用加粗。');return;}
  const math=selectedMath(editor);
  if(math){applyMathStyle(editor,math,{...math.style,bold:!math.style.bold},notify);return;}
  const selected=source.slice(selection.from,selection.to);
  if(hasSelectedStyle(editor)){toggleTextStyle(editor,'bold');return;}
  const existing=source.slice(Math.max(0,selection.from-2),selection.from)==='**'&&source.slice(selection.to,selection.to+2)==='**';
  const candidate=source.slice(0,selection.from)+'**'+selected+'**'+source.slice(selection.to);
  const native=mappedInlineTokens(candidate).flat().some(t=>t.type==='strong_open'&&t.meta?.fontStyle?.from===selection.from&&t.meta.fontStyle.to===selection.to+4);
  if(existing||native)editor.wrap('**');
  else {if(selected.includes('\n')){notify('含特殊字符的加粗请逐个源码段落操作。');return;}editor.wrap('[',']{bold}');}
}
