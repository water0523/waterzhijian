// Controls stay outside <pre> and are removed from every publication fragment.
// Copy only <code> text, never terminal decorations or the control labels.
export function mountCodeTools(article:HTMLElement){
  for(const code of article.querySelectorAll<HTMLElement>('pre > code')){
    const pre=code.parentElement!,tools=document.createElement('div'),language=/\blanguage-([^\s]+)/.exec(code.className)?.[1]||'纯文本';
    tools.className='preview-code-tools';tools.dataset.editorOnly='true';
    const label=document.createElement('span');label.textContent=language;const status=document.createElement('span');status.className='code-copy-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const button=document.createElement('button');button.type='button';button.textContent='复制代码';button.setAttribute('aria-label','复制 '+language+' 代码');
    button.addEventListener('click',async()=>{
      button.disabled=true;
      try{if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');await navigator.clipboard.writeText(code.textContent||'');button.textContent='已复制';status.textContent='';}
      catch{button.textContent='重试复制';status.textContent='未获复制权限，可选中代码手动复制。';}
      finally{button.disabled=false;}
    });
    tools.append(label,status,button);pre.after(tools);
  }
}
