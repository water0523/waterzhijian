import type MarkdownIt from 'markdown-it';

export const inlineFonts:Record<string,{name:string;css:string;word:string}>={
  yahei:{name:'微软雅黑 · 中文无衬线',css:'"Microsoft YaHei","PingFang SC",sans-serif',word:'Microsoft YaHei'},
  song:{name:'宋体 · 中文衬线',css:'SimSun,"Songti SC",serif',word:'SimSun'},
  hei:{name:'黑体 · 中文标题',css:'SimHei,"Heiti SC","Microsoft YaHei",sans-serif',word:'SimHei'},
  kai:{name:'楷体 · 中文书写',css:'KaiTi,STKaiti,serif',word:'KaiTi'},
  fang:{name:'仿宋 · 中文正文',css:'FangSong,STFangsong,serif',word:'FangSong'},
  arial:{name:'Arial · 西文无衬线',css:'Arial,"Microsoft YaHei",sans-serif',word:'Arial'},
  times:{name:'Times New Roman · 西文论文',css:'"Times New Roman",SimSun,serif',word:'Times New Roman'},
  georgia:{name:'Georgia · 西文阅读',css:'Georgia,SimSun,serif',word:'Georgia'},
  consolas:{name:'Consolas · 等宽',css:'Consolas,"Cascadia Code","Microsoft YaHei",monospace',word:'Consolas'}
};
export const literaryRoles={note:'朱砂夹批',aside:'竖排眉批',preface:'词前小序',rhyme:'韵脚微标',painting:'题画文字',date:'年代胶囊',term:'科普术语',redline:'朱红强调'};
export interface InlineStyle {font?:string;size?:number;color?:string;highlight?:string;bold?:boolean;italic?:boolean;underline?:boolean;wave?:boolean;strike?:boolean;dots?:boolean;gold?:boolean;marker?:boolean;markerColor?:string;role?:keyof typeof literaryRoles}
export const markerInk=(style:InlineStyle)=>/^#[\da-f]{6}$/i.test(style.markerColor||'')?style.markerColor!:'#f5d878';
export function styleAttributes(style:InlineStyle){
  return [style.font&&inlineFonts[style.font]?'font='+style.font:'',style.size&&style.size>=10&&style.size<=64?'size='+style.size:'',style.color&&/^#[\da-f]{6}$/i.test(style.color)?'color='+style.color:'',style.highlight&&/^#[\da-f]{6}$/i.test(style.highlight)?'highlight='+style.highlight:'',style.role&&Object.hasOwn(literaryRoles,style.role)?'role='+style.role:'',...(['bold','italic','underline','wave','strike','dots','gold','marker'] as const).filter(key=>style[key]).map(key=>key==='marker'&&style.markerColor?'marker='+markerInk(style):key)].filter(Boolean).join(' ');
}
export function inlineCSS(style:InlineStyle){
  const rules:string[]=[];
  if(style.font&&inlineFonts[style.font])rules.push('font-family:'+inlineFonts[style.font].css);
  if(style.size)rules.push('font-size:'+style.size+'px');
  if(style.color)rules.push('color:'+style.color);
  if(style.highlight)rules.push('background-color:'+style.highlight,'box-decoration-break:clone');
  if(style.marker)rules.push('background-image:linear-gradient(transparent 58%,'+markerInk(style)+'a6 58%)','box-decoration-break:clone');
  if(style.gold)rules.push('background-image:linear-gradient(transparent 58%,#c5a16b38 58%)','border-bottom:1px solid #b08a51','box-decoration-break:clone');
  if(style.dots)rules.push('text-emphasis-style:filled dot','text-emphasis-position:under right');
  if(style.bold)rules.push('font-weight:700');
  if(style.italic)rules.push('font-style:italic');
  if(style.underline||style.wave||style.strike)rules.push('text-decoration:'+[(style.underline||style.wave)?'underline':'',style.strike?'line-through':'',style.wave?'wavy':'solid'].filter(Boolean).join(' '),'text-underline-offset:3px');
  return rules.join(';');
}
export function parseInlineStyle(source:string):InlineStyle|null {
  const style:InlineStyle={};const entries=source.trim().split(/\s+/);if(!source.trim())return null;
  for(const entry of entries){
    if(['bold','italic','underline','wave','strike','dots','gold','marker'].includes(entry)){(style as any)[entry]=true;continue;}
    const [key,value,...rest]=entry.split('=');if(rest.length)return null;
    if(key==='font'&&Object.hasOwn(inlineFonts,value))style.font=value;
    else if(key==='role'&&Object.hasOwn(literaryRoles,value))style.role=value as InlineStyle['role'];
    else if(key==='color'&&/^#[\da-f]{6}$/i.test(value))style.color=value;
    else if(key==='highlight'&&/^#[\da-f]{6}$/i.test(value))style.highlight=value;
    else if(key==='marker'&&/^#[\da-f]{6}$/i.test(value)){style.marker=true;style.markerColor=value;}
    else if(key==='size'&&/^\d{1,2}(?:\.\d)?$/.test(value)&&Number(value)>=10&&Number(value)<=64)style.size=Number(value);
    else return null;
  }
  return style;
}

// A deliberately small Markdown extension. Only whitelisted style properties
// are accepted; no raw HTML, arbitrary CSS, URLs or events can be injected.
export function installInlineStyles(md:MarkdownIt){
  // Retain native delimiter pairing, nesting, escapes and code isolation while
  // allowing bold edges to touch CJK text after punctuation: **科普：**正文.
  const parser=md.inline as any,Base=parser.State;
  parser.State=class extends Base {
    scanDelims(start:number,canSplitWord:boolean){
      const scanned=super.scanDelims(start,canSplitWord);
      if(this.src[start]!=='*'||scanned.length<2)return scanned;
      const tail=this.src.slice(Math.max(0,start-2),start);
      const before=/^[\uD800-\uDBFF][\uDC00-\uDFFF]$/.test(tail)?tail:tail.slice(-1);
      const after=String.fromCodePoint(this.src.codePointAt(start+scanned.length)||32);
      const cjk=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
      const punctuation=/[\p{P}\p{S}]/u;
      const cjkPunctuation=/[\u3000-\u303f\uff00-\uffef\u2018-\u201f]/u;
      if(!scanned.can_close&&punctuation.test(before)&&(cjk.test(after)||(cjkPunctuation.test(before)&&/[\p{L}\p{N}]/u.test(after))))scanned.can_close=true;
      if(!scanned.can_open&&cjk.test(before)&&punctuation.test(after))scanned.can_open=true;
      return scanned;
    }
  };
  // A styled span ends in punctuation (`}`), so CommonMark can reject a
  // following ** before Chinese text. Recognize this precise old-source form.
  md.inline.ruler.before('emphasis','styled_strong',(state,silent)=>{
    const start=state.pos,max=state.posMax;if(!state.src.startsWith('**[',start))return false;
    const end=md.helpers.parseLinkLabel(state,start+2,false);if(end<0||state.src[end+1]!=='{')return false;
    const close=state.src.indexOf('}',end+2);if(close<0||close+2>=max||!state.src.startsWith('**',close+1))return false;
    const style=parseInlineStyle(state.src.slice(end+2,close));if(!style)return false;
    if(!silent){state.pos=start+3;state.posMax=end;state.push('strong_open','strong',1);const open=state.push('text_style_open','span',1);open.attrSet('class','inline-style'+(style.role?' literary-'+style.role:''));open.attrSet('style',inlineCSS(style));if(style.font)open.attrSet('data-inline-font',style.font);if(style.wave||style.underline)open.attrSet('data-inline-underline',style.wave?'wave':'single');if(style.strike)open.attrSet('data-inline-strike','true');if(style.marker&&!style.gold)open.attrSet('data-inline-marker',markerInk(style));md.inline.tokenize(state);state.push('text_style_close','span',-1);state.push('strong_close','strong',-1);}
    state.pos=close+3;state.posMax=max;return true;
  });
  md.inline.ruler.before('link','text_style',(state,silent)=>{
    // During native link-label lookahead, consuming a styled [span]{...} as
    // one token makes markdown-it mistake it for a nested link. Let lookahead
    // count its brackets; the real (non-silent) label pass renders the span.
    if(silent)return false;
    const start=state.pos,max=state.posMax;if(state.src[start]!=='[')return false;
    const end=md.helpers.parseLinkLabel(state,start,false);
    if(end<0||state.src[end+1]!=='{')return false;
    const close=state.src.indexOf('}',end+2);if(close<0||close>=max||close-end>200)return false;
    const style=parseInlineStyle(state.src.slice(end+2,close));if(!style)return false;
    if(!silent){
      state.pos=start+1;state.posMax=end;
      const open=state.push('text_style_open','span',1);open.attrSet('class','inline-style'+(style.role?' literary-'+style.role:''));open.attrSet('style',inlineCSS(style));
      if(style.font)open.attrSet('data-inline-font',style.font);
      if(style.wave||style.underline)open.attrSet('data-inline-underline',style.wave?'wave':'single');
      if(style.strike)open.attrSet('data-inline-strike','true');
      if(style.marker&&!style.gold)open.attrSet('data-inline-marker',markerInk(style));
      md.inline.tokenize(state);state.push('text_style_close','span',-1);
    }
    state.pos=close+1;state.posMax=max;return true;
  });
}
