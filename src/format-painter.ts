import type {MarkdownEditor} from './editor';
import type {InlineStyle} from './inline-style';
import {markerInk} from './inline-style';
import {selectedTextRuns,selectionStyleKeys,textRunStyle} from './text-selection';

type Plan=ReturnType<typeof selectedTextRuns>;
type Sample={article:string;source:string;style:InlineStyle;locked:boolean;count:number};
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
  const editorTitle=document.querySelector('.editor-title')!,editorLabel=editorTitle.querySelector<HTMLElement>(':scope > span')!;
  status.append(message,dismiss);editorLabel.after(status);status.title='划选目标文字应用格式；Esc、再次单击格式刷或点击取消即可退出';
  let sample:Sample|undefined,doubleClickSample:Sample|undefined,pointer:number|undefined,generation=0,painting=false;
  const cancel=()=>{sample=undefined;doubleClickSample=undefined;pointer=undefined;generation++;status.hidden=true;editorLabel.hidden=false;button.setAttribute('aria-pressed','false');button.title='格式刷：单击刷一次，双击锁定后可连续刷；Esc 取消';delete document.body.dataset.formatPainter;};
  const show=()=>{
    if(!sample)return;
    message.textContent=sample.locked?'格式刷已锁定'+(sample.count?' · 已刷 '+sample.count+' 处':' · 连续刷'):'格式刷已就绪 · 刷一次';
    status.hidden=false;editorLabel.hidden=true;button.setAttribute('aria-pressed','true');button.title=sample.locked?'格式刷已锁定，可连续刷；点击或按 Esc 取消':'格式刷已就绪；双击锁定，单击取消';document.body.dataset.formatPainter=sample.locked?'locked':'ready';
  };
  const plan=()=>{const s=host.editor.view.state.selection.main;return selectedTextRuns(host.editor.view.state.doc.toString(),s.from,s.to);};
  const invalid=(p:Plan)=>p.error||(!p.selected.length?(p.from===p.to?'请先选中一段文字作为格式样本。':'请选择可设置样式的文字；代码、公式和图片请使用对应工具。'):p.runs.some(r=>r.locked&&r.from<p.to&&r.to>p.from)?'格式刷用于文字样式，请避开代码、公式或图片。':undefined);
  const normalized=(run:Plan['selected'][number])=>{const style=textRunStyle(run);if(style.marker)style.markerColor=markerInk(style);else delete style.markerColor;return style;};
  const takeSample=()=>{
    const p=plan(),error=invalid(p);if(error){host.notify(error);return;}
    const style=normalized(p.selected[0]);
    if(p.selected.some(run=>selectionStyleKeys.some(key=>normalized(run)[key]!==style[key]))){host.notify('样本含有多种不同样式，请选择格式一致的文字取样。');return;}
    // Missing properties deliberately clear old target overrides, instead of
    // layering another color/highlight/font on top of an existing wrapper.
    const patch=Object.fromEntries(selectionStyleKeys.map(key=>[key,style[key]])) as InlineStyle;
    sample={article:host.articleId(),source:p.source,style:patch,locked:false,count:0};generation++;show();
  };
  button.addEventListener('click',event=>{
    // A native double click emits click(1), click(2), then dblclick. Do not let
    // its second click cancel the sample captured by the first click.
    if(event.detail>1)return;
    if(sample){const previous=sample;cancel();doubleClickSample=previous;}else{doubleClickSample=undefined;takeSample();}
  });
  button.addEventListener('dblclick',event=>{
    event.preventDefault();
    if(!sample&&doubleClickSample?.article===host.articleId()&&doubleClickSample.source===host.editor.view.state.doc.toString())sample=doubleClickSample;
    doubleClickSample=undefined;if(!sample)takeSample();
    if(sample){sample.locked=true;generation++;show();}
  });
  const apply=()=>{
    if(!sample)return;
    if(sample.article!==host.articleId()||sample.source!==host.editor.view.state.doc.toString()){cancel();return;}
    const p=plan();if(p.from===p.to)return;
    const error=invalid(p);if(error){host.notify(error);return;}
    const active=sample;generation++;pointer=undefined;if(!active.locked)cancel();
    // Own formatting changes update the range source while retaining the
    // pinned style. Unrelated edits still disarm through documentChanged().
    let applied=false;painting=true;
    try{applied=host.apply(p,active.style);}finally{
      painting=false;
      if(active.locked&&sample===active){
        if(applied&&active.article===host.articleId()){active.source=host.editor.view.state.doc.toString();active.count++;show();}
        else cancel();
      }
    }
    if(applied&&!active.locked)host.notify('已应用格式刷，可撤销');
  };
  // Wait until CodeMirror / the preview source mapper finishes capturing the
  // final range. Never paint intermediate ranges during a mouse drag.
  const schedule=()=>{const token=generation;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(token===generation)apply();}));};
  const inText=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('.cm-content,#preview [data-edit-from],#preview [contenteditable]');
  document.addEventListener('pointerdown',e=>{
    if(!(e.target instanceof Element&&e.target.closest('#format-painter-button')))doubleClickSample=undefined;
    if(!sample)return;
    if(e.button===0&&inText(e.target))pointer=e.pointerId;
    else if(!(e.target instanceof Element&&e.target.closest('#format-painter-button,#format-painter-status,#preview-scroll,.cm-scroller')))cancel();
  });
  document.addEventListener('pointerup',e=>{if(sample&&e.pointerId===pointer){pointer=undefined;schedule();}});
  document.addEventListener('pointercancel',()=>{pointer=undefined;});
  document.addEventListener('keyup',e=>{if(sample&&!e.shiftKey&&inText(e.target)&&(e.key==='Shift'||(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'))schedule();});
  document.addEventListener('keydown',e=>{if(sample&&e.key==='Escape'){e.preventDefault();cancel();}},true);
  dismiss.onclick=cancel;cancel();return {cancel,documentChanged:()=>{if(!painting)cancel();}};
}
