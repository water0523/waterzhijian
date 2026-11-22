import type {MarkdownEditor} from './editor';
import {parseInlineStyle,styleAttributes,type InlineStyle} from './inline-style';
import {blockFormatPlan,type BlockKind} from './block-format-plan';
import {codeWritingPlan,footnoteWritingPlan,type WritingPlan} from './source-writing-plan';
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
function applyWritingPlan(editor:MarkdownEditor,plan:WritingPlan,notify?:(text:string)=>void){
 if(plan.error){notify?.(plan.error);editor.view.focus();return false;}
 if(plan.changes.length)editor.formatTextRanges(plan.changes,true,{selection:plan.selection,reveal:plan.reveal});
 else if(plan.selection){editor.historyBoundary?.();editor.selectRange(plan.selection.anchor,plan.selection.head);editor.view.focus();}
 if(plan.message)notify?.(plan.message);return true;
}
export function codeFormat(editor:MarkdownEditor,mode:'auto'|'inline'|'block'='auto',notify?:(text:string)=>void){
 if(document.body.dataset.previewEditing==='true'){notify?.('请先完成预览文字修改，再转换代码结构。');return false;}
 const s=editor.view.state.selection.main;return applyWritingPlan(editor,codeWritingPlan(editor.view.state.doc.toString(),s.from,s.to,mode),notify);
}
export function insertFootnote(editor:MarkdownEditor,notify?:(text:string)=>void){
 if(document.body.dataset.previewEditing==='true'){notify?.('请先完成预览文字修改，再插入或编辑脚注。');return false;}
 const s=editor.view.state.selection.main;return applyWritingPlan(editor,footnoteWritingPlan(editor.view.state.doc.toString(),s.from,s.to),notify);
}
export function blockFormat(editor:MarkdownEditor,kind:BlockKind,notify?:(message:string)=>void){
  if(typeof document!=='undefined'&&document.body.dataset.previewEditing==='true'){notify?.('请先完成预览文字修改，再转换段落结构。');return false;}
  const s=editor.view.state.selection.main,plan=blockFormatPlan(editor.view.state.doc.toString(),s.from,s.to,kind);
  if(plan.error){notify?.(plan.error);return false;}
  if(!plan.changes.length){editor.view.focus();return false;}
  editor.formatTextRanges(plan.changes);if(plan.selection)editor.view.dispatch({selection:plan.selection});return true;
}
export function listFormat(editor:MarkdownEditor,ordered:boolean,notify?:(message:string)=>void){return blockFormat(editor,ordered?'ordered':'bullet',notify);}
