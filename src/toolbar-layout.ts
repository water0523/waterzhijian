import {uiIcon} from './ui-icons';
export function compactToolbar(){
 const toolbar=document.querySelector<HTMLElement>('.format-toolbar')!;
 const make=(id:string,label:string)=>{const d=document.createElement('details');d.id=id;d.className='toolbar-menu';d.innerHTML='<summary title="'+label+'" aria-label="'+label+'">'+label+'</summary><div class="toolbar-menu-content"></div>';toolbar.append(d);d.addEventListener('toggle',()=>{if(d.open)toolbar.querySelectorAll<HTMLDetailsElement>('details').forEach(other=>{if(other!==d)other.open=false;});});return d.querySelector('div')!;};
 const insert=make('insert-menu-button','＋ 插入'),more=make('toolbar-more','更多');
 const high=new Set(['heading','bold','italic','underline','strike','quote','table','poem','code','footnote','link']);const insertFormats=new Set<string>();
 for(const b of [...toolbar.querySelectorAll<HTMLButtonElement>(':scope > button')]){const format=b.dataset.format;if(format&&!high.has(format))(insertFormats.has(format)?insert:more).append(b);else if(!format&&!['inline-style-button','image-button','math-button','undo-button','redo-button','search-button'].includes(b.id))more.append(b);}
 for(const b of [...toolbar.querySelectorAll<HTMLButtonElement>('.advanced-tools button')])insert.append(b);toolbar.querySelector('.advanced-tools')?.remove();document.getElementById('advanced-tools-toggle')?.remove();
 for(const id of ['journal-block-button','folio-block-button','edition-block-button','exam-block-button','anime-block-button','folio-font-button','image-layout-button','divider-button']){const n=document.getElementById(id);if(n)insert.append(n);}
 const link=toolbar.querySelector<HTMLButtonElement>('[data-format="link"]')!;for(const format of ['quote','table','poem','code','footnote']){const n=toolbar.querySelector<HTMLButtonElement>(`[data-format="${format}"]`);if(n)link.before(n);}
 for(const id of ['assets-button','table-style-button','style-button']){const n=document.getElementById(id);if(n)more.append(n);}
 document.getElementById('sync-button')!.before(document.getElementById('format-rewrite-button')!);
 for(const id of ['writing-desk-button','outline-toggle']){const n=document.getElementById(id);if(n)n.hidden=true;}
 const icons:Record<string,string>={bold:'bold',italic:'italic',underline:'underline',strike:'strike',link:'link',quote:'quote',table:'table',code:'code',poem:'document',footnote:'document',heading:'heading'};const byID:Record<string,string>={'image-button':'image','math-button':'math','undo-button':'undo','redo-button':'redo','search-button':'search'};
 toolbar.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{b.title ||= b.textContent?.trim()||'工具';b.setAttribute('aria-label',b.title);const icon=icons[b.dataset.format||'']||byID[b.id];if(icon){b.innerHTML=uiIcon(icon);b.classList.add('format-icon');}});
 document.querySelectorAll<HTMLElement>('.toolbar-left button,.toolbar-right button').forEach(b=>{b.title ||= b.textContent?.trim()||'写作工具';b.setAttribute('aria-label',b.getAttribute('aria-label')||b.title);});
 document.addEventListener('pointerdown',e=>{toolbar.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(d=>{if(!d.contains(e.target as Node)&&!(e.target as HTMLElement).closest('#quick-popover'))d.open=false;});});document.addEventListener('keydown',e=>{if(e.key==='Escape'){const open=toolbar.querySelector<HTMLDetailsElement>('details[open]');if(open){e.preventDefault();open.open=false;open.querySelector<HTMLElement>('summary')!.focus();}}});
 document.addEventListener('paper-insert-components',()=>{const d=document.getElementById('insert-menu-button') as HTMLDetailsElement;d.open=true;d.querySelector<HTMLElement>('summary')?.focus();});
 // Keep detailed settings accessible through the unified settings panel.
 for(const id of ['ui-settings-button','export-toggle']){const n=document.getElementById(id);if(n)n.hidden=true;}
}
