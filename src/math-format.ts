import {syntaxTree} from '@codemirror/language';
import type {MarkdownEditor} from './editor';
import {hasSelectedStyle,toggleTextStyle} from './formatting';

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
export function boldSelection(editor:MarkdownEditor,notify:(message:string)=>void){
  const selection=editor.view.state.selection.main,source=editor.view.state.doc.toString();
  if(selection.empty){editor.wrap('**');return;}
  let node=syntaxTree(editor.view.state).resolveInner(selection.from,1);
  for(let n:typeof node|null=node;n;n=n.parent)if(['FencedCode','InlineCode','CodeBlock'].includes(n.name)){notify('代码内容保持源码形式；请在普通文字或公式中使用加粗。');return;}
  const math=mathAt(source,selection.from,selection.to);
  if(math){
    // MathJax's boldsymbol scope does not propagate through array/alignment
    // environments. Keep their structure intact rather than claiming a change
    // that would leave those cells in regular weight.
    if(/\\begin\s*\{/.test(source.slice(Math.max(selection.from,math.from),Math.min(selection.to,math.to)))){notify('矩阵、分段或对齐公式请选中其中的表达式逐项加粗，保留环境结构。');return;}
    if(selection.from>=math.from&&selection.to<=math.to){editor.wrap('\\boldsymbol{','}');return;}
    if(selection.from===math.start&&selection.to===math.end){
      const body=source.slice(math.from,math.to),trimmed=body.trim();const unwrapped=/^\\boldsymbol\{([\s\S]*)\}$/.exec(trimmed);
      const replacement=unwrapped?unwrapped[1]:`\\boldsymbol{${body}}`;editor.replaceText(math.from,math.to,replacement);editor.view.dispatch({selection:{anchor:math.start,head:math.end+replacement.length-body.length}});editor.view.focus();return;
    }
    notify('请完整选中公式，或只选中公式内部的表达式，不要只选一侧 $ 符号。');return;
  }
  const selected=source.slice(selection.from,selection.to);
  if(hasSelectedStyle(editor)){toggleTextStyle(editor,'bold');return;}
  const existing=source.slice(Math.max(0,selection.from-2),selection.from)==='**'&&source.slice(selection.to,selection.to+2)==='**';
  if(existing||!(/[\d%$]/.test(selected)||/^\s|\s$|^[^\p{L}\p{N}]|[^\p{L}\p{N}]$/u.test(selected)))editor.wrap('**');
  else {if(selected.includes('\n')){notify('含特殊字符的加粗请逐个源码段落操作。');return;}editor.wrap('[',']{bold}');}
}
