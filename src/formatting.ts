import type {MarkdownEditor} from './editor';
import {parseInlineStyle,styleAttributes,type InlineStyle} from './inline-style';
import {blockFormatPlan,type BlockKind} from './block-format-plan';
export function toggleTextStyle(editor:MarkdownEditor,key:'bold'|'italic'|'underline'|'wave'|'strike'){
  const s=editor.view.state.selection.main,source=editor.view.state.doc.toString();
  let from=s.from,to=s.to,text=source.slice(from,to)||'文字';let style:InlineStyle={};
  const suffix=source.slice(to).match(/^\]\{([^}]+)\}/);
  const inner=source[from-1]==='['&&suffix?parseInlineStyle(suffix[1]):null;
  const full=/^\[([\s\S]*)\]\{([^}]+)\}$/.exec(text),outer=full?parseInlineStyle(full[2]):null;
  if(inner){style=inner;from--;to+=suffix![0].length;}
  else if(outer){style=outer;text=full![1];}
  style[key]=!style[key];const attrs=styleAttributes(style),insert=attrs?`[${text}]{${attrs}}`:text,offset=attrs?1:0;
  editor.view.dispatch({changes:{from,to,insert},selection:{anchor:from+offset,head:from+offset+text.length},userEvent:'input.format'});editor.view.focus();
}
export function hasSelectedStyle(editor:MarkdownEditor){const s=editor.view.state.selection.main,doc=editor.view.state.doc.toString();return doc[s.from-1]==='['&&/^\]\{/.test(doc.slice(s.to))||/\]\{[^}]+\}/.test(doc.slice(s.from,s.to));}
export function codeFormat(editor:MarkdownEditor){
  const s=editor.view.state.selection.main,text=editor.view.state.sliceDoc(s.from,s.to)||'代码';
  const n=Math.max(1,...[...text.matchAll(/`+/g)].map(m=>m[0].length+1));
  if(!text.includes('\n')){const delimiter='`'.repeat(n),padding=/^`|`$|^ .* $/.test(text)?' ':'';editor.wrap(delimiter+padding,padding+delimiter);}
  else{const fence='`'.repeat(Math.max(3,n));editor.wrap('\n'+fence+'\n','\n'+fence+'\n');}
}
export function insertFootnote(editor:MarkdownEditor){
  const s=editor.view.state.selection.main,doc=editor.view.state.doc.toString();let number=1;while(doc.includes(`[^${number}]`))number++;
  const marker=`[^${number}]`,prefix=doc.endsWith('\n\n')?'':doc.endsWith('\n')?'\n':'\n\n',definition=prefix+marker+': 脚注内容';
  const insert=doc.slice(0,s.to)+marker+doc.slice(s.to)+definition,from=insert.length-'脚注内容'.length;
  editor.view.dispatch({changes:{from:0,to:doc.length,insert},selection:{anchor:from,head:insert.length},scrollIntoView:true,userEvent:'input.format'});editor.view.focus();
}
export function blockFormat(editor:MarkdownEditor,kind:BlockKind,notify?:(message:string)=>void){
  if(typeof document!=='undefined'&&document.body.dataset.previewEditing==='true'){notify?.('请先完成预览文字修改，再转换段落结构。');return false;}
  const s=editor.view.state.selection.main,plan=blockFormatPlan(editor.view.state.doc.toString(),s.from,s.to,kind);
  if(plan.error){notify?.(plan.error);return false;}
  if(!plan.changes.length){editor.view.focus();return false;}
  editor.formatTextRanges(plan.changes);if(plan.selection)editor.view.dispatch({selection:plan.selection});return true;
}
export function listFormat(editor:MarkdownEditor,ordered:boolean,notify?:(message:string)=>void){return blockFormat(editor,ordered?'ordered':'bullet',notify);}
