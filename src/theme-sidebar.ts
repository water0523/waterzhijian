import {escapeHTML as esc} from './model';
import {visibleThemes} from './themes';
import {themeMatches} from './theme-search';
import {themeDesign} from './theme-design';
import type {Theme} from './theme-types';

type Host={current:()=>string;enabled:()=>boolean;pins:()=>string[];thumbnail:(id:string)=>string;preview:(id:string)=>void;cancel:()=>void;apply:(id:string)=>void;pin:(id:string)=>void;order:(ids:string[])=>void;details:()=>void;close:()=>void;};
const filters=['全部','收藏','简约','书卷','杂志','科普','文学','通用'];
function inGroup(t:Theme,group:string,pins:string[]){
  const base=t.baseId||t.id;
  return group==='全部'||(group==='收藏'?pins.includes(t.id):group==='简约'?['plain','minimal','academic','wild','swiss'].includes(base):group==='书卷'?t.group==='文学':group==='杂志'?['digest','press','gewu','magazine','editorial','weekend','gold','journal-indigo','journal-jade'].includes(base):t.group===group);
}
export function mountThemeSidebar(root:HTMLElement,host:Host){
  let group='全部',dragged='',needsRender=true;
  root.innerHTML=`<header class="catalog-heading"><h2>主题库 <small id="sidebar-theme-total"></small></h2><button id="theme-sidebar-close" class="icon-button" aria-label="关闭主题库">×</button></header><div class="catalog-search"><span aria-hidden="true">⌕</span><input id="sidebar-theme-search" placeholder="搜索主题 / 关键词" aria-label="搜索侧栏主题"></div><div class="sidebar-theme-tabs" role="group" aria-label="主题分类">${filters.map(label=>`<button data-sidebar-group="${label}" aria-pressed="${label===group}">${label}</button>`).join('')}</div><p class="sidebar-theme-hint">悬停试看，移开恢复 · 点击应用</p><div id="sidebar-theme-results" class="sidebar-theme-results"></div><footer class="theme-sidebar-footer"><span id="sidebar-theme-count"></span><button id="sidebar-theme-details">完整预览 / 管理 ↗</button></footer>`;
  const results=root.querySelector<HTMLElement>('#sidebar-theme-results')!;
  const observer=new ResizeObserver(entries=>{for(const {target} of entries){const window=target as HTMLElement,sample=window.querySelector<HTMLElement>('.theme-sample');if(sample)sample.style.transform=`scale(${window.clientWidth/375})`;}});
  const hydrate=(thumbnail:HTMLElement)=>{
    const id=thumbnail.dataset.pendingTheme;if(!id||root.hidden||!results.contains(thumbnail))return;
    thumbnail.innerHTML=host.thumbnail(id);delete thumbnail.dataset.pendingTheme;thumbnail.removeAttribute('aria-busy');
    const window=thumbnail.querySelector<HTMLElement>('.theme-live-window');if(window)observer.observe(window);
  };
  const previews=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const thumbnail=entry.target as HTMLElement;hydrate(thumbnail);if(!thumbnail.dataset.pendingTheme)previews.unobserve(thumbnail);}},{root:results,rootMargin:'120px 0px'});
  const updateCurrent=()=>{const id=host.current();root.querySelector('.sidebar-theme-hint')!.textContent=host.enabled()?'悬停试看，移开恢复 · 点击应用':'知乎使用标准排版 · 切回公众号可应用主题';results.querySelectorAll<HTMLElement>('[data-sidebar-card]').forEach(card=>{const chosen=card.dataset.sidebarCard===id;card.classList.toggle('is-current',chosen);const choice=card.querySelector<HTMLButtonElement>('[data-sidebar-theme]')!;choice.setAttribute('aria-pressed',String(chosen));choice.disabled=!host.enabled();const badge=card.querySelector<HTMLElement>('.sidebar-theme-current')!;badge.hidden=!chosen;});};
  const render=()=>{
    needsRender=true;if(root.hidden)return;
    needsRender=false;host.cancel();observer.disconnect();previews.disconnect();
    const all=visibleThemes(),pins=host.pins(),query=(root.querySelector('#sidebar-theme-search') as HTMLInputElement).value;
    const rank=(id:string)=>pins.includes(id)?pins.indexOf(id):Infinity;
    const visible=all.filter(t=>inGroup(t,group,pins)&&themeMatches(t,query,themeDesign(t).tags)).sort((a,b)=>rank(a.id)-rank(b.id));
    root.querySelector('#sidebar-theme-total')!.textContent=all.length+' 套';root.querySelector('#sidebar-theme-count')!.textContent=visible.length+' 套主题';
    root.querySelectorAll<HTMLElement>('[data-sidebar-group]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.sidebarGroup===group)));
    const scroll=results.scrollTop;
    results.innerHTML=visible.map((t,index)=>`<section class="sidebar-theme-card" data-sidebar-card="${t.id}"><button class="sidebar-theme-choice" data-sidebar-theme="${t.id}" aria-label="试看并应用${esc(t.name)}主题" aria-pressed="false"><div class="sidebar-theme-thumbnail" data-pending-theme="${t.id}" aria-hidden="true" aria-busy="true"><div class="theme-thumbnail-placeholder"></div></div><span class="sidebar-theme-info"><strong>${esc(t.name)}</strong><small>${esc(t.group+' · '+themeDesign(t).tags.slice(0,2).join(' / '))}</small></span><span class="sidebar-theme-current" hidden>使用中</span></button><button class="sidebar-theme-star" data-sidebar-pin="${t.id}" title="${pins.includes(t.id)?'取消收藏':'收藏主题'}" aria-label="${pins.includes(t.id)?'取消收藏':'收藏'}${esc(t.name)}" aria-pressed="${pins.includes(t.id)}">${pins.includes(t.id)?'★':'☆'}</button>${group==='收藏'?`<div class="sidebar-theme-order"><button draggable="true" data-theme-drag="${t.id}" aria-label="拖动排序${esc(t.name)}" title="按住拖动排序">⠿ <span>拖动排序</span></button><button data-theme-move="${t.id}" data-direction="-1" ${index===0?'disabled':''} aria-label="上移${esc(t.name)}" title="上移">↑</button><button data-theme-move="${t.id}" data-direction="1" ${index===visible.length-1?'disabled':''} aria-label="下移${esc(t.name)}" title="下移">↓</button></div>`:''}</section>`).join('')||'<div class="sidebar-theme-empty">没有匹配的主题<button id="sidebar-theme-reset">查看全部主题</button></div>';
    results.scrollTop=scroll;
    for(const thumbnail of results.querySelectorAll<HTMLElement>('[data-pending-theme]'))previews.observe(thumbnail);
    results.querySelectorAll<HTMLElement>('[data-sidebar-card]').forEach(card=>{
      const id=card.dataset.sidebarCard!;
      card.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&!dragged)host.preview(id);});
      card.addEventListener('pointerleave',()=>host.cancel());
      card.addEventListener('focusin',e=>{if((e.target as HTMLElement).closest('[data-sidebar-theme]'))host.preview(id);});
      card.addEventListener('focusout',e=>{if(!card.contains(e.relatedTarget as Node))host.cancel();});
    });
    updateCurrent();
  };
  root.querySelector('#sidebar-theme-search')!.addEventListener('input',()=>{results.scrollTop=0;render();});
  root.addEventListener('click',e=>{
    const target=e.target as HTMLElement,tab=target.closest<HTMLElement>('[data-sidebar-group]'),pin=target.closest<HTMLElement>('[data-sidebar-pin]'),choice=target.closest<HTMLElement>('[data-sidebar-theme]');
    if(tab){group=tab.dataset.sidebarGroup!;results.scrollTop=0;render();return;}
    if(pin){const id=pin.dataset.sidebarPin!,keyboard=(e as MouseEvent).detail===0;host.cancel();host.pin(id);render();if(keyboard)(results.querySelector<HTMLElement>(`[data-sidebar-pin="${id}"]`)||root.querySelector<HTMLElement>('#sidebar-theme-search'))?.focus({preventScroll:true});return;}
    const move=target.closest<HTMLElement>('[data-theme-move]');
    if(move){const visible=[...results.querySelectorAll<HTMLElement>('[data-sidebar-card]')].map(c=>c.dataset.sidebarCard!),id=move.dataset.themeMove!,targetId=visible[visible.indexOf(id)+Number(move.dataset.direction)];if(targetId){reorder(id,targetId,Number(move.dataset.direction)>0);(results.querySelector<HTMLElement>(`[data-theme-move="${id}"][data-direction="${move.dataset.direction}"]:not(:disabled)`)||results.querySelector<HTMLElement>(`[data-theme-drag="${id}"]`))?.focus({preventScroll:true});}return;}
    if(choice&&host.enabled()){host.apply(choice.dataset.sidebarTheme!);updateCurrent();return;}
    if(target.closest('#sidebar-theme-reset')){group='全部';(root.querySelector('#sidebar-theme-search') as HTMLInputElement).value='';render();}
  });
  const reorder=(id:string,target:string,after:boolean)=>{const pins=[...host.pins()];if(id===target||!pins.includes(id)||!pins.includes(target))return;pins.splice(pins.indexOf(id),1);pins.splice(pins.indexOf(target)+(after?1:0),0,id);host.order(pins);render();};
  const clearDrop=()=>results.querySelectorAll('.drop-before,.drop-after').forEach(n=>n.classList.remove('drop-before','drop-after'));
  root.addEventListener('dragstart',e=>{const handle=(e.target as HTMLElement).closest<HTMLElement>('[data-theme-drag]');if(!handle||group!=='收藏')return;dragged=handle.dataset.themeDrag!;host.cancel();if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragged);}root.classList.add('is-sorting');});
  root.addEventListener('dragover',e=>{if(!dragged)return;const card=(e.target as HTMLElement).closest<HTMLElement>('[data-sidebar-card]');if(!card)return;e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move';clearDrop();const box=card.getBoundingClientRect();card.classList.add(e.clientY>box.y+box.height/2?'drop-after':'drop-before');const bounds=results.getBoundingClientRect();if(e.clientY<bounds.top+40)results.scrollTop-=18;else if(e.clientY>bounds.bottom-40)results.scrollTop+=18;});
  const endSort=()=>{dragged='';clearDrop();root.classList.remove('is-sorting');host.cancel();};
  root.addEventListener('drop',e=>{if(!dragged)return;e.preventDefault();const card=(e.target as HTMLElement).closest<HTMLElement>('[data-sidebar-card]');if(card){const box=card.getBoundingClientRect();reorder(dragged,card.dataset.sidebarCard!,e.clientY>box.y+box.height/2);}endSort();});
  root.addEventListener('dragend',endSort);
  root.querySelector('#theme-sidebar-close')!.addEventListener('click',host.close);
  root.querySelector('#sidebar-theme-details')!.addEventListener('click',()=>{host.cancel();host.details();});
  root.addEventListener('pointerleave',host.cancel);
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();host.cancel();host.close();}});
  render();
  return {refresh:render,reveal:()=>{if(needsRender)render();else{previews.disconnect();for(const thumbnail of results.querySelectorAll<HTMLElement>('[data-pending-theme]'))previews.observe(thumbnail);}},updateCurrent};
}
