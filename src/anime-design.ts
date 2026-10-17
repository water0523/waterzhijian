import type {Theme} from './theme-types';
import {fontStacks,type Typography} from './model';
import {readableColor} from './theme-readability';
export const isAnime=(theme:Theme)=>theme.variant==='anime';
const palettes={
 'anime-sakura':{soft:'#fff0f5',line:'#ffc2d6',light:'#ff9ebb',secondary:'#7c69ef',mint:'#eefcf8',mintLine:'#4cd3a5',muted:'#8c7687',dots:'#ffd6e5'},
 'anime-matcha':{soft:'#eef9ee',line:'#b7e4c7',light:'#8ce0b8',secondary:'#ce6545',mint:'#fff0f3',mintLine:'#eaa1b4',muted:'#6b8577',dots:'#c8ecc8'}
};
export const animeThemes:Theme[]=[
 {id:'anime-sakura',name:'樱粉魔法',group:'通用',description:'樱粉与星紫、圆体胶囊章节、胶带引文与角色小剧场',accent:'#ff6b9d',paper:'#ffffff',ink:'#4a3b47',font:'anime-sans',headingFont:'rounded',quoteFont:'wenkai',captionFont:'kai',poemFont:'wenkai',codeFont:'jetbrains',variant:'anime',defaults:{size:15.5,lineHeight:1.82,paragraphGap:18,padding:26,indent:false}},
 {id:'anime-matcha',name:'抹茶猫猫',group:'通用',description:'抹茶绿与暖橘、猫咪题签、拍立得与软萌设定手札',accent:'#52b788',paper:'#ffffff',ink:'#344e41',font:'anime-sans',headingFont:'rounded',quoteFont:'wenkai',captionFont:'kai',poemFont:'wenkai',codeFont:'jetbrains',variant:'anime',defaults:{size:15.5,lineHeight:1.82,paragraphGap:18,padding:26,indent:false}}
];
const mark=(cls:string,text='')=>{const el=document.createElement('span');el.className=cls;el.setAttribute('aria-hidden','true');el.textContent=text;return el;};
const cat='<svg xmlns="http://www.w3.org/2000/svg" width="72" height="60" viewBox="0 0 72 60"><path d="M13 27 9 7l19 10h16L63 7l-4 20c13 22-2 29-23 29S0 49 13 27Z" fill="#eef9ee" stroke="#388e66" stroke-width="2.5" stroke-linejoin="round"/><path d="m18 17 2 10 8-4m26-6-2 10-8-4" fill="#ffcdd9"/><path d="M23 35h5m16 0h5M31 43q5 7 10 0" fill="none" stroke="#344e41" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="19" cy="42" rx="5" ry="2.5" fill="#b7e4c7"/><ellipse cx="53" cy="42" rx="5" ry="2.5" fill="#b7e4c7"/></svg>';
const wand='<svg xmlns="http://www.w3.org/2000/svg" width="72" height="60" viewBox="0 0 72 60"><path d="m19 52 26-29" stroke="#b7aaf6" stroke-width="7" stroke-linecap="round"/><path d="m45 4 6 11 13 2-9 9 2 13-12-6-11 6 2-13-9-9 13-2Z" fill="#fff0a8" stroke="#e84a7f" stroke-width="2" stroke-linejoin="round"/><path d="m14 10 2 5 6 2-6 2-2 5-2-5-6-2 6-2Z" fill="#ff9ebb"/><circle cx="63" cy="45" r="3" fill="#7c69ef"/></svg>';
export function decorateAnime(node:HTMLElement,theme:Theme){
 if(!isAnime(theme)&&!node.querySelector('.anime-block'))return;
 if(isAnime(theme)){
  for(const h of node.querySelectorAll('h1')){const icon=mark('anime-mascot');icon.innerHTML=(theme.baseId||theme.id)==='anime-matcha'?cat:wand;h.prepend(icon);}
  for(const q of node.querySelectorAll('blockquote'))q.prepend(mark('anime-tape','✦'));
  for(const badge of node.querySelectorAll<HTMLElement>('h2 .theme-badge'))badge.style.cssText+='width:30px;height:30px;';
 }
 for(const q of node.querySelectorAll('.anime-quote'))q.prepend(mark('anime-tape','✦'));
 for(const q of node.querySelectorAll('.anime-left,.anime-right'))q.prepend(mark('anime-avatar',q.classList.contains('anime-right')?'✦':'✿'));
 for(const badge of node.querySelectorAll<HTMLElement>('.anime-avatar'))badge.style.cssText+='width:28px;height:28px;';
 // Decorate only literal percentage cells. Original labels and values stay in
 // their mapped table cells, so preview edits, search and exports remain exact.
 for(const cell of node.querySelectorAll<HTMLElement>('.anime-profile > .anime-content > table > tbody > tr > td:last-child')){
  if(cell.parentElement?.children.length!==2||!/^\d+(?:\.\d+)?\s*%$/.test(cell.textContent?.trim()||''))continue;
  const value=Number(cell.textContent!.replace('%',''));if(value<0||value>100)continue;
  const rail=mark('anime-stat-rail'),bar=mark('anime-stat-fill');rail.style.cssText='width:100%;height:8px;overflow:hidden;';bar.style.cssText='width:'+value+'%;height:100%;';rail.append(bar);cell.append(rail);
 }
}
export function animeCSS(theme:Theme,a:string,o:Typography={}){
 const p=palettes[(theme.baseId||theme.id) as keyof typeof palettes]||palettes['anime-sakura'],dark=readableColor(a,'#ffffff'),secondary=readableColor(p.secondary,'#ffffff'),muted=readableColor(p.muted,'#ffffff');
 const rounded=fontStacks[o.headingFont||theme.headingFont||'rounded'],quote=fontStacks[theme.quoteFont||'wenkai'];
 // Static, regular block flow works when pasted into the public-account editor.
 // No hover state, external font, grid, pseudo element or script is required.
 const components=`
 .article .anime-block{margin:24px 0;padding:18px 16px;border:2px solid ${p.line};border-radius:18px;background:${p.soft};color:inherit;text-indent:0;clear:both}
 .article .anime-title{font-family:${rounded};font-size:.92em;font-weight:700;color:${dark};line-height:1.65;margin:0 0 12px;text-indent:0;overflow-wrap:anywhere}
 .article .anime-content{display:flow-root}.article .anime-content>p:last-child{margin-bottom:0}.article .anime-content>p{text-indent:0}
 .article .anime-banner{background:#fef9e7;border-style:dashed;box-shadow:3px 3px 0 ${p.line};padding:12px 16px;font-size:.9em}
 .article .anime-banner>.anime-title{display:inline-block;background:${dark};color:#fff;border-radius:999px;padding:2px 10px;margin-bottom:8px}
 .article .anime-meta{background:transparent;border:0;padding:0;margin:0 0 24px;text-align:center;color:${muted};font-size:.8em}.article .anime-meta p{text-align:center}
 .article .anime-tags{padding:10px 12px;font-size:.82em;border-width:1px}.article .anime-tags p{text-align:left}.article .anime-tags code{display:inline-block;background:#fff;border:1px solid ${p.line};border-radius:9px;margin:3px;padding:2px 8px;color:${dark};font-family:${fontStacks['anime-sans']}}
 .article .anime-quote{background:#fef9e7;border:2px dashed #dca624;font-family:${quote};font-size:1.1em;padding:18px 20px}.article .anime-quote>.anime-title{background:#916c13;color:#fff;display:table;padding:2px 10px;border-radius:999px;font-size:.75em}
 .article .anime-tape{display:table;margin:-29px auto 12px;background:#ffe6a1;color:#735a25;border:1px solid #e9ce8e;padding:0 25px;font:13px/20px ${fontStacks.rounded};border-radius:2px}
 .article .anime-chat>.anime-title,.article .anime-panels>.anime-title{text-align:center}
 .article .anime-left,.article .anime-right{background:#fff;padding:12px 14px;border-width:1.5px;clear:both;width:auto;margin:14px 20px 14px 0;border-radius:4px 16px 16px 16px}
 .article .anime-right{background:${p.soft};border-color:${p.light};margin-left:20px;margin-right:0;border-radius:16px 4px 16px 16px}
 .article .anime-left>.anime-title,.article .anime-right>.anime-title{font-size:.8em;margin:0 0 5px;color:${muted}}
 .article .anime-avatar{float:left;width:28px;height:28px;text-align:center;background:${p.soft};color:${dark};border:1px solid ${p.line};border-radius:50%;font:18px/26px ${rounded};margin:0 8px 4px 0}.article .anime-right>.anime-avatar{float:right;margin:0 0 4px 8px}
 .article .anime-figure,.article .anime-panel{background:#fff;padding:12px;border-radius:18px;box-shadow:3px 3px 0 ${p.line}}
 .article .anime-figure img,.article .anime-panel img{border-radius:12px}.article .anime-figure .image-caption,.article .anime-panel .image-caption{background:${p.soft};padding:4px 10px;border-radius:10px}
 .article .anime-panel{margin:14px 0;box-shadow:none;border-width:1px}.article .anime-panel>.anime-title{font-size:.86em}
 .article .anime-equation{background:#fff;border-color:${p.light};box-shadow:3px 3px 0 ${p.line};padding:16px}
 .article .anime-equation>.anime-title{display:table;background:${dark};color:#fff;border-radius:999px;padding:3px 12px;font-size:.82em}
 .article .anime-equation .math-display{background:transparent;border:0;box-shadow:none;margin:12px 0;padding:8px 0}
 .article .anime-note{background:#fef9e7;border:0;border-top:1px dashed ${p.line};border-radius:8px;padding:10px 12px;margin:14px 0 0;font-size:.86em;color:${muted}}
 .article .anime-profile{background:${p.mint};border-color:${p.mintLine}}.article .anime-profile>.anime-title{border-bottom:1px dashed ${p.mintLine};padding-bottom:10px}
 .article :where(.anime-profile) table{margin:8px 0;background:transparent}.article :where(.anime-profile) th{background:#fff;color:${dark}}.article :where(.anime-profile) td{background:transparent;border-color:${p.mintLine};vertical-align:top}
 .article .anime-stat-rail{display:block;min-width:0;height:8px;border-radius:8px;background:#fff;border:1px solid ${p.mintLine};overflow:hidden;margin-top:7px}.article .anime-stat-fill{display:block;height:100%;background:${a};border-radius:8px}
 .article .anime-spoiler{border-style:dashed;border-color:${p.secondary}}.article .anime-spoiler>.anime-title{color:${secondary};border-bottom:1px dashed ${p.line};padding-bottom:10px}
 .article .anime-footer{background:#fef9e7;text-align:center;padding:22px 18px;border-radius:22px}.article .anime-footer p,.article .anime-footer .anime-title{text-align:center}
 `;
 if(!isAnime(theme))return components;
 return components+`
 .article{letter-spacing:.03em;border:2px solid ${p.line};border-radius:22px}
 .article h1{font-size:28px;line-height:1.45;text-align:center;color:${dark};text-shadow:2px 2px 0 ${p.dots};letter-spacing:.04em;margin:8px 0 22px;padding:0;border:0;background:none}
 .article .anime-mascot{display:block;margin:0 auto 10px;line-height:1}.article .anime-mascot svg{width:64px;height:54px}
 .article h2{display:table;max-width:calc(100% - 5px);font-size:21px;line-height:1.6;background:${p.soft};border:2px solid ${p.light};border-radius:22px;padding:8px 14px 8px 10px;box-shadow:3px 3px 0 ${p.line};color:${dark};margin:34px 5px 20px 0}
 .article h2 .theme-badge{display:inline-block;vertical-align:middle;min-width:30px;height:30px;font:700 14px/30px ${fontStacks.jetbrains};text-align:center;background:${dark};color:#fff;border-radius:50%;margin-right:9px;padding:0 5px}
 .article h2 .theme-heading-text{display:inline;vertical-align:middle}
 .article h3{font-family:${o.headingFont?rounded:fontStacks.kai};color:${secondary};border-left:4px solid #e5b535;padding-left:10px}
 .article strong{color:${dark};background:linear-gradient(transparent 58%,${p.dots} 58%);padding:0 2px}
 .article em{font-family:${quote};color:${secondary};font-style:normal;text-decoration:underline wavy ${p.light};text-underline-offset:4px}
 .article del,.article s{color:${muted};text-decoration-color:${a}}
 .article blockquote{background:#fef9e7;border:2px dashed #dca624;border-radius:18px;padding:18px 20px;margin:28px 0;color:#5c4738}
 .article code{background:${p.soft};color:${secondary};border:1px solid ${p.line};border-radius:6px;padding:2px 6px}
 .article pre{background:#2b2638;border:1px solid #453b58;border-radius:16px;padding:14px 16px;color:#f8f8f2}.article pre code{background:transparent;border:0;color:inherit;padding:0}.article .theme-code-label{font-size:11px;color:#ffd6e5;letter-spacing:.08em}
 .article .math-display{border:2px solid ${p.light};border-radius:16px;background:${p.soft};padding:18px 8px;box-shadow:3px 3px 0 ${p.line};margin-right:4px}
 .article .math-inline{background:${p.soft};border-radius:4px;padding:0 2px}
 .article table:where(:not([role=presentation])){border:2px solid ${p.line};font-size:.88em}.article table:where(:not([role=presentation])) th{background:${dark};color:#fff;border-color:${p.line}}.article table:where(:not([role=presentation])) td{border:1px dashed ${p.line};padding:10px 8px}.article table:where(:not([role=presentation])) tr:nth-child(even) td{background:${p.soft}}
 .article :where(.anime-profile) table th{background:#fff;color:${dark}}.article :where(.anime-profile) table tr:nth-child(even) td{background:transparent}
 .article hr{border-top:3px dotted ${p.line};width:60%;margin:32px auto}
 .article .literary-term{font-family:${fontStacks['noto-serif']};font-weight:700;background:#fef9e7;color:${dark};border:1px solid #ebd79f;border-radius:6px;padding:1px 6px}
 `;
}
