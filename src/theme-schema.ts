import {fontStacks} from './model';
import {elementNames,themeGroups,type ThemeDefinition,type ThemeFile,type ThemeLibraryFile,type ElementStyle} from './theme-types';

export const themeFileLimit=2*1024*1024;
const fail=(path:string,message:string):never=>{throw new Error(`主题文件 ${path}：${message}`);};
function object(v:unknown,path:string,keys:string[]):Record<string,any>{
  if(!v||typeof v!=='object'||Array.isArray(v))return fail(path,'应为对象');
  for(const k of Object.keys(v))if(!keys.includes(k))fail(path+'.'+k,'不支持的字段');
  return v as Record<string,any>;
}
function text(v:unknown,path:string,max:number,empty=false){
  if(typeof v!=='string'||(!empty&&!v.trim())||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))return fail(path,`应为${empty?'0':'1'}–${max}字的文本`);
  return v.trim();
}
const color=(v:unknown,p:string)=>typeof v==='string'&&/^#[\da-f]{6}$/i.test(v)?v.toLowerCase():fail(p,'请使用 #RRGGBB 六位颜色');
const number=(v:unknown,p:string,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:fail(p,`应为 ${min}–${max} 的数字`);
const font=(v:unknown,p:string)=>typeof v==='string'&&Object.hasOwn(fontStacks,v)?v:fail(p,'字体标识不支持，请参考主题规范');
const boolean=(v:unknown,p:string)=>typeof v==='boolean'?v:fail(p,'应为 true 或 false');
function choice<const T extends string>(v:unknown,p:string,values:readonly T[]):T{return values.includes(v as T)?v as T:fail(p,'可选值：'+values.join('、'));}

export function validateTheme(value:unknown,bases:readonly string[]):ThemeDefinition {
  const t=object(value,'theme',['id','name','group','description','base','palette','fonts','typography','elements','ornaments']);
  let id=text(t.id,'theme.id',60);if(!/^(?:custom-)?[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id))fail('theme.id','只使用小写字母、数字和单个连字符，以字母开头');
  if(!id.startsWith('custom-'))id='custom-'+id;
  if(id.length>60)fail('theme.id','加上 custom- 前缀后不得超过 60 字符');
  const p=object(t.palette,'theme.palette',['accent','paper','ink']);
  const out:ThemeDefinition={id,name:text(t.name,'theme.name',32),group:choice(t.group,'theme.group',themeGroups),description:text(t.description??'自定义排版','theme.description',140),base:choice(t.base,'theme.base',bases),palette:{accent:color(p.accent,'theme.palette.accent'),paper:color(p.paper,'theme.palette.paper'),ink:color(p.ink,'theme.palette.ink')}};
  if(t.fonts!==undefined){const f=object(t.fonts,'theme.fonts',['body','heading','quote','caption','code','poem']);out.fonts={};for(const k of Object.keys(f))out.fonts[k as keyof typeof out.fonts]=font(f[k],'theme.fonts.'+k);}
  if(t.typography!==undefined){
    const p=object(t.typography,'theme.typography',['size','lineHeight','paragraphGap','padding','indent','tableStyle']);out.typography={};
    for(const [k,min,max] of [['size',12,24],['lineHeight',1.3,2.8],['paragraphGap',0,40],['padding',12,48]] as const)if(p[k]!==undefined)out.typography[k]=number(p[k],'theme.typography.'+k,min,max);
    if(p.indent!==undefined)out.typography.indent=boolean(p.indent,'theme.typography.indent');
    if(p.tableStyle!==undefined)out.typography.tableStyle=choice(p.tableStyle,'theme.typography.tableStyle',['theme','three-line','striped','grid']);
  }
  if(t.elements!==undefined){
    const elements=object(t.elements,'theme.elements',[...elementNames]);out.elements={};
    for(const name of Object.keys(elements) as (typeof elementNames[number])[]){
      const path='theme.elements.'+name,s=object(elements[name],path,['font','size','weight','italic','lineHeight','letterSpacing','color','background','align','marginTop','marginBottom','padding','radius','borderWidth','borderColor','borderStyle','borderSide','shadow']);const style:ElementStyle={};
      for(const [key,min,max] of [['size',10,48],['weight',100,900],['lineHeight',1,3.5],['letterSpacing',-1,8],['marginTop',0,80],['marginBottom',0,80],['padding',0,40],['radius',0,40],['borderWidth',0,8]] as const)if(s[key]!==undefined)style[key]=number(s[key],path+'.'+key,min,max);
      for(const k of ['color','background','borderColor'] as const)if(s[k]!==undefined)style[k]=color(s[k],path+'.'+k);
      if(s.font!==undefined)style.font=font(s.font,path+'.font');if(s.italic!==undefined)style.italic=boolean(s.italic,path+'.italic');
      if(s.align!==undefined)style.align=choice(s.align,path+'.align',['left','center','right','justify']);
      if(s.borderStyle!==undefined)style.borderStyle=choice(s.borderStyle,path+'.borderStyle',['solid','dashed','dotted','double']);
      if(s.borderSide!==undefined)style.borderSide=choice(s.borderSide,path+'.borderSide',['all','top','bottom','left','right']);
      if(s.shadow!==undefined)style.shadow=choice(s.shadow,path+'.shadow',['none','soft','offset']);
      out.elements[name]=style;
    }
  }
  if(t.ornaments!==undefined){const o=object(t.ornaments,'theme.ornaments',['label','mark','numbered','quoteLabel','codeLabel']);out.ornaments={};for(const k of ['label','mark','quoteLabel','codeLabel'] as const)if(o[k]!==undefined)out.ornaments[k]=text(o[k],'theme.ornaments.'+k,k==='mark'?8:60,true);if(o.numbered!==undefined)out.ornaments.numbered=boolean(o.numbered,'theme.ornaments.numbered');}
  return out;
}
export function parseThemeFile(input:string,bases:readonly string[]):{themes:ThemeDefinition[];hidden:string[]}{
  if(new TextEncoder().encode(input).length>themeFileLimit)throw new Error('主题文件超过 2 MB，请拆分导入');
  let raw:unknown;try{raw=JSON.parse(input);}catch{throw new Error('主题文件不是有效的 JSON，请检查逗号、引号和括号');}
  if(!raw||typeof raw!=='object')throw new Error('主题文件格式不正确');
  const format=(raw as any).format;
  if(format==='zhijian-theme'){
    const f=object(raw,'文件',['format','version','theme']);if(f.version!==1)throw new Error('暂不支持此主题版本');return {themes:[validateTheme(f.theme,bases)],hidden:[]};
  }
  const f=object(raw,'文件',['format','version','themes','hidden']);if(f.format!=='zhijian-theme-library'||f.version!==1||!Array.isArray(f.themes)||f.themes.length>100)throw new Error('请导入纸间主题 JSON，主题库最多包含 100 个自定义主题');
  const themes=f.themes.map((t:unknown)=>validateTheme(t,bases));if(new Set(themes.map((t:ThemeDefinition)=>t.id)).size!==themes.length)throw new Error('同一文件内的主题标识重复');
  const hidden=f.hidden??[];if(!Array.isArray(hidden)||hidden.length>bases.length+100||!hidden.every(id=>typeof id==='string'&&(bases.includes(id)||themes.some((t:ThemeDefinition)=>t.id===id))))throw new Error('主题库的移除记录无效');
  return {themes,hidden:[...new Set<string>(hidden)]};
}
export const themeDocument=(theme:ThemeDefinition):ThemeFile=>({format:'zhijian-theme',version:1,theme});
export const libraryDocument=(themes:ThemeDefinition[],hidden:string[]):ThemeLibraryFile=>({format:'zhijian-theme-library',version:1,themes,hidden});
