import type {MarkdownEditor} from './editor';
import type {InlineStyle} from './inline-style';
import {markerInk} from './inline-style';
import {selectedTextRuns,selectionStyleKeys,textRunStyle} from './text-selection';

type Plan=ReturnType<typeof selectedTextRuns>;
interface PainterHost {
  editor:MarkdownEditor;
  articleId:()=>string;
  apply:(plan:Plan,style:InlineStyle)=>boolean;
  notify:(message:string)=>void;
}

// Copy local inline formatting only. Block structure, theme defaults and text
// never travel with the brush; the existing range transaction owns undo.
export function mountFormatPainter(host:PainterHost){
  const button=document.getElementById('format-painter-button') as HTMLButtonElement;
  const status=document.createElement('div');status.id='format-painter-status';status.hidden=true;
  const message=document.createElement('span');message.setAttribute('role','status');
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='取消';dismiss.setAttribute('aria-label','取消格式刷');
  status.append(message,dismiss);document.querySelector('.workspace-toolbar')!.after(status);
  let sample:{article:string;source:string;style:InlineStyle}|undefined,pointer:number|undefined,generation=0;
  const cancel=()=>{sample=undefined;pointer=undefined;generation++;status.hidden=true;button.setAttribute('aria-pressed','false');button.title='格式刷：选中文字取样，再划选目标文字应用一次';delete document.body.dataset.formatPainter;};
  const plan=()=>{const s=host.editor.view.state.selection.main;return selectedTextRuns(host.editor.view.state.doc.toString(),s.from,s.to);};
  const invalid=(p:Plan)=>p.error||(!p.selected.length?(p.from===p.to?'请先选中一段文字作为格式样本。':'请选择可设置样式的文字；代码、公式和图片请使用对应工具。'):p.runs.some(r=>r.locked&&r.from<p.to&&r.to>p.from)?'格式刷用于文字样式，请避开代码、公式或图片。':undefined);
  const normalized=(run:Plan['selected'][number])=>{const style=textRunStyle(run);if(style.marker)style.markerColor=markerInk(style);else delete style.markerColor;return style;};
  button.addEventListener('click',()=>{
    if(sample){cancel();return;}
    const p=plan(),error=invalid(p);if(error){host.notify(error);return;}
    const style=normalized(p.selected[0]);
    if(p.selected.some(run=>selectionStyleKeys.some(key=>normalized(run)[key]!==style[key]))){host.notify('样本含有多种不同样式，请选择格式一致的文字取样。');return;}
    // Missing properties deliberately clear old target overrides, instead of
    // layering another color/highlight/font on top of an existing wrapper.
    const patch=Object.fromEntries(selectionStyleKeys.map(key=>[key,style[key]])) as InlineStyle;
    sample={article:host.articleId(),source:p.source,style:patch};generation++;
    message.textContent='格式刷已就绪 · 划选目标文字应用一次，Esc 取消';status.hidden=false;button.setAttribute('aria-pressed','true');button.title='格式刷已就绪，点击取消';document.body.dataset.formatPainter='ready';
  });
  const apply=()=>{
    if(!sample)return;
    if(sample.article!==host.articleId()||sample.source!==host.editor.view.state.doc.toString()){cancel();return;}
    const p=plan();if(p.from===p.to)return;
    const error=invalid(p);if(error){host.notify(error);return;}
    const style=sample.style;cancel();if(host.apply(p,style))host.notify('已应用格式刷，可撤销');
  };
  // Wait until CodeMirror / the preview source mapper finishes capturing the
  // final range. Never paint intermediate ranges during a mouse drag.
  const schedule=()=>{const token=generation;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(token===generation)apply();}));};
  const inText=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('.cm-content,#preview [data-edit-from],#preview [contenteditable]');
  document.addEventListener('pointerdown',e=>{
    if(!sample)return;
    if(e.button===0&&inText(e.target))pointer=e.pointerId;
    else if(!(e.target instanceof Element&&e.target.closest('#format-painter-button,#format-painter-status,#preview-scroll,.cm-scroller')))cancel();
  });
  document.addEventListener('pointerup',e=>{if(sample&&e.pointerId===pointer){pointer=undefined;schedule();}});
  document.addEventListener('pointercancel',()=>{pointer=undefined;});
  document.addEventListener('keyup',e=>{if(sample&&!e.shiftKey&&inText(e.target)&&(e.key==='Shift'||(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'))schedule();});
  document.addEventListener('keydown',e=>{if(sample&&e.key==='Escape'){e.preventDefault();cancel();}},true);
  dismiss.onclick=cancel;cancel();return {cancel};
}
