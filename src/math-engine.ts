import {mathjax} from 'mathjax-full/js/mathjax.js';
import {TeX} from 'mathjax-full/js/input/tex.js';
import {SVG} from 'mathjax-full/js/output/svg.js';
import {liteAdaptor} from 'mathjax-full/js/adaptors/liteAdaptor.js';
import {RegisterHTMLHandler} from 'mathjax-full/js/handlers/html.js';
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js';
import 'mathjax-full/js/input/tex/newcommand/NewcommandConfiguration.js';
import 'mathjax-full/js/input/tex/noundefined/NoUndefinedConfiguration.js';
import 'mathjax-full/js/input/tex/color/ColorConfiguration.js';
import 'mathjax-full/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import 'mathjax-full/js/input/tex/enclose/EncloseConfiguration.js';
import {Configuration} from 'mathjax-full/js/input/tex/Configuration.js';
import {CommandMap} from 'mathjax-full/js/input/tex/SymbolMap.js';
import TexError from 'mathjax-full/js/input/tex/TexError.js';
import {AllTags,TagsFactory} from 'mathjax-full/js/input/tex/Tags.js';
// The editor emits the standard bbox syntax, but accepts no arbitrary CSS,
// URLs or attributes from article source. Geometry is computed by MathJax.
new CommandMap('editor-bbox',{bbox:'BBox'},{BBox(parser,name){
  const option=parser.GetBrackets(String(name),'').trim(),size=/^font-size:(\d+(?:\.\d)?)px$/.exec(option);
  const attributes:Record<string,string>={};
  if(/^#[\da-f]{6}$/i.test(option))attributes.mathbackground=option;
  else if(size&&Number(size[1])>=10&&Number(size[1])<=64)attributes.mathsize=size[1]+'px';
  else throw new TexError('InvalidEditorBox','公式荧光只接受六位颜色值，字号范围是 10–64 px');
  parser.Push(parser.create('node','mstyle',[parser.ParseArg(String(name))],attributes));
}});
Configuration.create('editor-bbox',{handler:{macro:['editor-bbox']}});
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
// MathJax's all mode leaves an empty label for standalone \notag and numbers
// flalign*. Respect both explicit opt-outs without inspecting or rewriting TeX.
class EditorAllTags extends AllTags {
  finalize(...args:Parameters<AllTags['finalize']>){
    if(this.noTag||this.history.some(tag=>tag.env.endsWith('*')))return args[0];
    return super.finalize(...args);
  }
}
TagsFactory.add('editor-all',EditorAllTags);
function createEngine(tags:'ams'|'editor-all'){
  const tex=new TeX({packages:['base','ams','newcommand','noundefined','color','boldsymbol','enclose','editor-bbox'],tags,maxBuffer:20000});
  return {tex,mathDocument:mathjax.document('',{InputJax:tex,OutputJax:new SVG({fontCache:'none'})})};
}
const engines:Partial<Record<'ams'|'editor-all',ReturnType<typeof createEngine>>>={};
const cache = new Map<string,{html:string; error?:string; nextNumber?:number}>();
export function renderMath(source:string,display:boolean,startNumber=0,equationNumbers=false): {html:string;error?:string;nextNumber?:number} {
  const mode=equationNumbers?'editor-all':'ams';
  const key=mode+(display?'D':'I')+startNumber+':'+source;
  const cached=cache.get(key); if(cached) return cached;
  let result: {html:string;error?:string;nextNumber?:number};
  try {
    const {tex,mathDocument}=engines[mode]??=createEngine(mode);
    tex.reset(startNumber);
    const node=mathDocument.convert(source,{display,em:16,ex:8,containerWidth:327});
    // Keep Han glyphs in a CJK-capable family inside the SVG, including exports.
    const html=adaptor.outerHTML(node).replace(/<text\b([^>]*)>([^<]*)<\/text>/g,(tag,attributes:string,text:string)=>/\p{Script=Han}/u.test(text)?'<text'+attributes.replace(/\sfont-family="[^"]*"/,'')+' font-family="SimSun,STSong,Songti SC,Noto Serif CJK SC,serif">'+text+'</text>':tag);
    const match=html.match(/data-mjx-error="([^"]*)"/);
    const unknown=/data-mml-node="mtext"[^>]*fill="red"/.test(html)||html.includes('data-mjx-error');
    result=match||unknown?{html:'',error:match?.[1]||'无法识别的公式命令'}:{html,nextNumber:(tex.parseOptions.tags as unknown as {counter:number}).counter};
  } catch(e) { result={html:'',error:e instanceof Error?e.message:'公式语法错误'}; }
  if(cache.size>1000) cache.delete(cache.keys().next().value!);
  cache.set(key,result); return result;
}
