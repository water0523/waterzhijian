import {escapeHTML} from './model';
let anchor:HTMLElement|null=null;
export function closePopover(){const panel=document.getElementById('quick-popover');panel?.remove();anchor?.setAttribute('aria-expanded','false');anchor=null;if(panel)window.dispatchEvent(new Event('paper-popover-close'));}
export function openPopover(target:HTMLElement,title:string,html:string){
  closePopover();anchor=target;target.setAttribute('aria-expanded','true');
  const panel=document.createElement('section');panel.id='quick-popover';panel.className='quick-popover';panel.setAttribute('aria-label',title);panel.dataset.anchor=target.id;
  panel.innerHTML=`<header><strong>${escapeHTML(title)}</strong><button class="icon-button" aria-label="收起菜单" id="quick-close">×</button></header><div class="quick-body">${html}</div>`;document.body.append(panel);
  const box=target.getBoundingClientRect();panel.style.width=Math.min(470,window.innerWidth-16)+'px';
  panel.style.left=Math.max(8,Math.min(window.innerWidth-panel.offsetWidth-8,box.left))+'px';
  const below=window.innerHeight-box.bottom-16;
  const top=below>=Math.min(240,panel.scrollHeight)?box.bottom+6:Math.max(8,box.top-Math.min(panel.scrollHeight,window.innerHeight-16)-6);
  panel.style.top=top+'px';panel.style.maxHeight=Math.max(120,window.innerHeight-top-8)+'px';
  panel.querySelector('#quick-close')!.addEventListener('click',closePopover);return panel;
}
document.addEventListener('pointerdown',e=>{const panel=document.getElementById('quick-popover');if(panel&&!panel.contains(e.target as Node)&&!anchor?.contains(e.target as Node))closePopover();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('quick-popover')){const old=anchor;closePopover();old?.focus();e.preventDefault();}});
window.addEventListener('resize',closePopover);
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
