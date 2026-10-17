import type {MarkdownEditor} from './editor';
import {blockFormat,codeFormat} from './formatting';
import {closePopover} from './popover';

export function mountMarkdownShortcuts(editor:MarkdownEditor){
 const click=(selector:string)=>document.querySelector<HTMLButtonElement>(selector)?.click();
 const wrap=(before:string,after:string,placeholder:string)=>{
  const s=editor.view.state.selection.main,text=editor.view.state.sliceDoc(s.from,s.to)||placeholder;
  editor.view.dispatch({changes:{from:s.from,to:s.to,insert:before+text+after},selection:{anchor:s.from+before.length,head:s.from+before.length+text.length},userEvent:'input.format',scrollIntoView:true});editor.view.focus();
 };
 const list=(ordered:boolean)=>{
  const state=editor.view.state,s=state.selection.main,a=state.doc.lineAt(s.from),b=state.doc.lineAt(s.to>s.from&&state.doc.sliceString(s.to-1,s.to)==='\n'?s.to-1:s.to),lines=state.doc.sliceString(a.from,b.to).split('\n');
  const pattern=ordered?/^(\s*)\d+[.)]\s+/:/^(\s*)[-+*]\s+/,remove=lines.filter(l=>l.trim()).length>0&&lines.filter(l=>l.trim()).every(l=>pattern.test(l));let index=0;
  const insert=lines.map(l=>{if(!l.trim()&&lines.length>1)return l;if(remove)return l.replace(pattern,'$1');const clean=l.replace(/^(\s*)(?:\d+[.)]|[-+*])\s+/,'$1'),indent=clean.match(/^\s*/)![0];return indent+(ordered?`${++index}. `:'- ')+clean.slice(indent.length);}).join('\n');
  editor.view.dispatch({changes:{from:a.from,to:b.to,insert},selection:{anchor:a.from,head:a.from+insert.length},userEvent:'input.format',scrollIntoView:true});editor.view.focus();
 };
 const commands:Record<string,()=>void>={
  b:()=>click('.format-toolbar [data-format=bold]'),l:()=>click('.format-toolbar [data-format=italic]'),u:()=>click('.format-toolbar [data-format=underline]'),e:()=>{const s=editor.view.state.selection.main;if(!editor.view.state.sliceDoc(s.from,s.to).includes('\n'))codeFormat(editor);},m:()=>wrap('$','$','x'),k:()=>click('.format-toolbar [data-format=link]'),
  'alt-x':()=>click('.format-toolbar [data-format=strike]'),'alt-q':()=>blockFormat(editor,'quote'),'alt-o':()=>list(true),'alt-u':()=>list(false),'alt-e':()=>wrap('\n\n```\n','\n```\n\n','代码'),'alt-m':()=>wrap('\n\n$$\n','\n$$\n\n','x'),'alt-h':()=>editor.insert('\n\n---\n\n'),'alt-t':()=>click('.format-toolbar [data-format=table]'),'alt-l':()=>click('#image-button')
 };
 for(let level=1;level<=6;level++)commands[String(level)]=()=>blockFormat(editor,`h${level}` as 'h1');
 document.addEventListener('keydown',e=>{
  if(!e.ctrlKey||e.metaKey||e.shiftKey||e.isComposing||e.getModifierState('AltGraph')||!editor.view.hasFocus||document.querySelector('dialog[open]'))return;
  const command=commands[(e.altKey?'alt-':'')+e.key.toLowerCase()];if(!command)return;e.preventDefault();e.stopImmediatePropagation();closePopover();command();
 },true);
 for(const [selector,hint]of Object.entries({
  '[data-format=heading]':'标题 Ctrl+1–6','[data-format=bold]':'加粗 Ctrl+B','[data-format=italic]':'倾斜 Ctrl+L','[data-format=underline]':'下划线 Ctrl+U','[data-format=strike]':'删除线 Ctrl+Alt+X','[data-format=code]':'行内代码 Ctrl+E；代码块 Ctrl+Alt+E','[data-format=quote]':'引用 Ctrl+Alt+Q','[data-format=link]':'链接 Ctrl+K','[data-format=table]':'表格 Ctrl+Alt+T','#image-button':'图片 Ctrl+Alt+L','#math-button':'行内公式 Ctrl+M；公式块 Ctrl+Alt+M','#divider-button':'分割线 Ctrl+Alt+H'
 }))document.querySelectorAll<HTMLElement>(selector).forEach(n=>n.title=hint);
}
