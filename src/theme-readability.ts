import type {Theme} from './theme-types';
import type {Typography} from './model';

const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const luminance=(hex:string)=>rgb(hex).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a:string,b:string)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
// Retain the hue where possible; explicit author colors are applied afterwards.
export function readableColor(color:string,background:string,minimum=4.55):string{
  if(contrast(color,background)>=minimum)return color;
  const target=contrast('#000000',background)>contrast('#ffffff',background)?'#000000':'#ffffff',from=rgb(color),to=rgb(target);
  const mix=(amount:number)=>'#'+from.map((v,i)=>Math.round(v+(to[i]-v)*amount).toString(16).padStart(2,'0')).join('');
  let low=0,high=1;for(let i=0;i<18;i++){const mid=(low+high)/2;if(contrast(mix(mid),background)>=minimum)high=mid;else low=mid;}
  return mix(high);
}

export function readabilityCSS(theme:Theme,o:Typography,accent:string){
  const id=theme.baseId||theme.id;
  const surfaces:Record<string,[string,string]>={academic:['#f2f1ee','#34332f'],newspaper:['#eae4d7','#3e3b33'],classical:['#f1ebdf','#64543f'],tech:['#172333','#e6edf5'],blueprint:['#16334f','#e6edf5'],pixel:['#24342c','#d4e9ba'],arcade:['#26344e','#bff3ce'],kuromi:['#33273d','#e6edf5'],pop:['#263c49','#e6edf5']};
  const [base,ink]=surfaces[id]||['#202936','#e6edf5'],background=o.elements?.code?.background||theme.definition?.elements?.code?.background||base;
  const color=o.elements?.code?.color||theme.definition?.elements?.code?.color;
  const palette=luminance(background)>.18?['#6d3c8b','#35653e','#8a4f23','#59636b','#1d617c']:['#dba9ef','#b6d997','#f2c38b','#8b9cab','#8ecdec'];
  const groups=[['keyword','selector-tag'],['string','attr'],['number','literal'],['comment'],['title']];
  const syntax=groups.map((names,i)=>`${names.map(n=>'.article pre .hljs-'+n).join(',')}{color:${readableColor(palette[i],background)}}`).join('');
  const caption=(id==='folio'?'#756b60':id==='classical'?'#8d735b':id.startsWith('journal-')?'#627083':accent),footnote=id==='classical'?'#7e6e5e':'#707880';
  const quote=id==='moon'?'.article blockquote{color:#5d6e85}':id==='minimal'?'.article blockquote{color:#626970}':id==='plain'?'.article blockquote{color:#7d7066}':'';
  return `.article pre{color:${color||readableColor(ink,background,7)}}${syntax}
    .article pre .theme-code-label{color:${readableColor('#8b9cab',background)}}
    ${color?`.article pre code [class*="hljs-"]{color:inherit}`:''}
    .article .image-wrap .image-caption{color:${readableColor(caption,theme.paper)}!important}
    .article .image-source{color:${readableColor('#667078',theme.paper)}}
    .article .footnotes{color:${readableColor(footnote,theme.paper)}}${quote}`;
}
