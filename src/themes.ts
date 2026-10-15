import {richThemeCSS} from './theme-design';
import {readabilityCSS} from './theme-readability';
import {fontStacks, type Typography} from './model';
import type {Theme,ThemeDefinition,ElementStyle} from './theme-types';
import {parseThemeFile,libraryDocument,validateTheme} from './theme-schema';
export type {Theme} from './theme-types';
export const builtInThemes: Theme[] = [
  {id:'rational',name:'理性蓝',group:'科普',description:'有条理，也有好奇心',accent:'#2563a6',paper:'#ffffff',ink:'#293647',font:'sans',variant:'bar'},
  {id:'academic',name:'学术简报',group:'科普',description:'沉稳的论述，清楚的证据',accent:'#3b4148',paper:'#ffffff',ink:'#303237',font:'serif',variant:'rule'},
  {id:'nature',name:'自然观察',group:'科普',description:'把目光交给万物',accent:'#486a47',paper:'#fafbf5',ink:'#354033',font:'sans',variant:'leaf'},
  {id:'cosmos',name:'宇宙来信',group:'科普',description:'从一束光，读到远方',accent:'#635299',paper:'#fcfcff',ink:'#33364b',font:'sans',variant:'cosmos'},
  {id:'math',name:'数理手札',group:'科普',description:'在推导之间留下思考',accent:'#2f526b',paper:'#ffffff',ink:'#27333e',font:'serif',variant:'theorem'},
  {id:'lab',name:'实验记录',group:'科普',description:'一步一步，让发现发生',accent:'#087f83',paper:'#ffffff',ink:'#263e42',font:'sans',variant:'steps'},
  {id:'earth',name:'地球档案',group:'科普',description:'大地有自己的时间',accent:'#947047',paper:'#fcfaf5',ink:'#4a4034',font:'serif',variant:'label'},
  {id:'tech',name:'科技前沿',group:'科普',description:'简练、锐利、面向未来',accent:'#255bd5',paper:'#ffffff',ink:'#253044',font:'sans',variant:'geometry'},
  {id:'qa',name:'科学问答',group:'科普',description:'每一个为什么，都值得回答',accent:'#ac561d',paper:'#fffdfa',ink:'#44362f',font:'sans',variant:'question'},
  {id:'magazine',name:'青春读本',group:'文学',description:'首字下沉、双色刊头与环绕插图，读一本温暖的杂志',accent:'#9c4c37',paper:'#fffdf6',ink:'#413c35',font:'serif',headingFont:'sans',variant:'magazine'},
  {id:'plain',name:'素笺',group:'文学',description:'留白，让文字自在呼吸',accent:'#706359',paper:'#fffdf7',ink:'#464039',font:'serif',variant:'plain'},
  {id:'ink',name:'墨韵',group:'文学',description:'一笔墨色，一点朱红',accent:'#a63d36',paper:'#fbf8ef',ink:'#302d29',font:'serif',headingFont:'kai',variant:'ink'},
  {id:'moon',name:'月下诗页',group:'文学',description:'让每一行，安静落下',accent:'#65778c',paper:'#f9fbfe',ink:'#404b5b',font:'serif',variant:'moon'},
  {id:'letter',name:'旧日书信',group:'文学',description:'纸短，情长',accent:'#8a624a',paper:'#fff8ea',ink:'#594537',font:'serif',headingFont:'kai',variant:'letter'},
  {id:'wild',name:'山野随笔',group:'文学',description:'带着风和草木的气息',accent:'#65704a',paper:'#fbfcf5',ink:'#454b3d',font:'serif',variant:'wild'},
  {id:'editorial',name:'编辑部',group:'通用',description:'像一本值得翻开的杂志',accent:'#222a31',paper:'#ffffff',ink:'#353b42',font:'sans',headingFont:'serif',variant:'editorial'},
  {id:'weekend',name:'周末长读',group:'通用',description:'给一篇好文章，多一点时间',accent:'#873d4d',paper:'#fffaf8',ink:'#453b3e',font:'serif',variant:'weekend'},
  {id:'mint',name:'清爽薄荷',group:'通用',description:'轻快地整理每一个想法',accent:'#258375',paper:'#fbfffd',ink:'#344943',font:'sans',variant:'card'},
  {id:'minimal',name:'极简留白',group:'通用',description:'只有文字，恰到好处',accent:'#42474d',paper:'#ffffff',ink:'#383d42',font:'sans',variant:'minimal'},
  {id:'orange',name:'橘子汽水',group:'通用',description:'橘色丝带与奶油引文，明快而有层次',accent:'#cb6222',paper:'#fffefa',ink:'#493a30',font:'sans',variant:'ribbon'},
  {id:'blueprint',name:'蓝图实验室',group:'科普',description:'蓝图封面、工程编号与坐标格纸',accent:'#245e9c',paper:'#ffffff',ink:'#2d4254',font:'sans',variant:'blueprint'},
  {id:'matcha',name:'抹茶手账',group:'文学',description:'纸胶带标题、植物色卡与手账留白',accent:'#687e3e',paper:'#fbfcf4',ink:'#444d36',font:'serif',variant:'tape'},
  {id:'berry',name:'莓果气泡',group:'通用',description:'圆形数字与莓果色气泡，轻盈鲜明',accent:'#ac3e76',paper:'#fffafd',ink:'#513f4a',font:'sans',variant:'bubble'},
  {id:'gold',name:'金色刊物',group:'文学',description:'香槟金双线边框与对称的刊物题签',accent:'#987837',paper:'#fffdf8',ink:'#494438',font:'serif',variant:'deco'},
  {id:'ocean',name:'深海电台',group:'科普',description:'深蓝封面与海浪分隔，安静有力量',accent:'#256a7e',paper:'#fcfeff',ink:'#324c55',font:'sans',variant:'ocean'},
  {id:'pixel',name:'像素信号',group:'科普',description:'荧光绿标签、硬边阴影与终端代码',accent:'#4c6834',paper:'#fffffa',ink:'#2c3c31',font:'sans',variant:'pixel'},
  {id:'sunset',name:'日落来信',group:'文学',description:'暖橘与珊瑚色渐层，柔软的弧形引文',accent:'#b96851',paper:'#fffdfa',ink:'#58413a',font:'serif',variant:'sunset'},
  {id:'lavender',name:'薰衣草札记',group:'文学',description:'紫色双线题签与花瓣般的章节标签',accent:'#88649e',paper:'#fffdfd',ink:'#4d4359',font:'serif',variant:'lavender'},
  {id:'newspaper',name:'复古报刊',group:'通用',description:'旧报头、衬线章节和双线剪报边框',accent:'#544b3b',paper:'#f9f5e9',ink:'#3e3b34',font:'serif',variant:'newspaper'},
  {id:'cream',name:'奶油便签',group:'通用',description:'奶黄色折角与便签卡片，适合知识清单',accent:'#927128',paper:'#fffef8',ink:'#514832',font:'sans',variant:'note'},
  {id:'terracotta',name:'赤陶画册',group:'文学',description:'赤陶封面、画册边框与大号章节数字',accent:'#a65f46',paper:'#fffbf6',ink:'#584338',font:'serif',variant:'gallery'},
  {id:'cartoon',name:'卡通手账',group:'通用',description:'笑脸星星、圆润贴纸与彩色手账引文',accent:'#a57543',paper:'#fffef8',ink:'#5a4a3c',font:'sans',variant:'cartoon'},
  {id:'arcade',name:'像素电玩',group:'通用',description:'游戏手柄、关卡编号与像素对话框',accent:'#3c7180',paper:'#fcfefd',ink:'#34475a',font:'sans',variant:'arcade'},
  {id:'kuromi',name:'库洛米灵感',group:'通用',description:'黑紫粉配色、小恶魔与甜酷心情卡片',accent:'#87569c',paper:'#fffaff',ink:'#4c3c54',font:'sans',variant:'kuromi'},
  {id:'pop',name:'波普漫画',group:'通用',description:'网点爆炸框、粗黑描边与高对比色块',accent:'#d33460',paper:'#fffefd',ink:'#343034',font:'sans',variant:'pop'},
  {id:'classical',name:'文言课本',group:'文学',description:'宋楷书页、朱红课题与旁批式引用',accent:'#9a5141',paper:'#fffdf6',ink:'#473f33',font:'serif',headingFont:'serif',variant:'classical'}
];
// Typography is part of the art direction: small labels use a different voice
// from the reading text, while explicit article settings remain the last word.
const pairings:Record<string,[string,string,string?,string?]>={
  rational:['sans','hei','serif','sans'],academic:['serif','sans','kai','mono'],nature:['sans','serif','kai','serif'],cosmos:['sans','sans','serif','mono'],
  math:['serif','times','kai','mono'],lab:['sans','sans','kai','mono'],earth:['serif','kai','serif','kai'],tech:['sans','hei','sans','mono'],qa:['sans','hei','kai','sans'],
  magazine:['serif','sans','kai','kai'],plain:['serif','serif','kai','serif'],ink:['serif','kai','kai','fang'],moon:['serif','kai','kai','serif'],letter:['serif','kai','kai','kai'],wild:['serif','serif','kai','serif'],
  editorial:['serif','hei','georgia','sans'],weekend:['serif','serif','kai','serif'],mint:['sans','serif','sans','sans'],minimal:['sans','sans','serif','sans'],
  orange:['sans','hei','kai','sans'],blueprint:['sans','mono','sans','mono'],matcha:['serif','kai','kai','serif'],berry:['sans','sans','serif','sans'],gold:['serif','serif','kai','serif'],ocean:['sans','serif','kai','serif'],pixel:['sans','mono','mono','mono'],sunset:['serif','kai','kai','serif'],lavender:['serif','kai','kai','serif'],newspaper:['serif','serif','kai','mono'],cream:['sans','kai','kai','sans'],terracotta:['serif','hei','serif','sans'],cartoon:['sans','sans','kai','sans'],arcade:['sans','mono','mono','mono'],kuromi:['sans','hei','kai','sans'],pop:['sans','hei','hei','sans'],classical:['serif','serif','kai','fang']
};
for(const t of builtInThemes){const [body,heading,quote,caption]=pairings[t.id];Object.assign(t,{font:body,headingFont:heading,quoteFont:quote,captionFont:caption,poemFont:['moon','ink','classical'].includes(t.id)?'kai':body,codeFont:'mono'});}
export const builtInIds=builtInThemes.map(t=>t.id);
export function materializeTheme(d:ThemeDefinition):Theme{
  const base=builtInThemes.find(t=>t.id===d.base)!;
  return {...base,id:d.id,name:d.name,description:d.description,group:d.group,baseId:d.base,definition:d,...d.palette,font:d.fonts?.body||base.font,headingFont:d.fonts?.heading||base.headingFont,quoteFont:d.fonts?.quote||base.quoteFont,captionFont:d.fonts?.caption||base.captionFont,poemFont:d.fonts?.poem||base.poemFont,codeFont:d.fonts?.code||base.codeFont,defaults:d.typography};
}
export const themes:Theme[]=[...builtInThemes];
let definitions:ThemeDefinition[]=[],hidden:string[]=[],loadError='',savedRecord:string|null=null;
const libraryKey='paper-theme-library-v1';
function publish(){themes.splice(0,themes.length,...builtInThemes,...definitions.map(materializeTheme));}
try{const raw=localStorage.getItem(libraryKey);savedRecord=raw;if(raw){const parsed=parseThemeFile(raw,builtInIds);definitions=parsed.themes;hidden=parsed.hidden;publish();}}catch{loadError='主题库记录无法读取。内置主题仍可使用；原记录已保留，请先导出或修复后再管理主题。';}
export const themeLibraryError=()=>loadError;
export const rawThemeLibrary=()=>localStorage.getItem(libraryKey)||'';
export function resetBrokenThemeLibrary(){
  if(!loadError)return;
  const previousError=loadError;loadError='';savedRecord=localStorage.getItem(libraryKey);
  try{commitLibrary([],[]);}catch(e){loadError=previousError;throw e;}
}
export const themeById = (id:string) => themes.find(t=>t.id===id) || themes[0];
export const visibleThemes=()=>themes.filter(t=>!hidden.includes(t.id));
export const isThemeHidden=(id:string)=>hidden.includes(id);
export const themeLibraryDocument=()=>libraryDocument(structuredClone(definitions),[...hidden]);
function commitLibrary(next:ThemeDefinition[],removed:string[]){
  if(loadError)throw new Error(loadError);
  const serialized=JSON.stringify(libraryDocument(next,removed));
  if(new TextEncoder().encode(serialized).length>2*1024*1024)throw new Error('主题库已超过 2 MB，请精简后重试');
  try{if(localStorage.getItem(libraryKey)!==savedRecord)throw new Error('changed');localStorage.setItem(libraryKey,serialized);}catch(e){if(e instanceof Error&&e.message==='changed')throw new Error('主题库已在其他标签页发生变化。请先备份文章，再刷新此页面后重试，避免覆盖另一窗口的修改。');throw new Error('主题库保存失败，可能是浏览器空间不足或禁止存储。当前主题和文章保持原样，请先导出备份。');}
  savedRecord=serialized;
  definitions=next;hidden=removed;publish();
}
export function setThemeHidden(id:string,remove:boolean){
  if(!themes.some(t=>t.id===id))throw new Error('找不到这个主题');
  const next=remove?[...new Set([...hidden,id])]:hidden.filter(v=>v!==id);
  if(remove&&next.length>=themes.length)throw new Error('请至少保留一个可选主题');
  commitLibrary(definitions,next);
}
export function restoreThemes(){commitLibrary(definitions,[]);}
function fingerprint(value:unknown):string{
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+fingerprint((value as Record<string,unknown>)[k])).join(',')+'}';
  return JSON.stringify(value);
}
// Plan imports without side effects so a damaged file in a batch cannot leave
// half a theme library behind. Each archive gets its own ID mapping.
export function planThemeImports(groups:ThemeDefinition[][],mode:'keep'|'update'='keep',removed:string[]=[],removedGroups:string[][]=[]){
  const next=structuredClone(definitions),maps:Map<string,string>[]=[],used=new Set([...builtInIds,...next.map(t=>t.id)]);
  const visible=new Set<string>();
  for(const group of groups){
    const map=new Map<string,string>();
    for(const raw of group){
      const d=validateTheme(raw,builtInIds),existing=next.find(t=>t.id===d.id);let id=d.id;
      if(existing&&fingerprint(existing)!==fingerprint(d)&&mode==='keep'){
        let n=2;while(used.has(id=d.id.slice(0,50)+'-'+n))n++;d.name=d.name.slice(0,26)+' · 导入 '+(n-1);
      }
      map.set(d.id,id);used.add(id);visible.add(id);d.id=id;
      const at=next.findIndex(t=>t.id===id);if(at>=0)next[at]=d;else next.push(d);
    }
    maps.push(map);
  }
  if(next.length>100)throw new Error('自定义主题最多保留 100 个，请导出整理后重试');
  const mappedRemoved=[...removed.map(id=>maps[0]?.get(id)||id),...removedGroups.flatMap((ids,i)=>ids.map(id=>maps[i]?.get(id)||id))];
  const nextHidden=[...new Set([...hidden.filter(id=>!visible.has(id)),...mappedRemoved])].filter(id=>used.has(id));
  if(nextHidden.length>=builtInIds.length+next.length)throw new Error('主题库需要至少保留一个可选主题');
  return {maps,commit:()=>commitLibrary(next,nextHidden)};
}
export function themesForArticles(articles:{theme:string;revisions:{theme:string}[]}[],all=false){
  if(all)return structuredClone(definitions);
  const used=new Set(articles.flatMap(a=>[a.theme,...a.revisions.map(r=>r.theme)]));return structuredClone(definitions.filter(d=>used.has(d.id)));
}
export function themeDefaults(theme:Theme):Typography{return {size:16,lineHeight:(theme.baseId||theme.id)==='classical'?2.15:theme.group==='文学'?2:1.85,paragraphGap:20,padding:24,indent:(theme.baseId||theme.id)==='classical',...theme.defaults};}
export function elementCSS(elements:ThemeDefinition['elements'],partial=false){
  const selectors={h1:'h1',h2:'h2',h3:'h3',quote:'blockquote',caption:'.image-wrap .image-caption',table:'table:not([role=presentation])',list:'ul,.article ol',code:'pre',formula:'.math-display',poem:'.poem',divider:'hr:not(.footnotes-sep),.article .decorative-divider'};
  return Object.entries(elements||{}).map(([key,s])=>{
    const css:string[]=[],style=s as ElementStyle;
    for(const [property,value]of Object.entries(style)){
      const names:Record<string,string>={size:'font-size',weight:'font-weight',lineHeight:'line-height',letterSpacing:'letter-spacing',align:'text-align',marginTop:'margin-top',marginBottom:'margin-bottom',padding:'padding',radius:'border-radius',color:'color',background:'background'};
      if(names[property])css.push(`${names[property]}:${value}${['size','letterSpacing','marginTop','marginBottom','padding','radius'].includes(property)?'px':''}${key==='caption'?'!important':''}`);
    }
    if(style.font)css.push('font-family:'+fontStacks[style.font]);if(style.italic!==undefined)css.push('font-style:'+(style.italic?'italic':'normal'));
    if(style.borderWidth!==undefined||style.borderSide||style.borderColor||style.borderStyle){
      if(partial&&!style.borderSide){if(style.borderWidth!==undefined)css.push(`border-width:${style.borderWidth}px`);if(style.borderColor)css.push(`border-color:${style.borderColor}`);if(style.borderStyle)css.push(`border-style:${style.borderStyle}`);}
      else{const side=style.borderSide&&style.borderSide!=='all'?'-'+style.borderSide:'';css.push('border:0',`border${side}:${style.borderWidth??1}px ${style.borderStyle||'solid'} ${style.borderColor||'currentColor'}`);}
    }
    if(style.shadow)css.push('box-shadow:'+({none:'none',soft:'0 3px 12px #0000000c',offset:'4px 4px 0 #00000014'}[style.shadow]));
    const cellNames:Record<string,string>={font:'font-family',color:'color',background:'background',align:'text-align',weight:'font-weight',size:'font-size',lineHeight:'line-height'};
    const cells=key==='table'?Object.keys(cellNames).filter(k=>Object.hasOwn(style,k)).map(k=>`${cellNames[k]}:${k==='font'?fontStacks[style.font!]:(style as Record<string,unknown>)[k]}${k==='size'?'px':''}!important`).join(';'):'';
    return `.article ${selectors[key as keyof typeof selectors]}{${css.join(';')}}${cells?`.article table:not([role=presentation]) th,.article table:not([role=presentation]) td{${cells}}`:''}${key==='poem'&&style.align?`.article .poem[data-align]{text-align:${style.align}}`:''}`;
  }).join('\n');
}
export function themeCSS(theme: Theme, o: Typography = {}): string {
  o={...themeDefaults(theme),...o};
  const a = /^#[0-9a-f]{6}$/i.test(o.accent||'') ? o.accent! : theme.accent;
  const f = fontStacks[o.font||theme.font] || fontStacks.sans;
  const hf = fontStacks[o.headingFont||theme.headingFont||o.font||theme.font] || f;
  const size = Math.min(24,Math.max(12,Number(o.size)||16));
  const lh = Math.min(2.8,Math.max(1.3,Number(o.lineHeight)||1.85));
  const gap = Math.min(40,Math.max(0,o.paragraphGap??20));
  const padding = Math.min(48,Math.max(12,o.padding??24));
  const v = theme.variant;
  let special = '';
  if(v==='bar') special='.article h2{border-left:4px solid ACCENT;padding-left:12px}.article blockquote{background:#f1f6fc}';
  if(v==='rule') special='.article h1{font-size:27px;border-bottom:2px solid ACCENT;padding-bottom:18px}.article h2{border-bottom:1px solid #cdd0d3;padding-bottom:8px}.article blockquote{border-left:0;border-top:1px solid #ddd;border-bottom:1px solid #ddd;font-style:italic}';
  if(v==='leaf') special='.article h2{display:table;background:#eaf0df;padding:6px 14px;border-radius:2px 16px 2px 16px}.article blockquote{border-left:2px solid ACCENT;background:#f0f4e7}.article figure{padding:10px;background:#f0f3e9}';
  if(v==='cosmos') special='.article h1{background:#202f50;color:#fff;padding:26px 18px;font-size:27px}.article h2{border-bottom:1px solid #cbc4e2;padding-bottom:10px;letter-spacing:1px}.article .math-display{background:#f0edf7;border:1px solid #e3dcf0}.article blockquote{background:#f3f0fa}';
  if(v==='theorem') special='.article h2{font-size:19px;border-top:2px solid ACCENT;padding-top:10px}.article blockquote{border:1px solid #cdd9e2;border-left:4px solid ACCENT;background:#f8fafc}.article .math-display{padding:24px 8px;background:#f5f8fb}';
  if(v==='steps') special='.article h2{background:ACCENT;color:#fff;padding:8px 14px;border-radius:3px}.article th{background:ACCENT;color:#fff}.article ol{border-left:1px solid #c3dfde}.article blockquote{background:#eaf7f6}';
  if(v==='label') special='.article h2{display:table;background:#eee5d6;border-top:3px solid ACCENT;padding:6px 12px;letter-spacing:1px}.article figcaption{border-top:1px solid #ded1bd;padding-top:9px;text-align:left}.article hr{border-top:1px dashed ACCENT}';
  if(v==='geometry') special='.article h1{font-size:30px;letter-spacing:-1px}.article h2{border-left:8px solid ACCENT;border-bottom:1px solid #d7e0f7;padding:6px 12px}.article pre{border-radius:0;border-left:3px solid ACCENT}.article blockquote{background:#eff4ff}';
  if(v==='question') special='.article h2{background:#fff0df;border-radius:12px 12px 12px 0;padding:12px;color:ACCENT}.article blockquote{background:#fff6e9;border:1px solid #e8cdb0;border-radius:8px}.article strong{background:#fff0d9}';
  if(v==='plain') special='.article h1{font-size:27px;font-weight:500;line-height:1.65;margin-bottom:38px}.article h2{font-weight:500;margin-top:40px}.article blockquote{border:0;padding:10px 22px;color:#807469}.article hr{width:40px;margin:36px auto}';
  if(v==='ink') special='.article h1{text-align:center;letter-spacing:4px;font-weight:500;border-bottom:1px solid #d8cabc;padding-bottom:24px}.article h2{border-left:2px solid ACCENT;padding-left:14px;letter-spacing:2px}.article blockquote{border-left:0;border-right:2px solid ACCENT;font-family:KaiTi,STKaiti,serif;text-align:right}.article hr{width:30%;margin:32px auto;border-color:ACCENT}';
  if(v==='moon') special='.article h1,.article h2{text-align:center;font-weight:400;letter-spacing:3px}.article h1{margin:12px 0 38px}.article .poem{text-align:center;line-height:2.6;padding:16px 0}.article blockquote{border:0;text-align:center;color:#728196}.article hr{width:24px;margin:38px auto}';
  if(v==='letter') special='.article h1{font-weight:400;font-size:29px}.article h2{font-weight:400;border-bottom:1px dashed #c6b09a;padding-bottom:10px}.article blockquote{border:0;background:#f6ecda;padding:20px}.article hr{border-top:1px dashed #baa68c}.article figcaption{text-align:right}';
  if(v==='wild') special='.article h1{font-weight:500;letter-spacing:2px}.article h2{padding-top:16px;border-top:1px solid #c6cdb4;font-weight:500}.article blockquote{border:0;border-left:2px solid #a5b08a;font-style:italic}.article figure{margin:30px 0}.article hr{width:60px;margin:34px 0}';
  if(v==='editorial') special='.article h1{font-size:34px;line-height:1.35;border-top:6px solid ACCENT;padding-top:20px}.article h2{font-size:24px;border-bottom:2px solid ACCENT;padding-bottom:8px}.article blockquote{border:0;font-size:20px;font-family:Georgia,SimSun,serif}.article figcaption{text-align:left;letter-spacing:1px}';
  if(v==='weekend') special='.article h1{font-size:29px;line-height:1.6;margin-bottom:30px}.article h2{font-weight:500;display:table;border-bottom:3px solid #d8b8bf;padding-bottom:8px}.article blockquote{border:0;background:#f7edef;padding:22px}.article p{margin-bottom:26px}';
  if(v==='card') special='.article h2{background:#e8f6ef;padding:12px 16px;border-radius:10px}.article blockquote{border:0;background:#eef8f3;border-radius:10px}.article table{border:1px solid #c9e5da}.article .math-display{background:#f0faf5;border-radius:8px}';
  if(v==='minimal') special='.article h1{font-size:28px;font-weight:500;letter-spacing:-.5px}.article h2{font-size:20px;font-weight:600;margin-top:38px}.article blockquote{border:0;padding-left:0;color:#7b8085}.article strong{color:inherit}.article hr{border-color:#eceeef;margin:36px 0}';
  return `.article{box-sizing:border-box;padding:${padding}px;background:${theme.paper};color:${theme.ink};font-family:${f};font-size:${size}px;line-height:${lh};overflow-wrap:anywhere;text-align:left;word-break:normal}
  .article *{box-sizing:border-box}.article h1,.article h2,.article h3,.article h4,.article h5,.article h6{font-family:${hf};color:${a};line-height:1.5;font-weight:700;word-break:break-word;text-indent:0}
  .article h1{font-size:28px;margin:8px 0 28px}.article h2{font-size:21px;margin:30px 0 16px}.article h3{font-size:18px;margin:24px 0 12px}.article h4,.article h5,.article h6{font-size:16px;margin:20px 0 10px}
  .article p{margin:0 0 ${gap}px;text-indent:${(o.indent??theme.id==='classical')?'2em':'0'}}.article li p,.article blockquote p,.article .footnotes p{text-indent:0}.article strong{color:${a};font-weight:700}.article em{font-style:italic}.article a{color:${a};text-decoration:underline;text-underline-offset:3px}
  .article blockquote{margin:24px 0;padding:14px 18px;border-left:3px solid ${a};color:${theme.ink};background:#f5f6f7}.article blockquote p:last-child{margin-bottom:0}
  .article ul,.article ol{padding-left:26px;margin:16px 0 22px}.article li{padding-left:3px;margin:7px 0}.article hr{border:0;border-top:1px solid #dcdfe3;margin:30px 0}
  .article pre{margin:20px 0;padding:16px;background:#202936;color:#e6edf5;font:13px/1.75 Consolas,monospace;border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere}.article code{font-family:Consolas,monospace;font-size:.88em;background:#eef1f4;padding:2px 4px;border-radius:3px}.article pre code{background:transparent;color:inherit;padding:0;font-size:inherit}
  .article .hljs-keyword,.article .hljs-selector-tag{color:#dba9ef}.article .hljs-string,.article .hljs-attr{color:#b6d997}.article .hljs-number,.article .hljs-literal{color:#f2c38b}.article .hljs-comment{color:#8b9cab}.article .hljs-title{color:#8ecdec}
  .article table{border-collapse:collapse;width:100%;font-size:.88em;table-layout:fixed;margin:20px 0}.article th,.article td{border:1px solid #dce1e5;padding:9px 7px;word-break:break-word}.article th{background:#f0f3f6;font-weight:600}.article tr:nth-child(even) td{background:#fafbfc}
  .article figure{margin:24px 0;text-indent:0}.article img{max-width:100%;height:auto;vertical-align:middle}.article figcaption{font-size:12px;line-height:1.7;color:#80858b;text-align:center;margin-top:10px;text-indent:0}.article .image-caption{display:block;font-size:12px;line-height:1.7;margin-top:10px;text-indent:0}.article .image-wrap{display:block;text-indent:0}.article .missing-image{display:block;border:1px dashed #c59069;color:#966438;padding:16px;font-size:13px}
  .article .math-inline{display:inline-block;vertical-align:middle;max-width:100%;text-indent:0}.article .math-display{display:block;overflow-x:auto;text-align:center;padding:14px 4px;margin:20px 0;text-indent:0}.article mjx-container{max-width:100%;display:inline-block;margin:0!important}.article .math-display mjx-container{display:block}.article svg{max-width:100%;height:auto;vertical-align:middle}.article .math-error{color:#a43434;background:#fff0ed;font:13px/1.6 Consolas,monospace;white-space:pre-wrap;padding:8px;cursor:pointer}
  .article .poem{white-space:pre-wrap;line-height:2.3;margin:26px 0;padding:12px 0;text-indent:0}.article .poem[data-align=center]{text-align:center}.article .poem[data-align=left]{text-align:left}.article .footnotes{font-size:12px;color:#707880;margin-top:32px;border-top:1px solid #ddd;padding-top:12px}.article .footnotes p{margin:4px 0}.article .footnote-ref{font-size:11px}
  ${special.replaceAll('ACCENT',a)}
  ${richThemeCSS(theme,a)}
  .article h1,.article h2,.article h3,.article h4,.article h5,.article h6{font-family:${hf}}
  .article blockquote{font-family:${fontStacks[theme.quoteFont||theme.font]||f}}
  .article .image-caption{font-family:${fontStacks[theme.captionFont||theme.font]||f}}
  .article .image-source{display:block;color:#80858b;font:11px/1.7 ${fontStacks[theme.captionFont||theme.font]||f};margin-top:4px;text-indent:0}
  .article pre,.article code{font-family:${fontStacks[theme.codeFont||'mono']||fontStacks.mono}}.article pre code{font-family:inherit}
  .article .poem{font-family:${fontStacks[theme.poemFont||theme.font]||f}}
  ${readabilityCSS(theme,o,a)}
  ${elementCSS(theme.definition?.elements)}
  ${(theme.baseId||theme.id)==='magazine'?`.article{display:flow-root}.article p:has(.magazine-initial){text-indent:0}.article .magazine-initial{margin-left:${o.indent?size*2:0}px}`:''}
  .article .decorative-divider{color:${a};margin:26px 0}
  ${o.headingFont?`.article h1,.article h2,.article h3,.article h4,.article h5,.article h6{font-family:${hf}}`:''}
  ${o.paragraphGap!==undefined?`.article p{margin-bottom:${gap}px}`:''}
  ${o.tableStyle==='three-line'?`.article table{border:0;border-top:2px solid ${theme.ink};border-bottom:2px solid ${theme.ink};border-radius:0}.article table th,.article table td{border:0;background:transparent;color:${theme.ink}}.article table th{border-bottom:1px solid ${theme.ink}}.article table tr:nth-child(even) td{background:transparent}`:''}
  ${o.tableStyle==='striped'?`.article table{border:0}.article table th,.article table td{border:0;border-bottom:1px solid #dce1e5}.article table th{background:${a}18;color:${theme.ink}}.article table tr:nth-child(even) td{background:${a}0c}`:''}
  ${o.tableStyle==='grid'?`.article table{border:1px solid #aeb8bd}.article table th,.article table td{border:1px solid #aeb8bd}.article table th{background:#f0f3f6;color:${theme.ink}}`:''}
  ${elementCSS(o.elements,true)}`;
}
