import {escapeHTML} from './model';
let anchor:HTMLElement|null=null;
let disposeLayout=()=>{};
let hoverOpening=false,hoverTimer=0,leaveTimer=0;
let pendingHover:HTMLElement|null=null,suppressedHover:HTMLElement|null=null;
let pointer={x:-1,y:-1},dismissedAt:typeof pointer|null=null,blockedHover:HTMLElement|null=null;
document.addEventListener('pointermove',e=>{pointer={x:e.clientX,y:e.clientY};if(dismissedAt&&(dismissedAt.x!==pointer.x||dismissedAt.y!==pointer.y))dismissedAt=null;},true);
const toolbarFor=(target:HTMLElement|null)=>target?.closest<HTMLElement>('[role="toolbar"],.format-toolbar');
const pinned=()=>document.getElementById('quick-popover')?.dataset.mode==='pinned';
function pinPopover(){const panel=document.getElementById('quick-popover');if(!panel||!anchor)return;clearTimeout(leaveTimer);panel.dataset.mode='pinned';anchor.dataset.pinned='true';panel.querySelector('.quick-mode')!.textContent='已固定';}
export function closePopover(){clearTimeout(hoverTimer);pendingHover=null;clearTimeout(leaveTimer);leaveTimer=0;disposeLayout();disposeLayout=()=>{};const panel=document.getElementById('quick-popover');if(panel){dismissedAt={...pointer};blockedHover=null;}panel?.remove();anchor?.setAttribute('aria-expanded','false');if(anchor)delete anchor.dataset.pinned;anchor=null;if(panel)window.dispatchEvent(new Event('paper-popover-close'));}
function closeAndFocus(){const trigger=anchor;if(trigger?.matches(':hover'))suppressedHover=trigger;closePopover();trigger?.focus({preventScroll:true});}
export function mountPopoverHover(targets:Iterable<HTMLElement>,canOpen:(target:HTMLElement)=>boolean=()=>true){
  for(const target of targets){
    if(target.dataset.hoverDropdown)return;target.dataset.hoverDropdown='true';target.setAttribute('aria-haspopup','menu');
    const enter=(e:PointerEvent)=>{
      if(e.pointerType!=='mouse'||target===suppressedHover||pinned()||!canOpen(target))return;
      // Closing a menu can move the floating toolbar under a stationary mouse.
      // Wait for an actual move before opening a different menu in that spot.
      if(dismissedAt?.x===e.clientX&&dismissedAt.y===e.clientY){blockedHover=target;return;}
      clearTimeout(hoverTimer);clearTimeout(leaveTimer);pendingHover=target;
      hoverTimer=window.setTimeout(()=>{
        pendingHover=null;if(!target.isConnected||!target.matches(':hover')||pinned()||!canOpen(target)||anchor===target)return;
        hoverOpening=true;try{target.click();}finally{hoverOpening=false;}
      },100);
    };
    target.addEventListener('pointerenter',enter);
    target.addEventListener('pointermove',e=>{if(blockedHover===target&&(dismissedAt?.x!==e.clientX||dismissedAt.y!==e.clientY)){blockedHover=null;enter(e);}});
    target.addEventListener('pointerleave',()=>{if(pendingHover===target){clearTimeout(hoverTimer);pendingHover=null;}if(suppressedHover===target)suppressedHover=null;if(blockedHover===target)blockedHover=null;});
  }
}
export function openPopover(target:HTMLElement,title:string,html:string,options:{width?:number}={}){
  const menu=target.closest<HTMLDetailsElement>('.toolbar-menu');if(menu)menu.open=true;
  closePopover();anchor=target;target.setAttribute('aria-expanded','true');
  const panel=document.createElement('section');panel.id='quick-popover';panel.className='quick-popover';panel.setAttribute('aria-label',title);panel.dataset.anchor=target.id;
  panel.dataset.toolbar=toolbarFor(target)?.id||'';
  panel.dataset.mode=hoverOpening?'hover':'pinned';target.dataset.pinned=String(!hoverOpening);
  panel.innerHTML=`<header><strong>${escapeHTML(title)}</strong><small class="quick-mode">${hoverOpening?'悬停 · 点击固定':'已固定'}</small><button class="icon-button" aria-label="收起菜单" id="quick-close">×</button></header><div class="quick-body"><div class="quick-content">${html}</div></div>`;
  const header=panel.querySelector('header')!,body=panel.querySelector<HTMLElement>('.quick-body')!,content=panel.querySelector<HTMLElement>('.quick-content')!;
  const actions=content.querySelector<HTMLElement>(':scope > .inline-style-actions,:scope > .quick-actions');
  const footer=actions?document.createElement('footer'):null;
  if(footer){footer.className='quick-footer';footer.append(actions!);panel.append(footer);}
  document.body.append(panel);
  const layout=()=>{
    if(!panel.isConnected)return;
    const viewport=window.visualViewport,left=(viewport?.offsetLeft||0)+8,top=(viewport?.offsetTop||0)+8;
    const right=left+(viewport?.width||innerWidth)-16,bottom=top+(viewport?.height||innerHeight)-16,box=target.getBoundingClientRect();
    panel.style.width=Math.max(1,Math.min(options.width||470,right-left))+'px';
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
  panel.addEventListener('focusin',pinPopover);
  panel.querySelector('#quick-close')!.addEventListener('click',closeAndFocus);return panel;
}
function inHoverPath(x:number,y:number,panel:HTMLElement){
  if(!anchor)return false;
  const a=anchor.getBoundingClientRect(),p=panel.getBoundingClientRect();
  const inside=(r:DOMRect)=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;
  if(inside(a)||inside(p))return true;
  // Only bridge the actual vertical gap under/above the trigger; unrelated
  // page space must not keep a temporary menu open.
  const left=Math.max(a.left,p.left)-2,right=Math.min(a.right,p.right)+2;
  return x>=left&&x<=right&&((p.top>=a.bottom&&y>=a.bottom&&y<=p.top)||(a.top>=p.bottom&&y>=p.bottom&&y<=a.top));
}
document.addEventListener('pointermove',e=>{
  const panel=document.getElementById('quick-popover');if(!panel||pinned())return;
  if(inHoverPath(e.clientX,e.clientY,panel)){clearTimeout(leaveTimer);leaveTimer=0;}
  else if(!leaveTimer)leaveTimer=window.setTimeout(()=>{leaveTimer=0;if(panel===document.getElementById('quick-popover')&&!pinned())closePopover();},120);
});
window.addEventListener('blur',()=>{if(!pinned())closePopover();});
document.addEventListener('pointerout',e=>{if(!e.relatedTarget&&!pinned())closePopover();});
// Keep the toolbar alive between pointerdown and click. Removing a focused
// menu here would blur the editor and hide the next trigger before its click.
document.addEventListener('pointerdown',e=>{const panel=document.getElementById('quick-popover'),target=e.target as Node;if(panel?.contains(target))pinPopover();else if(panel&&!anchor?.contains(target)&&!toolbarFor(anchor)?.contains(target))closePopover();});
document.addEventListener('click',e=>{
  if(hoverOpening||!document.getElementById('quick-popover')||!anchor)return;
  const target=e.target as HTMLElement;
  if(anchor.contains(target)){
    if(pinned())closeAndFocus();else {pinPopover();const panel=document.getElementById('quick-popover')!;(panel.querySelector<HTMLElement>('[role^="menuitem"][aria-checked="true"]')||panel.querySelector<HTMLElement>('.quick-body button,.quick-body input'))?.focus({preventScroll:true});}
    e.preventDefault();e.stopPropagation();
  }
  else if(toolbarFor(anchor)?.contains(target)){closePopover();target.closest<HTMLElement>('button')?.focus({preventScroll:true});}
},true);
document.addEventListener('keydown',e=>{if(!e.isComposing&&e.keyCode!==229&&e.key==='Escape'&&document.getElementById('quick-popover')){closeAndFocus();e.preventDefault();e.stopPropagation();}},true);
export const standardColors=[['墨黑','#202124'],['石灰','#6b7280'],['白色','#ffffff'],['朱红','#dc2626'],['橙色','#ea580c'],['金黄','#eab308'],['草绿','#16a34a'],['青绿','#0d9488'],['天蓝','#0284c7'],['钴蓝','#2563eb'],['紫色','#7c3aed'],['玫红','#db2777'],['浅黄','#fff29b'],['浅绿','#bbf7d0'],['浅蓝','#bfdbfe'],['浅粉','#fbcfe8']];
export function enhanceColors(root:HTMLElement){
  root.querySelectorAll<HTMLInputElement>('input[type=color]').forEach(input=>{
    if(input.nextElementSibling?.classList.contains('color-swatches'))return;
    const row=document.createElement('div');row.className='color-swatches';row.setAttribute('aria-label','常用标准色');
    row.innerHTML=standardColors.map(([name,color])=>`<button type="button" data-color="${color}" style="--swatch:${color}" title="${name} ${color}" aria-label="${name} ${color}" aria-pressed="${input.value===color}"></button>`).join('');input.after(row);
    const sync=()=>row.querySelectorAll<HTMLElement>('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===input.value)));
    row.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-color]');if(!b)return;input.value=b.dataset.color!;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));sync();});input.addEventListener('input',sync);
  });
}
