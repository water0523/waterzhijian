import {markerInk,styleAttributes,type InlineStyle} from './inline-style';
import {selectedTextRuns,textRunStyle,textStyleChanges,type TextSourceRange} from './text-selection';

export const formatFilters=[['marker','半高荧光'],['highlight','荧光'],['gold','泥金金句'],['ornament','修饰样式'],['font','字体'],['size','字号'],['color','字色'],['bold','加粗'],['italic','斜体'],['underline','下划线'],['wave','波浪线'],['strike','删除线'],['dots','字下着重号'],['role','文体标记'],['any','全部显式格式']] as const;
export type FormatFilter=typeof formatFilters[number][0];
export type FindHit=TextSourceRange&{text:string;line:number;value:string};
function lineIndex(source:string){
  const starts=[0];for(let i=0;i<source.length;i++)if(source[i]==='\n')starts.push(i+1);
  return (at:number)=>{let low=0,high=starts.length;while(low<high){const middle=(low+high)>>>1;if(starts[middle]<=at)low=middle+1;else high=middle;}return low;};
}
function formatValue(style:InlineStyle,key:FormatFilter){
  if(key==='any')return styleAttributes(style);
  if(key==='marker')return style.marker?markerInk(style).toLowerCase():'';
  const value=style[key];return value===true?'true':typeof value==='string'?value.toLowerCase():value===undefined?'':String(value);
}
export function findFormats(source:string,key:FormatFilter,value='',range?:TextSourceRange):FindHit[]{
  const runs=selectedTextRuns(source,0,source.length).runs.sort((a,b)=>a.from-b.from),line=lineIndex(source),hits:FindHit[]=[];let previous=-2,scope='';
  for(let index=0;index<runs.length;index++){
    const run=runs[index],from=Math.max(run.from,range?.from??0),to=Math.min(run.to,range?.to??source.length);if(run.locked||to<=from||run.atomic&&(from!==run.from||to!==run.to))continue;
    const text=run.atomic?run.text:run.text.slice(from-run.from,to-run.from);
    const actual=formatValue(textRunStyle(run),key);if(!actual||value&&actual!==value.toLowerCase())continue;
    const last=hits.at(-1);
    if(last&&previous===index-1&&scope===run.scope&&last.value===actual&&!/\n|!\[/.test(source.slice(last.to,from))){last.to=to;last.text+=text;}
    else hits.push({from,to,text,line:line(from),value:actual});
    previous=index;scope=run.scope;
  }
  return hits;
}
export function findText(source:string,query:string,caseSensitive=false,options:{wholeWord?:boolean;range?:TextSourceRange}={}):FindHit[]{
  if(!query)return [];
  const pattern=new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),caseSensitive?'gu':'giu'),line=lineIndex(source);
  return [...source.matchAll(pattern)].filter(match=>{
    const from=match.index,to=from+match[0].length;
    if(options.range&&(from<options.range.from||to>options.range.to))return false;
    if(!options.wholeWord)return true;
    // Test complete code points without anchored character classes: some
    // Chromium builds mishandle astral letters in a property class at `$`.
    const before=Array.from(source.slice(Math.max(0,from-2),from)).at(-1)||'',after=to<source.length?String.fromCodePoint(source.codePointAt(to)!):'';
    return !/[\p{L}\p{N}\p{M}_]/u.test(before)&&!/[\p{L}\p{N}\p{M}_]/u.test(after);
  }).map(match=>({from:match.index,to:match.index+match[0].length,text:match[0],line:line(match.index),value:''}));
}
export function formatFindPlan(source:string,hits:readonly TextSourceRange[]){return selectedTextRuns(source,0,source.length,hits);}
export function formatFindChanges(source:string,hits:readonly TextSourceRange[],patch:InlineStyle){
  const plan=formatFindPlan(source,hits);if(plan.error)throw new Error(plan.error);return textStyleChanges(plan,patch);
}
