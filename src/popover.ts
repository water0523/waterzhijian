import {escapeHTML} from './model';
let anchor:HTMLElement|null=null;
let disposeLayout=()=>{};
export function closePopover(){disposeLayout();disposeLayout=()=>{};const panel=document.getElementById('quick-popover');panel?.remove();anchor?.setAttribute('aria-expanded','false');anchor=null;if(panel)window.dispatchEvent(new Event('paper-popover-close'));}
export function openPopover(target:HTMLElement,title:string,html:string){
  closePopover();anchor=target;target.setAttribute('aria-expanded','true');
  const panel=document.createElement('section');panel.id='quick-popover';panel.className='quick-popover';panel.setAttribute('aria-label',title);panel.dataset.anchor=target.id;
  panel.innerHTML=`<header><strong>${escapeHTML(title)}</strong><button class="icon-button" aria-label="收起菜单" id="quick-close">×</button></header><div class="quick-body"><div class="quick-content">${html}</div></div>`;
  const header=panel.querySelector('header')!,body=panel.querySelector<HTMLElement>('.quick-body')!,content=panel.querySelector<HTMLElement>('.quick-content')!;
  const actions=content.querySelector<HTMLElement>(':scope > .inline-style-actions,:scope > .quick-actions');
  const footer=actions?document.createElement('footer'):null;
  if(footer){footer.className='quick-footer';footer.append(actions!);panel.append(footer);}
  document.body.append(panel);
  const layout=()=>{
    if(!panel.isConnected)return;
    const viewport=window.visualViewport,left=(viewport?.offsetLeft||0)+8,top=(viewport?.offsetTop||0)+8;
    const right=left+(viewport?.width||innerWidth)-16,bottom=top+(viewport?.height||innerHeight)-16,box=target.getBoundingClientRect();
    panel.style.width=Math.max(1,Math.min(470,right-left))+'px';
    panel.style.left=Math.max(left,Math.min(right-panel.offsetWidth,box.left))+'px';
    const bodyStyle=getComputedStyle(body),desired=header.offsetHeight+content.offsetHeight+parseFloat(bodyStyle.paddingTop)+parseFloat(bodyStyle.paddingBottom)+(footer?.offsetHeight||0)+2;
    const below=Math.max(0,bottom-Math.max(top,box.bottom+6)),above=Math.max(0,Math.min(bottom,box.top-6)-top);
    const down=desired<=below||(desired>above&&below>=above);
    let space=down?below:above;
    // When neither side has a usable reading area, use the viewport itself.
    // Actions remain outside the scroller, including after adding color swatches.
    const fill=space<Math.min(desired,240);if(fill)space=bottom-top;
    panel.style.maxHeight=Math.max(1,space)+'px';
    panel.style.top=Math.max(top,Math.min(bottom-panel.offsetHeight,fill?top:down?box.bottom+6:box.top-panel.offsetHeight-6))+'px';
  };
  let frame=0;const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(layout);};
  const observer=new ResizeObserver(schedule);for(const el of [content,header,footer,target])if(el)observer.observe(el);
  const scroll=(event:Event)=>{if(!panel.contains(event.target as Node))schedule();};
  window.addEventListener('resize',schedule);window.addEventListener('scroll',scroll,true);
  window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
  disposeLayout=()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);window.removeEventListener('scroll',scroll,true);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);};
  layout();
  panel.querySelector('#quick-close')!.addEventListener('click',closePopover);return panel;
}
document.addEventListener('pointerdown',e=>{const panel=document.getElementById('quick-popover');if(panel&&!panel.contains(e.target as Node)&&!anchor?.contains(e.target as Node))closePopover();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('quick-popover')){const old=anchor;closePopover();old?.focus();e.preventDefault();}});
const colors=[['墨黑','#202124'],['石灰','#6b7280'],['白色','#ffffff'],['朱红','#dc2626'],['橙色','#ea580c'],['金黄','#eab308'],['草绿','#16a34a'],['青绿','#0d9488'],['天蓝','#0284c7'],['钴蓝','#2563eb'],['紫色','#7c3aed'],['玫红','#db2777'],['浅黄','#fff29b'],['浅绿','#bbf7d0'],['浅蓝','#bfdbfe'],['浅粉','#fbcfe8']];
export function enhanceColors(root:HTMLElement){
  root.querySelectorAll<HTMLInputElement>('input[type=color]').forEach(input=>{
    if(input.nextElementSibling?.classList.contains('color-swatches'))return;
    const row=document.createElement('div');row.className='color-swatches';row.setAttribute('aria-label','常用标准色');
    row.innerHTML=colors.map(([name,color])=>`<button type="button" data-color="${color}" style="--swatch:${color}" title="${name} ${color}" aria-label="${name} ${color}" aria-pressed="${input.value===color}"></button>`).join('');input.after(row);
    const sync=()=>row.querySelectorAll<HTMLElement>('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===input.value)));
    row.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-color]');if(!b)return;input.value=b.dataset.color!;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));sync();});input.addEventListener('input',sync);
  });
}
