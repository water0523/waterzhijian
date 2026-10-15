import type {MarkdownEditor} from './editor';

export class PreviewEditor {
  enabled=false;
  active:HTMLElement|null=null;
  updating=false;
  private composing=false;
  constructor(private root:HTMLElement,private editor:MarkdownEditor,private refresh:()=>void,private notify:(text:string)=>void){
    const target=(e:Event)=>(e.target as HTMLElement).closest<HTMLElement>('.preview-text-run');
    root.addEventListener('focusin',e=>{this.active=target(e);});
    root.addEventListener('focusout',e=>{if(!target(e))return;this.active=null;this.composing=false;setTimeout(()=>{if(!this.active)this.refresh();},0);});
    root.addEventListener('compositionstart',()=>{this.composing=true;});
    root.addEventListener('compositionend',e=>{this.composing=false;const el=target(e);if(el)this.commit(el);});
    root.addEventListener('input',e=>{const el=target(e);if(el&&!this.composing)this.commit(el);});
    root.addEventListener('beforeinput',event=>{
      const e=event as InputEvent,el=target(e);if(!el)return;
      const selection=window.getSelection();if(selection?.rangeCount&&!el.contains(selection.getRangeAt(0).commonAncestorContainer)){e.preventDefault();return;}
      const allowed=/^(insertText|insertCompositionText|deleteCompositionText|insertFromComposition|deleteContentBackward|deleteContentForward|deleteWordBackward|deleteWordForward|deleteByCut|insertFromPaste)$/;
      if(!allowed.test(e.inputType)){e.preventDefault();if(e.inputType==='insertParagraph'||e.inputType==='insertLineBreak')this.notify('此处只修改文字；添加段落、换行或调整格式请到 Markdown 栏。');}
    });
    root.addEventListener('keydown',e=>{
      if(!target(e)||e.isComposing)return;
      if((e.ctrlKey||e.metaKey)&&['b','i','u'].includes(e.key.toLowerCase()))e.preventDefault();
      if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){
        e.preventDefault();this.active=null;
        if(e.key.toLowerCase()==='y'||e.shiftKey)this.editor.redo();else this.editor.undo();
        this.refresh();
      }
      if(e.key==='Escape'){e.preventDefault();target(e)?.blur();}
    });
    root.addEventListener('paste',e=>{
      const el=target(e);if(!el)return;e.preventDefault();
      if(!e.clipboardData?.types.includes('text/plain')){this.notify('预览只接受文字；插入图片请在 Markdown 栏粘贴或拖入。');return;}
      const value=(e.clipboardData?.getData('text/plain')||'').replace(/[\r\n\t]+/g,' ');
      const selection=window.getSelection();if(!selection?.rangeCount)return;
      const range=selection.getRangeAt(0);
      if(!el.contains(range.commonAncestorContainer))return;
      range.deleteContents();const node=document.createTextNode(value);range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);this.commit(el);
    });
    root.addEventListener('drop',e=>{if(this.enabled)e.preventDefault();});
    root.addEventListener('click',e=>{if(this.enabled&&((e.target as HTMLElement).closest('a')||(target(e)&&(e.target as HTMLElement).closest('summary'))))e.preventDefault();},true);
  }
  attach(){
    this.active=null;
    this.root.classList.toggle('text-editing',this.enabled);
    // Chromium can discard replacement text when a plaintext-only editing
    // host contains a floated drop cap. Give the initial and following text
    // independent exact ranges, keeping the float outside the latter host.
    if(this.enabled)for(const initial of this.root.querySelectorAll<HTMLElement>('.journal-initial,.magazine-initial,.text-initial')){
      const run=initial.parentElement;if(!run?.hasAttribute('data-edit-from'))continue;
      const from=Number(run.dataset.editFrom),to=Number(run.dataset.editTo),all=run.textContent||'',char=initial.textContent||'';
      const before=document.createRange();before.selectNodeContents(run);before.setEndBefore(initial);const prefix=before.toString();
      if(!char||!this.editor.view.state.sliceDoc(from,to).startsWith(prefix+char)){
        initial.style.cssText+=';float:none;font:inherit;margin:0;';continue;
      }
      const mapped=(text:string,a:number,b:number)=>{const span=document.createElement('span');span.textContent=text;span.dataset.editFrom=String(a);span.dataset.editTo=String(b);return span;};
      initial.dataset.editFrom=String(from+prefix.length);initial.dataset.editTo=String(from+prefix.length+char.length);
      const tail=all.slice(prefix.length+char.length),nodes:Node[]=[];
      if(prefix)nodes.push(mapped(prefix,from,from+prefix.length));nodes.push(initial);
      if(tail)nodes.push(mapped(tail,from+prefix.length+char.length,to));
      run.replaceWith(...nodes);
    }
    for(const el of this.root.querySelectorAll<HTMLElement>('[data-edit-from]')){
      el.classList.add('preview-text-run');
      if(this.enabled){el.contentEditable='plaintext-only';el.spellcheck=false;el.setAttribute('aria-label','修改文字');}
      else el.removeAttribute('contenteditable');
    }
  }
  private commit(el:HTMLElement){
    const from=Number(el.dataset.editFrom),to=Number(el.dataset.editTo),text=el.textContent||'';
    // Encode Markdown punctuation, so pasted asterisks, HTML and dollar signs
    // stay literal text and cannot introduce formatting or formulas.
    const insert=el.dataset.editLiteral?text:text.replace(/([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g,'\\$1').replace(/^ +| +$/g,s=>'&#32;'.repeat(s.length));
    if(this.editor.view.state.sliceDoc(from,to)===insert)return;
    const delta=insert.length-(to-from);
    for(const run of this.root.querySelectorAll<HTMLElement>('[data-edit-from]')){
      if(run===el){run.dataset.editTo=String(from+insert.length);continue;}
      if(Number(run.dataset.editFrom)>=to){run.dataset.editFrom=String(Number(run.dataset.editFrom)+delta);run.dataset.editTo=String(Number(run.dataset.editTo)+delta);}
    }
    this.updating=true;
    try{this.editor.replaceText(from,to,insert);}finally{this.updating=false;}
  }
}
