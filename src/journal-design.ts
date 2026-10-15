import {fontStacks} from './model';
import type {Theme} from './theme-types';
export const isJournal=(theme:Theme)=>['journal-indigo','journal-jade'].includes(theme.baseId||theme.id);

export function decorateJournal(node:HTMLElement){
  for(const h of node.querySelectorAll('h1,h2,h3')){
    const subtitle=h.nextElementSibling;
    if(subtitle?.classList.contains('journal-subtitle'))(h.querySelector('.theme-heading-text')||h).append(subtitle);
  }
  for(const box of node.querySelectorAll('.journal-abstract')){
    const title=box.querySelector('.journal-block-title');if(title){const dot=document.createElement('span');dot.textContent='●';dot.setAttribute('aria-hidden','true');dot.style.cssText='color:#b77612;font-size:10px;margin-right:8px';title.prepend(dot);}
    const p=box.querySelector<HTMLElement>('.journal-content > p');if(!p)continue;
    const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let text:Text|null;
    while((text=walker.nextNode() as Text|null)){
      if(!text.data.trim()||text.parentElement?.closest('.math-inline,code,.footnote-ref'))continue;
      const at=text.data.search(/\S/u),part=text.splitText(at),char=Array.from(part.data)[0];part.splitText(char.length);
      const initial=document.createElement('span');initial.className='journal-initial';part.replaceWith(initial);initial.append(part);break;
    }
  }
  for(const quote of node.querySelectorAll('blockquote')){
    const symbol=document.createElement('span');symbol.className='journal-quote-mark';symbol.textContent='“';symbol.setAttribute('aria-hidden','true');quote.prepend(symbol);
    const last=quote.querySelector('p:last-child');if(/^\s*[—–]/.test(last?.textContent||''))last!.classList.add('journal-citation');
  }
  for(const caption of node.querySelectorAll('.image-caption')){
    const text=caption.textContent||'',at=text.indexOf(' · ');if(at<0)continue;
    const label=document.createElement('strong');label.className='journal-figure-label';label.textContent='▲ '+text.slice(0,at);caption.replaceChildren(label,document.createTextNode(' · '+text.slice(at+3)));
  }
  for(const title of node.querySelectorAll('.journal-takeaways > .journal-block-title')){
    const check=document.createElement('span');check.className='journal-check';check.textContent='✓';check.setAttribute('aria-hidden','true');title.prepend(check);
  }
  for(const ol of node.querySelectorAll('.journal-takeaways > .journal-content > ol'))for(const [i,li] of [...ol.children].entries()){
    const text=document.createElement('section');text.className='journal-item-text';text.append(...li.childNodes);
    const number=document.createElement('span');number.className='journal-item-number';number.style.width='1%';number.textContent=String(i+1).padStart(2,'0')+'.';number.setAttribute('aria-hidden','true');li.append(number,text);
  }
}

// These semantic blocks remain useful in every theme, while the two journal
// variants add the reference's complete typography and editorial treatment.
export function journalCSS(t:Theme,a:string){
  const line=a+'22',soft=a+'08',tint=a+'0c',serif=fontStacks['noto-serif'],sans=fontStacks['noto-sans'],mono=fontStacks.jetbrains;
  const common=`.article .journal-block{margin:28px 0;border:1px solid ${line};border-radius:12px;background:#fff;padding:20px;clear:both;overflow-wrap:anywhere}
   .article .journal-block-title{font:700 18px/1.6 ${serif};color:${a};margin:0 0 14px;text-indent:0}
   .article .journal-content>p:last-child{margin-bottom:0}.article .journal-subtitle{display:block;font:11px/1.7 ${mono};color:#647185;letter-spacing:.14em;margin:5px 0 0;text-indent:0}
   .article .journal-theorem{background-color:#fff;background-image:radial-gradient(${a}22 .7px,transparent .7px);background-size:14px 14px;border-left:3px solid ${a}}
   .article .journal-equation{padding:0;overflow:hidden}.article .journal-equation>.journal-block-title{float:right;font:12px/1.7 ${mono};margin:22px 16px 8px 10px;white-space:nowrap;color:#647185}
   .article .journal-equation .math-display{background:none;border:0;border-radius:0;margin:0;padding:22px 12px;box-shadow:none}
   .article .journal-equation>.journal-content>p,.article .journal-equation>.journal-content>ul{clear:both;background:${tint};border-top:1px solid ${line};padding:12px 16px;margin:0;font-size:12px;line-height:1.8;text-indent:0}
   .article .journal-derivation{background:#f8f9fb;padding:0;overflow:hidden}.article .journal-derivation>.journal-block-title{cursor:pointer;list-style:disclosure-open;background:${tint};font:600 14px/1.7 ${serif};padding:12px 16px;margin:0;border-bottom:1px solid ${line}}
   .article .journal-derivation:not([open])>.journal-block-title{list-style:disclosure-closed}.article .journal-derivation>.journal-content{padding:18px;max-height:340px;overflow-y:auto;overscroll-behavior:contain;scrollbar-color:${a} #e9edf3;scrollbar-width:thin}
   .article .journal-derivation .math-display{border:1px solid ${line};border-radius:5px;background:#fff}
   .article .journal-takeaways>.journal-block-title{border-bottom:1px solid ${line};padding-bottom:12px}.article .journal-check{display:inline-block;background:${a};color:white;border-radius:6px;font:700 15px/1.6 ${sans};padding:0 5px;margin-right:9px}
   .article .journal-takeaways ol{list-style:none;padding:0;margin:0}.article .journal-takeaways li{display:table;width:100%;padding:0;margin:14px 0}.article .journal-item-number{display:table-cell;vertical-align:top;color:#b36f10;font:700 12px/1.9 ${mono};padding-right:10px;white-space:nowrap}.article .journal-item-text{display:table-cell;vertical-align:top}
   .article .journal-references{background:none;border:0;border-top:1px solid ${line};border-radius:0;padding:22px 0 0;box-shadow:none}.article .journal-references>.journal-block-title{font:600 11px/1.8 ${mono};letter-spacing:.08em;color:#5f6e82}.article .journal-references .journal-content{font-size:12px;line-height:1.8;color:#627083}
   .article .journal-abstract>.journal-block-title{font:700 11px/1.8 ${mono};letter-spacing:.12em}.article .journal-initial{float:left;font:700 3.2em/.98 ${serif};color:${a};margin:4px 11px 0 0;text-indent:0}
   .article .journal-abstract .journal-content>ul{border-top:1px solid ${line};padding:12px 0 0;list-style:none;font-size:12px;color:#627083;margin:16px 0 0}.article .journal-abstract li{margin:3px 0;padding:0}
   .article .journal-citation{text-align:right;font:12px/1.8 ${sans};color:#627083;margin-top:10px}.article .journal-quote-mark{display:block;height:18px;font:700 44px/.7 ${serif};color:${a};opacity:.23;margin:0 0 7px -4px}
   .article .journal-figure-label{font-family:${sans};font-weight:700;color:${a};background:none;border:0}
  `;
  if(!isJournal(t))return common;
  return common+`.article{letter-spacing:.04em;display:flow-root}
   .article h1,.article h2,.article h3{font-family:${serif};color:${a};letter-spacing:0;text-align:left}
   .article h1{font-size:29px;line-height:1.55;background:none;border:0;border-bottom:1px solid ${line};padding:8px 0 22px;margin:8px 0 28px}
   .article h1 .theme-kicker{font:10px/1.8 ${mono};letter-spacing:.16em;color:#607086;opacity:1;margin:0 0 12px}
   .article h2{display:table;width:100%;border:0;border-bottom:1px solid ${line};border-radius:0;background-color:transparent;background-image:linear-gradient(${a},${a});background-size:64px 3px;background-repeat:no-repeat;background-position:left bottom;box-shadow:none;font-size:21px;line-height:1.6;margin:38px 0 22px;padding:0 0 14px}
   .article h2 .theme-heading-mark{display:table-cell;vertical-align:top;white-space:nowrap;padding-right:10px}.article h2 .theme-badge{background:none;border:0;color:${a}50;font:italic 700 23px/1.5 ${mono};padding:0;margin:0;border-radius:0}.article h2 .theme-heading-text{display:table-cell;vertical-align:top}
   .article h3{font-size:18px;background:linear-gradient(90deg,${tint},transparent);border:0;border-left:4px solid ${a};padding:6px 12px;margin:26px 0 18px}
   .article strong{color:inherit;background:linear-gradient(transparent 64%,#f4d17c73 64%);border:0;padding:0}
   .article blockquote{position:relative;background:#f8f9fb;border:1px solid ${line};border-radius:11px;color:${t.ink};padding:20px;margin:28px 0;font-size:16px;line-height:2;font-style:normal;box-shadow:none}
   .article .journal-block{box-shadow:0 3px 12px #17244704}.article .journal-abstract>.journal-block-title{color:${a}}
   .article .image-wrap{border:1px solid ${line};border-radius:12px;background:#fff;padding:12px}.article .image-wrap .image-caption{text-align:left;font-size:12px;line-height:1.85;letter-spacing:0;border:0;padding:0;margin-top:12px}.article .image-source{text-align:left}
   .article table:not([role=presentation]){border:0;border-top:2px solid ${a};border-bottom:2px solid ${a};background:white;font-size:13px;line-height:1.75;margin:28px 0;clear:both}
   .article table:not([role=presentation]) th,.article table:not([role=presentation]) td{border:0;border-bottom:1px solid ${line};padding:11px 9px;background:white;color:${t.ink}}
   .article table:not([role=presentation]) th{font-family:${serif};color:${a};font-weight:700;background:${tint};border-bottom:1px solid ${a}}
   .article table:not([role=presentation]) td:first-child{font-weight:600;color:${a}}.article table:not([role=presentation]) tr:last-child td{border-bottom:0}
   .article code{font-family:${mono};background:${soft};border:1px solid ${line};color:${a};padding:1px 5px;border-radius:4px;letter-spacing:0}.article pre code{border:0;padding:0;background:none;color:inherit}
   .article .math-display{background:white;border:1px solid ${line};border-radius:12px;padding:22px 10px;margin:24px 0}
   .article .footnotes{color:#627083;border-top:1px solid ${line}}
   .article .journal-references{box-shadow:none}.article .journal-subtitle{letter-spacing:.14em;font-weight:400}
  `;
}
