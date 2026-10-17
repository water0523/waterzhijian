import {EditorState,Compartment,type Extension} from '@codemirror/state';
import {EditorView,keymap,lineNumbers,highlightActiveLine,highlightActiveLineGutter,drawSelection,dropCursor,rectangularSelection} from '@codemirror/view';
import {defaultKeymap,history,historyKeymap,indentWithTab,undo,redo,isolateHistory} from '@codemirror/commands';
import {markdown} from '@codemirror/lang-markdown';
import {syntaxHighlighting,HighlightStyle,bracketMatching,indentOnInput} from '@codemirror/language';
import {tags} from '@lezer/highlight';
import {searchKeymap,highlightSelectionMatches,openSearchPanel} from '@codemirror/search';
import {closeCompletion,clearSnippet} from '@codemirror/autocomplete';
import {latexCompletionExtension} from './latex-completion';
export const editorThemes:Record<string,{name:string;bg:string;fg:string;line:string;muted:string;accent:string;string:string;heading:string}>= {
  dark:{name:'VS Code Dark+',bg:'#1e1e1e',fg:'#d4d4d4',line:'#282828',muted:'#858585',accent:'#569cd6',string:'#ce9178',heading:'#4ec9b0'},
  light:{name:'VS Code Light+',bg:'#ffffff',fg:'#303030',line:'#f4f4f4',muted:'#929292',accent:'#0451a5',string:'#a31515',heading:'#267f99'},
  github:{name:'GitHub Light',bg:'#ffffff',fg:'#24292f',line:'#f6f8fa',muted:'#8c959f',accent:'#0969da',string:'#0a3069',heading:'#8250df'},
  dracula:{name:'Dracula',bg:'#282a36',fg:'#f8f8f2',line:'#343746',muted:'#9098bd',accent:'#bd93f9',string:'#f1fa8c',heading:'#50fa7b'},
  monokai:{name:'Monokai',bg:'#272822',fg:'#f8f8f2',line:'#35362f',muted:'#979987',accent:'#f92672',string:'#e6db74',heading:'#a6e22e'},
  solarized:{name:'Solarized Light',bg:'#fdf6e3',fg:'#657b83',line:'#eee8d5',muted:'#93a1a1',accent:'#268bd2',string:'#2aa198',heading:'#859900'}
};
function themeExtension(id:string){
  const t=editorThemes[id]||editorThemes.dark;
  const dark=['dark','dracula','monokai'].includes(id);
  return [EditorView.theme({
    '&':{height:'100%',backgroundColor:t.bg,color:t.fg,fontSize:'14px'},
    '.cm-scroller':{fontFamily:'Consolas, "Cascadia Code", "Microsoft YaHei", monospace',lineHeight:'1.85',overflow:'auto'},
    '.cm-content':{padding:'22px 0 100px',caretColor:t.fg},
    '.cm-line':{padding:'0 22px 0 12px'},
    '.cm-gutters':{backgroundColor:t.bg,color:t.muted,border:'none',paddingLeft:'10px',paddingRight:'8px'},
    // Selections are drawn behind the text. An opaque active line hides them.
    '.cm-activeLine':{backgroundColor:dark?'#ffffff08':'#00000007'},
    '.cm-activeLineGutter':{backgroundColor:t.line},
    '.cm-cursor':{borderLeftColor:t.fg},
    '.cm-selectionLayer .cm-selectionBackground':{backgroundColor:dark?'#344e68':'#d1e2f6'},
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground':{backgroundColor:dark?'#264f78':'#b7d7ff'},
    '.cm-panels':{backgroundColor:t.line,color:t.fg},
    '.cm-searchMatch':{backgroundColor:'#cfa83050',outline:'1px solid #cfa830'},
    '.cm-foldPlaceholder':{backgroundColor:t.line,color:t.muted},
    '.cm-tooltip-autocomplete':{backgroundColor:t.bg,color:t.fg,border:`1px solid ${t.muted}60`,borderRadius:'7px',boxShadow:'0 6px 24px #0003',overflow:'hidden',maxWidth:'min(460px, calc(100vw - 40px))'},
    '.cm-tooltip-autocomplete > ul':{fontFamily:'Consolas, "Cascadia Code", monospace',fontSize:'13px',maxHeight:'248px'},
    '.cm-tooltip-autocomplete > ul > li':{padding:'5px 10px',lineHeight:'1.7'},
    '.cm-tooltip-autocomplete > ul > li[aria-selected]':{backgroundColor:dark?'#264f78':'#dbeafe',color:t.fg},
    '.cm-completionDetail':{fontFamily:'"Microsoft YaHei", sans-serif',fontSize:'11px',fontStyle:'normal',marginLeft:'18px',opacity:'.8'},
    '.cm-tooltip-autocomplete::after':{content:'"↑↓ 选择 · Enter / Tab 插入 · Esc 关闭"',display:'block',fontSize:'10px',padding:'5px 10px',borderTop:`1px solid ${t.muted}40`,color:t.muted},
    '.cm-tooltip.cm-completionInfo':{backgroundColor:t.bg,color:t.fg,border:`1px solid ${t.muted}60`,borderRadius:'6px',padding:'8px 10px',fontFamily:'"Microsoft YaHei", sans-serif',fontSize:'11px',lineHeight:'1.8',maxWidth:'250px'},
    '.cm-snippetField':{backgroundColor:dark?'#569cd633':'#0451a51a'},
  },{dark}),syntaxHighlighting(HighlightStyle.define([
    {tag:tags.heading,color:t.heading,fontWeight:'bold'},
    {tag:tags.processingInstruction,color:t.muted},
    {tag:tags.strong,fontWeight:'bold',color:t.string},
    {tag:tags.emphasis,fontStyle:'italic',color:t.string},
    {tag:[tags.link,tags.url],color:t.accent},
    {tag:tags.monospace,color:t.string},
    {tag:tags.quote,color:t.muted,fontStyle:'italic'},
    {tag:tags.meta,color:t.accent},
  ]))];
}
export class MarkdownEditor {
  view:EditorView; themeSlot=new Compartment(); private completionSlot=new Compartment(); latexCompletionEnabled=true; private suppress=false; private extensions:Extension[]; private themeId:string;
  constructor(parent:HTMLElement,text:string,theme:string,onChange:(text:string)=>void,onImages:(files:File[],position:number)=>void,onSave:()=>void,latexCompletion=true){
    this.themeId=theme;this.latexCompletionEnabled=latexCompletion;
    this.extensions=[
      lineNumbers(),history(),drawSelection(),dropCursor(),rectangularSelection(),indentOnInput(),bracketMatching(),highlightActiveLine(),highlightActiveLineGutter(),markdown(),highlightSelectionMatches(),EditorView.lineWrapping,
      EditorState.phrases.of({'Find':'查找','Replace':'替换','next':'下一个','previous':'上一个','all':'全部','match case':'区分大小写','regexp':'正则表达式','by word':'全词匹配','replace':'替换','replace all':'全部替换','close':'关闭','Go to line':'跳转到行'}),
      this.themeSlot.of(themeExtension(theme)),
      this.completionSlot.of(latexCompletion?latexCompletionExtension():[]),
      keymap.of([{key:'Mod-s',run:()=>{onSave();return true;}},...defaultKeymap,...historyKeymap,...searchKeymap,indentWithTab]),
      EditorView.updateListener.of(update=>{if(update.docChanged&&!this.suppress)onChange(update.state.doc.toString());}),
      EditorView.updateListener.of(update=>{if(update.selectionSet||update.docChanged||update.focusChanged||update.viewportChanged)requestAnimationFrame(()=>this.selectionTools());}),
      EditorView.domEventHandlers({paste:(event,view)=>{
        const images=[...(event.clipboardData?.files||[])].filter(f=>f.type.startsWith('image/'));
        if(images.length){event.preventDefault();onImages(images,view.state.selection.main.head);return true;}return false;
      },drop:(event,view)=>{
        const images=[...(event.dataTransfer?.files||[])].filter(f=>f.type.startsWith('image/'));
        if(images.length){event.preventDefault();onImages(images,view.posAtCoords({x:event.clientX,y:event.clientY})??view.state.selection.main.head);return true;}return false;
      },dragover:event=>{if(event.dataTransfer?.types.includes('Files')){event.preventDefault();return true;}return false;}})
    ];
    this.view=new EditorView({parent,state:EditorState.create({doc:text,extensions:this.extensions})});
    document.getElementById('selection-tools')?.addEventListener('mousedown',e=>e.preventDefault());
    document.getElementById('selection-tools')?.addEventListener('focusout',()=>requestAnimationFrame(()=>this.selectionTools()));
    document.querySelector('.format-toolbar')?.addEventListener('mousedown',e=>{if((e.target as HTMLElement).closest('button'))e.preventDefault();});
    this.view.scrollDOM.addEventListener('scroll',()=>this.selectionTools());
    window.addEventListener('paper-popover-close',()=>requestAnimationFrame(()=>this.selectionTools()));
  }
  private selectionTools(){
    const tools=document.getElementById('selection-tools');if(!tools)return;
    if(tools.dataset.origin==='preview')return;
    if(document.getElementById('quick-popover')?.dataset.toolbar===tools.id)return;
    const selection=this.view.state.selection.main,coords=this.view.coordsAtPos(selection.head),bounds=this.view.scrollDOM.getBoundingClientRect();
    tools.hidden=(!this.view.hasFocus&&!tools.contains(document.activeElement))||selection.empty||!coords||coords.top<bounds.top||coords.top>bounds.bottom;
    if(!tools.hidden&&coords){tools.style.left=Math.max(8,Math.min(window.innerWidth-tools.offsetWidth-8,coords.left))+'px';tools.style.top=Math.max(bounds.top,coords.top-tools.offsetHeight-7)+'px';}
  }
  setText(text:string,resetHistory=false){this.suppress=true;if(resetHistory){this.view.setState(EditorState.create({doc:text,extensions:this.extensions}));this.theme(this.themeId);this.setLatexCompletion(this.latexCompletionEnabled);}else this.view.dispatch({changes:{from:0,to:this.view.state.doc.length,insert:text},selection:{anchor:0}});this.suppress=false;this.view.scrollDOM.scrollTop=0;}
  theme(id:string){this.themeId=id;this.view.dispatch({effects:this.themeSlot.reconfigure(themeExtension(id))});}
  setLatexCompletion(enabled:boolean){closeCompletion(this.view);clearSnippet(this.view);this.latexCompletionEnabled=enabled;this.view.dispatch({effects:this.completionSlot.reconfigure(enabled?latexCompletionExtension():[])});}
  replaceText(from:number,to:number,insert:string){this.view.dispatch({changes:{from,to,insert},userEvent:'input.preview'});}
  formatSelection(from:number,to:number,outerFrom:number,outerTo:number,attributes:string){
    const prefix=attributes?'[':'',suffix=attributes?']{'+attributes+'}':'',anchor=outerFrom+prefix.length;
    // Keep selected text untouched so DOM selection and undo mapping survive
    // quick consecutive menu choices, including a directive wrapping formulas.
    this.view.dispatch({changes:[{from:outerFrom,to:from,insert:prefix},{from:to,to:outerTo,insert:suffix}],selection:{anchor,head:anchor+to-from},userEvent:'input.format',annotations:isolateHistory.of('full')});
  }
  formatMathSelection(from:number,to:number,outerFrom:number,outerTo:number,prefix:string,suffix:string){
    const anchor=outerFrom+prefix.length;
    this.view.dispatch({changes:[{from:outerFrom,to:from,insert:prefix},{from:to,to:outerTo,insert:suffix}],selection:{anchor,head:anchor+to-from},userEvent:'input.format',annotations:isolateHistory.of('full')});
  }
  formatTextRanges(specs:import('@codemirror/state').ChangeSpec[],focus=true){
    const selection=this.view.state.selection.main,changes=this.view.state.changes(specs),from=changes.mapPos(selection.from,1),to=changes.mapPos(selection.to,-1);
    this.view.dispatch({changes,selection:{anchor:from,head:Math.max(from,to)},userEvent:'input.format',annotations:isolateHistory.of('full')});if(focus)this.view.focus();
  }
  insert(text:string,at?:number){const sel=this.view.state.selection.main;const from=at??sel.from;this.view.dispatch({changes:{from,to:at===undefined?sel.to:from,insert:text},selection:{anchor:from+text.length},scrollIntoView:true});this.view.focus();}
  wrap(before:string,after=before){
    const s=this.view.state.selection.main,selected=this.view.state.sliceDoc(s.from,s.to)||'文字';
    const wrapped=!s.empty&&s.from>=before.length&&this.view.state.sliceDoc(s.from-before.length,s.from)===before&&this.view.state.sliceDoc(s.to,s.to+after.length)===after;
    if(wrapped){const from=s.from-before.length;this.view.dispatch({changes:{from,to:s.to+after.length,insert:selected},selection:{anchor:from,head:from+selected.length}});}
    else this.view.dispatch({changes:{from:s.from,to:s.to,insert:before+selected+after},selection:{anchor:s.from+before.length,head:s.from+before.length+selected.length}});
    this.view.focus();
  }
  goto(line:number){const l=this.view.state.doc.line(Math.max(1,Math.min(this.view.state.doc.lines,line)));this.view.dispatch({selection:{anchor:l.from},effects:EditorView.scrollIntoView(l.from,{y:'center'})});this.view.focus();}
  selectRange(from:number,to:number){this.view.dispatch({selection:{anchor:from,head:to},effects:EditorView.scrollIntoView(from,{y:'center'})});}
  undo(focus=true){undo(this.view);if(focus)this.view.focus();} redo(focus=true){redo(this.view);if(focus)this.view.focus();} search(){openSearchPanel(this.view);}
}

export class ScrollSync {
  enabled=true;private lockUntil=0;private anchors:{line:number;y:number}[]=[];
  constructor(private editor:MarkdownEditor,private preview:HTMLElement,private article:HTMLElement){
    editor.view.scrollDOM.addEventListener('scroll',()=>this.fromEditor(),{passive:true});
    preview.addEventListener('scroll',()=>this.fromPreview(),{passive:true});
    for(const el of [preview,editor.view.scrollDOM])el.addEventListener('wheel',()=>this.lockUntil=0,{passive:true});
  }
  rebuild(){
    const base=this.preview.getBoundingClientRect().top;
    const map=new Map<number,number>();
    for(const el of this.article.querySelectorAll<HTMLElement>('[data-line]')){
      if(el.classList.contains('math-inline')||el.closest('.footnotes')||!el.getClientRects().length)continue;
      const line=Number(el.dataset.line);const y=el.getBoundingClientRect().top-base+this.preview.scrollTop;
      if(!map.has(line))map.set(line,y);
    }
    this.anchors=[...map].map(([line,y])=>({line,y})).sort((a,b)=>a.line-b.line).filter((a,i,all)=>i===0||a.y>=all[i-1].y);
    this.anchors.push({line:this.editor.view.state.doc.lines,y:this.preview.scrollHeight-30});
  }
  private editorY(line:number){const doc=this.editor.view.state.doc;const n=Math.max(1,Math.min(doc.lines,line+1));return this.editor.view.lineBlockAt(doc.line(n).from).top;}
  private interpolate(value:number,source:number[],target:number[]){
    if(!source.length)return 0;
    if(value<=source[0])return target[0];
    for(let i=1;i<source.length;i++)if(value<=source[i]){const f=(value-source[i-1])/Math.max(1,source[i]-source[i-1]);return target[i-1]+f*(target[i]-target[i-1]);}
    return target[target.length-1];
  }
  capture(){return this.interpolate(this.preview.scrollTop+24,this.anchors.map(a=>a.y),this.anchors.map(a=>a.line));}
  restore(line:number){this.lockUntil=performance.now()+100;this.preview.scrollTop=Math.max(0,this.interpolate(line,this.anchors.map(a=>a.line),this.anchors.map(a=>a.y))-24);}
  fromEditor(){
    if(!this.enabled||performance.now()<this.lockUntil||!this.anchors.length)return;
    this.lockUntil=performance.now()+80;
    const scroll=this.editor.view.scrollDOM;
    if(scroll.scrollTop<=2){this.preview.scrollTop=0;return;}
    if(scroll.scrollTop+scroll.clientHeight>=scroll.scrollHeight-3){this.preview.scrollTop=this.preview.scrollHeight;return;}
    this.preview.scrollTop=Math.max(0,this.interpolate(scroll.scrollTop,this.anchors.map(a=>this.editorY(a.line)),this.anchors.map(a=>a.y))-24);
  }
  fromPreview(){
    if(!this.enabled||performance.now()<this.lockUntil||!this.anchors.length)return;
    this.lockUntil=performance.now()+80;
    const scroll=this.editor.view.scrollDOM;
    if(this.preview.scrollTop<=2){scroll.scrollTop=0;return;}
    if(this.preview.scrollTop+this.preview.clientHeight>=this.preview.scrollHeight-3){scroll.scrollTop=scroll.scrollHeight;return;}
    scroll.scrollTop=Math.max(0,this.interpolate(this.preview.scrollTop+24,this.anchors.map(a=>a.y),this.anchors.map(a=>this.editorY(a.line))));
  }
}
