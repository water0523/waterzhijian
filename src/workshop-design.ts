import DOMPurify from 'dompurify';
import workshop from './workshop-style-data.json';
import {workshopColumns} from './workshop-blocks';
import {offlineModule} from './offline-modules';
import type {Typography} from './model';
import type {Theme} from './theme-types';

type WorkshopId=keyof typeof workshop;
type WorkshopStyle=(typeof workshop)[WorkshopId];

function workshopStyle(theme:Theme):WorkshopStyle|undefined{
  const key=(theme.baseId||theme.id).slice('workshop-'.length);
  return theme.variant==='workshop'&&Object.hasOwn(workshop,key)?workshop[key as WorkshopId]:undefined;
}

export function isWorkshop(theme:Theme){return theme.variant==='workshop';}
export function workshopThemeTags(theme:Theme){return workshopStyle(theme)?.tags??[];}

export function workshopOriginal(theme:Theme){
  const id=(theme.baseId||theme.id).slice('workshop-'.length);
  const lines=offlineModule<{examples:Record<string,string[]>}>('workshop').examples[id];
  const contents=DOMPurify.sanitize(lines?.join('\n')??'',{
    USE_PROFILES:{html:true,svg:true,svgFilters:true},
    FORBID_TAGS:['style','iframe','form','foreignObject'],
    FORBID_ATTR:['contenteditable']
  });
  return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:"><style>body{margin:0}a{pointer-events:none}</style><body>'+contents+'</body></html>';
}

export const workshopThemes:Theme[]=Object.entries(workshop).map(([id,design])=>({
  id:'workshop-'+id,
  name:design.name,
  group:design.group,
  description:design.description,
  variant:'workshop',
  accent:design.accent,
  paper:design.paper,
  ink:design.ink,
  font:['celadon','broadsheet'].includes(id)?'serif':'noto-sans',
  headingFont:['monocle','celadon','broadsheet'].includes(id)?'noto-serif':'noto-sans',
  defaults:{size:design.size,lineHeight:design.lineHeight,paragraphGap:16,padding:design.padding}
}));

function ornament(className:string,text=''){
  const span=document.createElement('span');
  span.className=className;
  span.setAttribute('aria-hidden','true');
  span.textContent=text;
  return span;
}

function artwork(className:string,svg:string){
  const span=ornament(className);
  span.innerHTML=DOMPurify.sanitize(svg,{USE_PROFILES:{svg:true}});
  return span;
}

export function decorateWorkshop(node:HTMLElement,theme:Theme){
  const design=workshopStyle(theme);
  if(!design)return;
  const cover=node.querySelector(':scope > h1');
  if(cover){
    const frame=document.createElement('span');
    frame.className='workshop-cover-frame';
    const topline=ornament('workshop-cover-topline');
    topline.append(artwork('workshop-crest',design.crest),ornament('workshop-masthead',design.name));
    frame.append(topline,...cover.childNodes);
    cover.append(frame);
    cover.classList.add('workshop-cover');
  }
  const id=theme.baseId||theme.id;
  const chinese=['壹','贰','叁','肆','伍','陆','柒','捌','玖','拾'];
  const roman=['I','II','III','IV','V','VI','VII','VIII','IX','X'];
  node.querySelectorAll(':scope > h2').forEach((heading,index)=>{
    let number=String(index+1).padStart(2,'0');
    if(id==='workshop-celadon')number=chinese[index]??number;
    if(id==='workshop-broadsheet')number=roman[index]??number;
    heading.prepend(ornament('workshop-number',number));
  });
  node.querySelectorAll('h3').forEach(heading=>heading.prepend(ornament('workshop-submark',design.submark)));
  for(const [kind,svg] of Object.entries(design.icons)){
    if(kind==='quote'){
      node.querySelectorAll('blockquote').forEach(quote=>quote.prepend(artwork('workshop-icon',svg)));
    }else{
      node.querySelectorAll('.workshop-'+kind).forEach(block=>{
        const label=block.querySelector(':scope>.workshop-title');
        (label||block).prepend(artwork('workshop-icon',svg));
      });
    }
  }
  if(design.divider){
    node.querySelectorAll('hr:not(.decorative-divider)').forEach(rule=>{
      if(rule.closest('.footnotes')||rule.classList.contains('footnotes-sep'))return;
      const divider=artwork('workshop-divider',design.divider);
      divider.setAttribute('role','separator');
      divider.removeAttribute('aria-hidden');
      if(rule.hasAttribute('data-line'))divider.setAttribute('data-line',rule.getAttribute('data-line')!);
      rule.replaceWith(divider);
    });
  }
}

export function workshopCSS(theme:Theme,accent:string,settings:Typography){
  const design=workshopStyle(theme);
  if(!design)return '';
  const id=theme.baseId||theme.id;
  const boldCover=id==='workshop-finance';
  const broadsheet=id==='workshop-broadsheet';
  const swiss=id==='workshop-swiss';
  const titleColors=swiss?'background:#e6392e;color:white;border-left:3px solid #111;padding:6px 12px':boldCover?'color:#e2bc72':broadsheet?'color:'+accent+';border-bottom:1px solid #241f1a;padding-bottom:5px':'color:'+accent;
  const styles=`
  ${settings.font?'':`.article{font-family:${design.bodyFont}}`}
  .article{letter-spacing:.4px}
  ${settings.headingFont?'':`.article h1,.article h2,.article h3{font-family:${design.headingFont}}`}
  .article .workshop-cover{${design.coverTitle};${design.cover};margin:0 0 22px}
  .article .workshop-cover-frame{display:block;${design.coverFrame};${swiss?'padding:0 14px 16px':''};${broadsheet?'text-align:center':''}}
  .article .workshop-crest{display:${id==='workshop-sakura'||broadsheet?'block':'inline-block'};vertical-align:middle;margin:${id==='workshop-sakura'||broadsheet?'0 auto 5px':'0 8px 0 0'};line-height:1;text-indent:0}
  .article .workshop-crest svg{width:${id==='workshop-sakura'?50:34}px;height:auto;vertical-align:middle}
  .article .workshop-cover-topline{display:block;line-height:1.5;margin:0 0 8px;${swiss?'background:#f5c400;border-bottom:3px solid #111':id==='workshop-sakura'?'text-align:center':''}}
  .article .workshop-masthead{display:inline-block;font-weight:800;font-size:11px;letter-spacing:2px;vertical-align:middle;${titleColors}}
  ${swiss?'.article .workshop-crest{background:#1a43bf;padding:4px 8px;margin:0}':''}
  .article h2{${design.chapterTitle};${design.chapter};margin:26px 0 14px}
  .article .workshop-number{display:${id==='workshop-monocle'||broadsheet?'block':'inline-block'};font-size:12px;font-weight:800;color:${accent};margin-right:9px;padding:${design.badge?'3px 8px':'0'};text-align:center;${design.badge}}
  .article h3{${design.subheading};margin:22px 0 11px}
  .article .workshop-submark{${design.submarkStyle}}
  .article h4{${design.minorHeading}}
  .article strong{${design.emphasis}}
  .article a{${design.link};color:${accent}}
  .article blockquote{border:0;${design.quote}}
  .article blockquote p{${design.quoteText}}
  .article .workshop-icon{display:inline-block;vertical-align:middle;line-height:1;margin-right:6px}
  .article .workshop-icon svg{width:18px;height:auto;vertical-align:middle}
  .article .workshop-author>.workshop-title .workshop-icon svg{width:30px}
  .article .image-wrap{${design.figure}}
  .article .image-caption{${design.caption}}
  .article .workshop-divider{display:block;text-align:center;margin:24px 0;line-height:1}
  .article .workshop-divider svg{max-width:100%;height:auto}
  .article table{border-collapse:separate;border-spacing:0;${design.table}}
  .article th{${design.tableHead};white-space:normal}
  .article td{${design.tableCell}}
  .article pre{${design.code};${design.codeText};padding:12px 14px;white-space:pre-wrap}
  .article .workshop-block{margin:16px 0 20px;overflow-wrap:anywhere}
  .article .workshop-title{${design.label};margin:0 0 6px}
  .article .workshop-content>:first-child{margin-top:0}
  .article .workshop-content>:last-child{margin-bottom:0}
  ${Object.entries(design.blocks).map(([kind,style])=>`.article .workshop-${kind}{${style}}`).join('\n')}
  ${workshopColumns.map(kind=>{
    const row=`.article .workshop-${kind}>.workshop-content:has(>.workshop-item):not(:has(>:not(.workshop-item)))`;
    const card=row+'>.workshop-item',variants=design.cards[kind];
    return `
      ${row}{display:table;table-layout:fixed;width:100%;border-spacing:6px}
      ${card}{display:table-cell;vertical-align:top;${variants[0].style};${kind==='compare'?'padding:10px':''}}
      ${variants.map(({style,headingColor},index)=>{
        const current=`${card}:nth-child(${variants.length}n+${index+1})`;
        return `${current}{${style};${kind==='compare'?'padding:10px':''}}${headingColor?`${current}>.workshop-title{color:${headingColor}}${current}{color:${swiss?headingColor:theme.ink}}`:''}`;
      }).join('\n')}`;
  }).join('\n')}
  .article .workshop-kpi .workshop-item .workshop-title{font-size:21px;letter-spacing:0;color:${swiss?'white':accent}}
  .article .workshop-timeline ol,.article .workshop-timeline ul{border-left:2px solid ${accent}}
  .article .workshop-dialogue .workshop-item{padding:9px 12px;background:${theme.paper};border-left:2px solid ${accent}}
  .article .workshop-poster,.article .workshop-poster p,.article .workshop-poster .workshop-title{${design.posterText}}
  .article .workshop-poster strong,.article .workshop-poster a,.article .workshop-poster em{color:inherit}
  `;
  return styles.replace(new RegExp(design.accent,'gi'),accent);
}
