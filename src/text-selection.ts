import type {ChangeSpec} from '@codemirror/state';
import {mappedStyleBlocks} from './render';
import {styleAttributes,type InlineStyle,type StyleSourceRange} from './inline-style';

export const selectionStyleKeys=['font','size','color','highlight','bold','italic','underline','wave','strike','dots','gold','marker','markerColor','role','ornament'] as const;
export type TextSourceRange={from:number;to:number};
type Run={from:number;to:number;text:string;styles:StyleSourceRange[];atomic:boolean;locked:boolean;scope:string};
function inheritedStyle(styles:InlineStyle[]){
  const result:InlineStyle={};
  for(const style of styles){Object.assign(result,style);if(style.marker&&!style.markerColor)delete result.markerColor;}
  return result;
}
export const textRunStyle=(run:Pick<Run,'styles'>)=>inheritedStyle(run.styles.map(range=>range.style));
function patched(style:InlineStyle,patch:InlineStyle){
  const result={...style};
  for(const key of selectionStyleKeys)if(Object.hasOwn(patch,key)){
    if(patch[key]===undefined||patch[key]===false)delete result[key];else Object.assign(result,{[key]:patch[key]});
  }
  return result;
}
export function selectedTextRuns(source:string,from:number,to:number,selectionRanges?:readonly TextSourceRange[]){
  const ranges=selectionRanges||[{from,to}];
  const runs:Run[]=[],seen=new Set<string>(),parsed=mappedStyleBlocks(source);
  for(const {tokens,scope} of parsed.blocks){
    const stack:(StyleSourceRange|undefined)[]=[];
    for(const token of tokens){
      if(token.nesting===1)stack.push(token.meta?.fontStyle);
      else if(token.nesting===-1)stack.pop();
      else if(token.type==='text'&&token.meta?.editFrom!==undefined||token.meta?.protectedRange){
        const locked=!!token.meta?.protectedRange,a=(locked?token.meta.protectedRange.from:token.meta.editFrom) as number,b=(locked?token.meta.protectedRange.to:token.meta.editTo) as number,key=a+':'+b;
        if(seen.has(key))continue;seen.add(key);
        runs.push({from:a,to:b,text:locked?'':token.content,styles:stack.filter((s):s is StyleSourceRange=>!!s),atomic:locked||b-a!==token.content.length,locked,scope});
      }
    }
  }
  const selected=runs.filter(run=>!run.locked&&ranges.some(range=>run.from<range.to&&run.to>range.from&&(!run.atomic||range.from<=run.from&&range.to>=run.to)));
  const effective=(run:Run)=>inheritedStyle(run.styles.map(s=>s.style)),common:InlineStyle={};
  for(const key of selectionStyleKeys){const value=selected.length?effective(selected[0])[key]:undefined;if(value!==undefined&&selected.every(run=>effective(run)[key]===value))Object.assign(common,{[key]:value});}
  const incompatible=ranges.some(range=>{
    const inside=selected.filter(run=>run.from<range.to&&run.to>range.from),scopes=new Set(inside.map(run=>run.scope));
    return scopes.size>1||inside.length&&parsed.barriers.some(b=>b.from<range.to&&b.to>range.from&&!(b.table&&range.from>=b.from&&range.to<=b.to));
  });
  const error=incompatible?'选区跨过了不同格式区域，请分别选择正文、标题、引用、列表、代码或公式后操作。':undefined;
  return {source,from,to,ranges,runs,selected,common,error};
}
export function textStyleChanges(plan:ReturnType<typeof selectedTextRuns>,patch:InlineStyle):ChangeSpec[]{
  if(plan.error||!plan.selected.length)return [];
  const {ranges,runs,selected}=plan,keys=selectionStyleKeys.filter(key=>Object.hasOwn(patch,key)),updates=new Map<number,{range:StyleSourceRange;style:InlineStyle}>();
  const lockedAncestors=new Set(runs.filter(run=>run.locked).flatMap(run=>run.styles.map(s=>s.from)));
  const whole=(s:StyleSourceRange)=>ranges.some(range=>range.from<=s.contentFrom&&range.to>=s.contentTo)&&!lockedAncestors.has(s.from);
  for(const run of selected)for(const range of run.styles){
    if(!keys.some(key=>range.style[key]!==undefined))continue;
    if(range.native&&patch[range.native]===true)continue;
    const clear=Object.fromEntries(keys.map(key=>[key,undefined])) as InlineStyle;
    updates.set(range.from,{range,style:patched(range.style,whole(range)?patch:clear)});
  }
  const effective=(run:Run)=>inheritedStyle(run.styles.map(s=>updates.get(s.from)?.style||s.style));
  for(const run of selected){
    const current=effective(run),needs=keys.some(key=>patch[key]!==undefined&&patch[key]!==false&&patch[key]!==current[key]);
    if(!needs)continue;
    const range=[...run.styles].reverse().find(s=>!s.native&&whole(s));
    if(range)updates.set(range.from,{range,style:patched(updates.get(range.from)?.style||range.style,patch)});
  }
  const edits:{from:number;to:number;insert:string}[]=[],inserts=new Map<number,{before:string;after:string}>();
  const add=(position:number,text:string,closing=false,inner=false)=>{
    const value=inserts.get(position)||{before:'',after:''};if(closing)value.before=inner?text+value.before:value.before+text;else value.after+=text;inserts.set(position,value);
  };
  for(const {range,style} of updates.values()){
    const attrs=styleAttributes(style);
    if(range.native){if(!style[range.native])edits.push({from:range.from,to:range.contentFrom,insert:''},{from:range.contentTo,to:range.to,insert:''});}
    else if(attrs)edits.push({from:range.attrsFrom,to:range.attrsTo,insert:attrs});
    else edits.push({from:range.from,to:range.contentFrom,insert:''},{from:range.contentTo,to:range.to,insert:''});
  }
  const selectedSet=new Set(selected);
  for(const run of runs){
    const original=inheritedStyle(run.styles.map(s=>s.style)),after=effective(run),inside=selectedSet.has(run);
    const points=[...new Set([run.from,...(inside?ranges.filter(range=>range.from<run.to&&range.to>run.from).flatMap(range=>[Math.max(run.from,range.from),Math.min(run.to,range.to)]):[]),run.to])].sort((a,b)=>a-b);
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],selectedSegment=inside&&ranges.some(range=>a>=range.from&&b<=range.to),desired=selectedSegment?patched(original,patch):original,delta:InlineStyle={};
      for(const key of selectionStyleKeys)if(desired[key]!==undefined&&desired[key]!==false&&desired[key]!==after[key])Object.assign(delta,{[key]:desired[key]});
      // A role has its own CSS font, size and color. When moving it into a new
      // inner span, retain explicit overrides there rather than inheriting them
      // from the former parent, where the role's CSS would take precedence.
      if(delta.role)Object.assign(delta,desired);
      // Keep native emphasis on unselected edges as native emphasis: themes
      // can give <strong>/<em>/<s> a different appearance from styled spans.
      // Put boundary whitespace outside delimiters so Markdown still parses.
      const nativeEdges:{from:number;to:number;delimiter:string}[]=[];
      if(!selectedSegment)for(const key of ['bold','italic','strike'] as const){
        const native=run.styles.find(s=>s.native===key);
        if(!native||!delta[key]||run.locked)continue;
        const text=plan.source.slice(a,b),leading=text.length-text.trimStart().length,trailing=text.length-text.trimEnd().length;
        if(leading+trailing>=text.length)continue;
        nativeEdges.push({from:a+leading,to:b-trailing,delimiter:plan.source.slice(native.from,native.contentFrom)});delete delta[key];
      }
      const attrs=styleAttributes(delta);if(attrs){add(a,'[');add(b,']{'+attrs+'}',true);}
      for(const edge of nativeEdges){add(edge.from,edge.delimiter);add(edge.to,edge.delimiter,true,true);}
    }
  }
  for(const [position,value] of inserts){
    const text=value.before+value.after,edit=edits.find(e=>e.from===position);
    if(edit)edit.insert=text+edit.insert;else edits.push({from:position,to:position,insert:text});
  }
  return edits.filter(e=>plan.source.slice(e.from,e.to)!==e.insert).sort((a,b)=>a.from-b.from||a.to-b.to);
}
