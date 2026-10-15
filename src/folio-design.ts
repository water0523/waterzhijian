import {fontStacks} from './model';
import type {Theme} from './theme-types';
export const isFolio=(t:Theme)=>(t.baseId||t.id)==='folio';
export const fishTail='<svg xmlns="http://www.w3.org/2000/svg" width="180" height="18" viewBox="0 0 180 18"><path d="M0 9h60m60 0h60" stroke="#ad8953" stroke-width="1"/><path d="M67 2h46l-8 7 8 7H67l8-7z" fill="currentColor"/><circle cx="90" cy="9" r="2" fill="#faf7ef"/></svg>';
const decoration=(cls:string,text='')=>{const span=document.createElement('span');span.className=cls;span.textContent=text;span.setAttribute('aria-hidden','true');return span;};
export function initialLetter(p:HTMLElement){
  const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let text:Text|null;
  while((text=walker.nextNode() as Text|null)){
    if(!text.data.trim()||text.parentElement?.closest('.math-inline,code,[aria-hidden=true],.literary-note,.literary-aside,.footnote-ref'))continue;
    const start=text.data.search(/\S/u),rest=text.splitText(start),first=Array.from(rest.data)[0];rest.splitText(first.length);
    const initial=document.createElement('span');initial.className='text-initial folio-initial';rest.replaceWith(initial);initial.append(rest);return initial;
  }
}
export function decorateFolio(node:HTMLElement){
  for(const heading of node.querySelectorAll<HTMLElement>('h1,h2,h3')){
    const subtitle=heading.nextElementSibling;if(subtitle?.classList.contains('journal-subtitle'))heading.append(subtitle);
    if(heading.tagName==='H2'&&heading.parentElement===node){const tail=decoration('folio-fishtail');tail.innerHTML=fishTail;heading.prepend(tail);}
  }
  for(const box of node.querySelectorAll<HTMLElement>('.folio-preface')){
    box.style.position='relative';box.querySelector('.folio-title')?.append(decoration('folio-seal','文心'));
    for(const corner of ['tl','tr','bl','br']){const line=decoration('folio-corner');line.style.cssText=`position:absolute;width:12px;height:12px;${corner[0]==='t'?'top':'bottom'}:9px;${corner[1]==='l'?'left':'right'}:9px;border-${corner[0]==='t'?'top':'bottom'}:1px solid #ad8953;border-${corner[1]==='l'?'left':'right'}:1px solid #ad8953;`;box.append(line);}
  }
  for(const box of node.querySelectorAll<HTMLElement>('.folio-prose')){
    const p=box.querySelector<HTMLElement>(':scope > .folio-content > p');if(!p||!initialLetter(p))continue;
    p.classList.add('folio-opening');p.style.position='relative';
    const stamp=decoration('folio-start-seal');stamp.style.cssText='position:absolute;left:3.4em;top:1px;line-height:1;text-indent:0;';
    const label=document.createElement('span');label.textContent='起首';stamp.append(label);p.append(stamp);
  }
  for(const mark of node.querySelectorAll('.literary-rhyme'))mark.append(decoration('folio-rhyme-mark','△'));
  for(const box of node.querySelectorAll('.folio-modern')){
    const lines=[...box.querySelectorAll<HTMLElement>('.poem-line')].filter(line=>line.textContent?.trim());
    for(const [index,line]of lines.entries()){
      line.style.width='100%';
      const number=decoration('folio-line-number',[1,5,10,lines.length].includes(index+1)?String(index+1).padStart(2,'0'):'');number.style.width='1%';
      const text=document.createElement('span');text.className='folio-verse-text';text.append(...line.childNodes);line.append(number,text);
    }
  }
  for(const box of node.querySelectorAll('.folio-colophon'))box.append(decoration('folio-bookplate','山窗藏书'));
  for(const image of node.querySelectorAll<HTMLElement>('.folio-hanging .image-wrap'))image.style.width='72%';
  for(const box of node.querySelectorAll('.folio-handscroll > .folio-content')){
    const track=document.createElement('section');track.className='folio-handscroll-track';track.style.minWidth='1000px';track.append(...box.childNodes);box.append(track);
    const colophons=[...track.querySelectorAll(':scope > blockquote')];if(colophons.length){const row=document.createElement('section');row.className='folio-colophons';row.append(...colophons);track.append(row);}
  }
}
// Publication favors a complete, ordinary reading flow. Vertical text and
// horizontal galleries stay in the local workspace; no words are rasterized.
export function normalizeFolioPublication(node:HTMLElement){
  for(const scroll of node.querySelectorAll<HTMLElement>('.folio-scroll .poem')){
    scroll.style.writingMode='horizontal-tb';scroll.style.height='auto';scroll.style.width='100%';scroll.style.maxWidth='100%';scroll.style.whiteSpace='pre-wrap';scroll.style.backgroundImage='none';scroll.style.display='block';
  }
  for(const content of node.querySelectorAll<HTMLElement>('.folio-scroll > .folio-content,.folio-handscroll > .folio-content,.folio-handscroll-track,.folio-colophons')){content.style.minWidth='0';content.style.maxWidth='100%';content.style.width='auto';content.style.height='auto';content.style.maxHeight='none';content.style.overflow='visible';content.style.display='block';}
  for(const text of node.querySelectorAll<HTMLElement>('.literary-aside,.literary-painting')){text.style.writingMode='horizontal-tb';text.style.float='none';text.style.display='block';text.style.maxHeight='none';text.style.maxWidth='100%';text.style.margin='10px 0';}
  for(const image of node.querySelectorAll<HTMLElement>('.folio-hanging .image-wrap')){image.style.float='none';image.style.width='86%';image.style.margin='0 auto';}
}
export function folioCSS(t:Theme,a:string){
  const serif=fontStacks['noto-serif'],kai=fontStacks.wenkai,fang=fontStacks.fang,gold='#ad8953',line='#c9bda9',muted='#756b60';
  const common=`.article .folio-block{margin:30px 0;clear:both;text-indent:0}.article .folio-title{font:700 18px/1.7 ${serif};letter-spacing:.12em;margin:0 0 18px;color:${a};text-indent:0}
   .article .folio-content>p:last-child{margin-bottom:0}.article .literary-note{font-family:${fang};font-size:.8em;letter-spacing:.1em;line-height:1.7;color:${a};background:${a}06;border:1px solid ${a}25;border-radius:3px;padding:3px 6px;box-decoration-break:clone}
   .article .literary-preface{display:block;font:13px/1.9 ${fang};color:${muted};letter-spacing:.1em;margin:8px 0 20px;text-indent:0}.article .literary-rhyme{font-family:${kai}}.article .folio-rhyme-mark{font:9px ${fang};color:${gold};vertical-align:super;margin-left:3px}
   .article .literary-aside{float:right;writing-mode:vertical-rl;text-orientation:upright;max-height:11em;font:12px/1.9 ${fang};letter-spacing:.15em;border-left:1px solid ${gold};padding:5px 8px;margin:8px 0 12px 14px;color:${a}}
   .article .literary-painting{font-family:${fang};letter-spacing:.12em;line-height:2}.article .folio-preface{background:#f2ecdf;border:1px solid ${line};border-radius:10px;padding:28px 24px;font-family:${fang};color:${muted};line-height:2.25;letter-spacing:.12em}.article .folio-preface .folio-content>p:last-child{text-align:right;font-size:13px}
   .article .folio-seal{float:right;background:${a};color:#fffaf0;font:700 12px/1.2 ${kai};writing-mode:vertical-rl;letter-spacing:.1em;padding:4px;border-radius:2px;margin-left:12px}
   .article .folio-masthead{display:table;width:100%;border-top:2px solid ${gold};border-bottom:1px dashed ${line};padding:12px 0 15px}.article .folio-masthead>.folio-title{display:table-cell;width:1%;white-space:nowrap;vertical-align:middle;background:${a};color:#fff8e9;font:700 11px/1.5 ${kai};letter-spacing:.1em;padding:5px 8px}.article .folio-masthead>.folio-content{display:table-cell;vertical-align:middle;padding-left:12px;font:12px/1.8 ${fang};letter-spacing:.1em;color:${muted}}.article .folio-masthead p{margin:0}
   .article .folio-byline{margin:22px 0 32px;text-align:center;font:12px/2 ${fang};letter-spacing:.1em;color:${muted}}
   .article .folio-prose{display:flow-root;margin:38px 0}.article .folio-opening{text-indent:2.2em}.article .folio-initial{float:left;font:700 2.8em/1.1 ${serif};color:${t.ink};margin:5px 12px 0 0;text-indent:0}.article .folio-start-seal>span{display:inline-block;font:10px/1.4 ${kai};letter-spacing:.08em;color:${a};border:1px solid ${a};padding:1px 4px}
   .article .folio-ci,.article .folio-scroll,.article .folio-modern,.article .folio-classical,.article .folio-letter{border:1px solid ${line};border-radius:14px;padding:24px;background:#fffdf866;overflow:hidden}.article .folio-ci>.folio-title,.article .folio-modern>.folio-title{text-align:center;color:${t.ink};border-bottom:1px solid ${line};padding-bottom:14px}
   .article .folio-ci .poem,.article .folio-scroll .poem,.article .folio-letter{font-family:${kai};font-size:17px;line-height:2.3}.article .folio-ci .poem{margin:12px 0;text-align:center}.article .folio-scroll>.folio-content{overflow-x:auto;overscroll-behavior:contain;padding-bottom:12px;scrollbar-color:${gold} #f0eadd;scrollbar-width:thin}
   .article .folio-scroll .poem{display:block;writing-mode:horizontal-tb;white-space:pre-wrap;height:auto;min-width:0;max-width:100%;margin:12px 0;padding:0;font-family:${kai};font-size:17px;line-height:2.3;letter-spacing:.08em;text-align:center}
   .article .folio-classical{font-family:${serif};font-size:17px;line-height:2.65;letter-spacing:.12em}.article .folio-classical>.folio-title{border-bottom:1px solid ${line};padding-bottom:16px;color:${t.ink}}.article .folio-gloss{border:1px solid ${line};border-radius:10px;background:#f1eadf;overflow:hidden;padding:0;font-family:${fang}}
   .article .folio-gloss>.folio-title{font:700 14px/1.8 ${fang};letter-spacing:.08em;background:#e9ddcd;padding:12px 16px;margin:0;cursor:pointer;border-bottom:1px solid ${line};list-style:disclosure-open}.article .folio-gloss:not([open])>.folio-title{list-style:disclosure-closed}.article .folio-gloss>.folio-content{max-height:260px;overflow-y:auto;padding:18px;font:14px/2.1 ${fang};letter-spacing:.08em;color:${muted};overscroll-behavior:contain;scrollbar-color:${gold} #f1eadf;scrollbar-width:thin}
   .article .folio-modern .poem{white-space:normal;font-family:inherit;line-height:2.3;margin:20px 0 0;padding:0}.article .folio-modern .poem-line{display:table;width:100%;margin:0}.article .folio-modern .poem-line:empty{display:block;height:1.2em}.article .folio-line-number{display:table-cell;vertical-align:top;color:${gold};font:10px/3.7 Consolas,monospace;letter-spacing:.06em;padding-right:12px;white-space:nowrap}.article .folio-verse-text{display:table-cell;vertical-align:top;white-space:pre-wrap}
   .article .folio-hanging{padding:28px 22px;background:#e9e1d2;border-top:5px solid #6c5741;border-bottom:5px solid #6c5741;box-shadow:0 3px 10px #4e3b2710;display:flow-root}.article .folio-hanging>.folio-title{text-align:center;color:${t.ink};font-size:16px}.article .folio-hanging .folio-content{display:flow-root}.article .folio-hanging .image-wrap{float:left;max-width:76%;margin:0 4% 0 0;border:8px solid #f8f3e7;outline:1px solid ${line};background:#fffaf0}.article .folio-hanging .image-caption{padding:10px 7px}.article .folio-hanging .literary-painting{display:block;float:right;writing-mode:vertical-rl;text-orientation:upright;max-height:18em;letter-spacing:.12em;text-align:left;margin:10px 0 0;font-size:14px}
   .article .folio-handscroll{padding:20px 14px;background:#eee5d5;border-top:3px double #9b805f;border-bottom:3px double #9b805f}.article .folio-handscroll>.folio-title{text-align:center;font-size:16px;color:${t.ink}}.article .folio-handscroll>.folio-content{overflow-x:auto;scrollbar-color:${gold} #eee5d5;scrollbar-width:thin;padding-bottom:12px}.article .folio-handscroll-track>.image-wrap,.article .folio-handscroll-track>p{margin:0}.article .folio-handscroll .image-caption{font-family:${fang};padding:8px}.article .folio-colophons{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;padding-top:18px}.article .folio-colophons blockquote{font:14px/2 ${fang};margin:0;padding:6px 14px;border:0;border-left:1px solid ${gold};background:none;color:${muted}}
   .article .folio-album{background:#e9e1d2;border:1px solid ${line};padding:18px 12px}.article .folio-album>.folio-title{text-align:center;color:${t.ink};font-size:16px}.article .folio-album .image-wrap{background:#fffaf0;border:7px solid #faf5e8;outline:1px solid #c4b598}.article .folio-album .image-caption{font:12px/1.9 ${fang};text-align:center;padding:8px 3px;color:${muted}}
   .article .folio-colophon{border:3px double ${gold};padding:24px 18px;text-align:center;background:#f3edde;font:13px/2.1 ${fang};letter-spacing:.12em}.article .folio-colophon>.folio-title{font:700 15px/1.8 ${serif};color:${t.ink}}.article .folio-bookplate{display:table;margin:20px auto 0;padding:5px;border:2px solid ${a};outline:1px solid ${a};outline-offset:3px;font:700 16px/1.3 ${kai};letter-spacing:.15em;max-width:45px;color:${a};word-break:break-all}
  `;
  if(!isFolio(t))return common;
  return common+`.article{letter-spacing:.06em;display:flow-root;background-image:radial-gradient(#9e784b0d .45px,transparent .45px);background-size:13px 13px}.article h1,.article h2{font-family:${serif};font-weight:700;color:${t.ink};letter-spacing:.16em;text-align:center}.article h1{font-size:29px;line-height:1.8;margin:28px 0 22px;padding:0;border:0;text-wrap:balance}.article h1 .theme-kicker{display:none}.article h2{display:block;margin:52px 0 32px;padding:0;border:0;line-height:1.8;font-size:21px;background:none}.article h2 .theme-heading-text{display:block;border-top:1px solid ${gold};border-bottom:1px solid ${gold};padding:9px 0}.article .folio-fishtail{display:block;color:${a};margin:0 auto 9px;line-height:1}.article .journal-subtitle{font:11px/1.9 ${fang};letter-spacing:.2em;color:${muted};text-align:center;margin:10px 0 0}.article h3{font:700 18px/1.9 ${serif};color:${t.ink};border:0;border-left:2px solid ${gold};padding-left:12px;letter-spacing:.12em}
   .article strong{color:inherit;background:none}.article blockquote{font-family:${kai};font-size:17px;line-height:2.1;border:0;border-left:2px solid ${gold};padding:10px 18px;background:#eee6d827;color:${muted};letter-spacing:.08em}.article .image-caption{font-family:${fang};color:${muted};border:0;letter-spacing:.08em}.article .image-source{font-family:${fang};color:${muted}}.article .poem{font-family:${kai}}.article .footnotes{font-family:${fang};color:${muted};border-color:${line}}.article hr{border-top:1px solid ${gold};width:35%;margin:36px auto}
  `;
}
