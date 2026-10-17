import type {MarkdownEditor} from './editor';
import {closePopover} from './popover';

type TextPoint={node:Text;offset:number};
// The preview maps rendered text back to source offsets, never by searching
// words: identical sentences, nested styles and repeated table cells stay exact.
export class PreviewFormatting {
  private saved:{source:string;from:number;to:number}|null=null;
  private restoring=false;
  private frame=0;
  private tools=document.getElementById('selection-tools')!;
  constructor(private root:HTMLElement,private editor:MarkdownEditor,private refresh:()=>void){
    document.addEventListener('selectionchange',()=>{if(!this.restoring){cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>this.capture());}});
    document.addEventListener('pointerdown',event=>{
      const target=event.target as HTMLElement;
      if(!this.root.contains(target)&&!target.closest('#selection-tools,#quick-popover,.format-toolbar'))this.clear();
    },true);
    document.addEventListener('focusin',event=>{if((event.target as HTMLElement).closest('.cm-editor'))this.clear();});
    window.addEventListener('scroll',()=>{if(this.active)this.position();},true);
    window.addEventListener('resize',()=>{if(this.active)this.position();});
    window.addEventListener('paper-popover-close',()=>{if(this.active)requestAnimationFrame(()=>this.position());});
    document.addEventListener('keydown',event=>{
      if(event.defaultPrevented||!this.active||!(event.ctrlKey||event.metaKey)||event.altKey||!['z','y'].includes(event.key.toLowerCase()))return;
      if((event.target as HTMLElement).closest('input,textarea'))return;
      event.preventDefault();closePopover();
      if(event.key.toLowerCase()==='y'||event.shiftKey)this.editor.redo(false);else this.editor.undo(false);
      const selection=this.editor.view.state.selection.main;this.refresh();this.restore(selection.from,selection.to);
    });
  }
  get active(){return this.tools.dataset.origin==='preview'&&this.saved?.source===this.editor.view.state.doc.toString();}
  clear(){
    const selection=this.editor.view.state.selection.main;
    if(this.active&&selection.from===this.saved!.from&&selection.to===this.saved!.to)this.editor.view.dispatch({selection:{anchor:selection.head}});
    this.saved=null;if(this.tools.dataset.origin==='preview'){delete this.tools.dataset.origin;this.tools.hidden=true;}
  }
  attach(){if(!this.active)this.clear();}
  private textNodes(){
    const walker=document.createTreeWalker(this.root,NodeFilter.SHOW_TEXT),nodes:Text[]=[];let node;
    while(node=walker.nextNode())if(node.textContent)nodes.push(node as Text);
    return nodes;
  }
  private sourcePoint(node:Text,offset:number){
    const run=node.parentElement?.closest<HTMLElement>('[data-edit-from]');if(!run||!this.root.contains(run))return null;
    const from=Number(run.dataset.editFrom),to=Number(run.dataset.editTo),range=document.createRange();range.selectNodeContents(run);range.setEnd(node,offset);
    const count=range.toString().length,length=(run.textContent||'').length;
    if(count===0)return from;if(count===length)return to;
    // Escapes and entities are separate atomic runs; changed-length typography
    // is only safe at whole-run boundaries.
    return to-from===length?from+count:null;
  }
  private capture(){
    const selection=getSelection();if(!selection?.rangeCount)return;
    const range=selection.getRangeAt(0),inside=this.root.contains(range.commonAncestorContainer);
    if(!inside){if((document.activeElement as HTMLElement)?.closest('#selection-tools,#quick-popover,.format-toolbar'))return;this.clear();return;}
    if(selection.isCollapsed){this.clear();return;}
    const nodes=this.textNodes().filter(node=>range.intersectsNode(node)),pieces=nodes.map(node=>({node,start:node===range.startContainer?range.startOffset:0,end:node===range.endContainer?range.endOffset:node.length})).filter(p=>p.end>p.start);
    if(!pieces.length||pieces.some(p=>!p.node.parentElement?.closest('[data-edit-from]')&&p.node.data.slice(p.start,p.end).trim())){this.clear();return;}
    const mapped=pieces.filter(p=>p.node.parentElement?.closest('[data-edit-from]'));
    if(!mapped.length){this.clear();return;}
    const first=mapped[0],last=mapped.at(-1)!,from=this.sourcePoint(first.node,first.start),to=this.sourcePoint(last.node,last.end);
    if(from===null||to===null||from>=to){this.clear();return;}
    this.saved={source:this.editor.view.state.doc.toString(),from,to};this.tools.dataset.origin='preview';
    if(this.editor.view.hasFocus)this.editor.view.contentDOM.blur();
    this.editor.view.dispatch({selection:{anchor:from,head:to}});this.position();
  }
  private position(){
    const selection=getSelection();if(!selection?.rangeCount||!this.active)return;
    const range=selection.getRangeAt(0);if(!this.root.contains(range.commonAncestorContainer))return;
    const box=range.getBoundingClientRect(),scroll=this.root.closest('.preview-scroll')||this.root.parentElement!,bounds=scroll.getBoundingClientRect();
    this.tools.hidden=box.bottom<bounds.top||box.top>bounds.bottom;if(this.tools.hidden)return;
    this.tools.style.left=Math.max(8,Math.min(innerWidth-this.tools.offsetWidth-8,box.left))+'px';
    const above=box.top-this.tools.offsetHeight-8;
    this.tools.style.top=Math.max(8,Math.min(innerHeight-this.tools.offsetHeight-8,above>=bounds.top?above:box.bottom+8))+'px';
  }
  restore(from:number,to:number){
    const nodes=this.textNodes();
    const point=(position:number,end:boolean):TextPoint|null=>{
      for(const node of end?[...nodes].reverse():nodes){
        const run=node.parentElement?.closest<HTMLElement>('[data-edit-from]');if(!run)continue;
        const a=Number(run.dataset.editFrom),b=Number(run.dataset.editTo);if(position<a||position>b)continue;
        const prefix=document.createRange();prefix.selectNodeContents(run);prefix.setEnd(node,0);const offset=prefix.toString().length,length=(run.textContent||'').length;
        const relative=b-a===length?position-a:position===a?0:position===b?length:-1;
        if(relative>=offset&&relative<=offset+node.length)return {node,offset:relative-offset};
      }
      return null;
    };
    // Source selections may include wrapper markers after a replacement.
    const runs=[...this.root.querySelectorAll<HTMLElement>('[data-edit-from]')].filter(el=>Number(el.dataset.editFrom)<to&&Number(el.dataset.editTo)>from);
    if(!runs.length){this.clear();return;}
    const a=point(Math.max(from,Number(runs[0].dataset.editFrom)),false),b=point(Math.min(to,Number(runs.at(-1)!.dataset.editTo)),true);
    if(!a||!b){this.clear();return;}
    this.restoring=true;
    try{
      const range=document.createRange();range.setStart(a.node,a.offset);range.setEnd(b.node,b.offset);const selection=getSelection();selection?.removeAllRanges();selection?.addRange(range);
      this.saved={source:this.editor.view.state.doc.toString(),from,to};this.tools.dataset.origin='preview';this.position();
    }finally{this.restoring=false;}
  }
}
