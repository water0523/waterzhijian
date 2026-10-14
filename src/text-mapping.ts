import type MarkdownIt from 'markdown-it';
import {escapeHTML} from './model';

// Keep source offsets while parsing, rather than searching the rendered article
// for repeated words. Only literal text receives an editable range.
export function installTextMapping(md:MarkdownIt){
  const parser=md.inline as any, Base=parser.State;
  parser.State=class extends Base {
    pushPending(){
      const value=this.pending;
      const from=this.src.lastIndexOf(value,this.pos-value.length);
      const token=super.pushPending();
      if(this.env.editable&&from>=0)token.meta={rawFrom:from,rawTo:from+value.length};
      return token;
    }
    push(type:string,tag:string,nesting:number){
      const token=super.push(type,tag,nesting);
      if(this.env.editable&&type==='text_special')token.meta={rawFrom:this.pos};
      return token;
    }
  };
  // Merging text tokens discards the source ranges. Retain the normal renderer's
  // behavior outside the editable preview, and retain separate runs inside it.
  const fragments=md.inline.ruler2.getRules('').at(-1)!;
  md.inline.ruler2.at('fragments_join',state=>{
    if(!state.env.editable)return fragments(state);
    let level=0;
    for(const t of state.tokens){if(t.nesting<0)level--;t.level=level;if(t.nesting>0)level++;}
    return true;
  });
  const join=md.core.ruler.getRules('').at(-1)!;
  md.core.ruler.at('text_join',state=>{
    if(!state.env.editable){join(state);return;}
    const lines=state.src.split('\n'),starts:number[]=[];let offset=0;
    for(const line of lines){starts.push(offset);offset+=line.length+1;}
    const consumed=new Map<number,number>();
    for(const block of state.tokens){
      if(block.type!=='inline'||!block.children)continue;
      // Tables and generated footnote tokens may not have source maps. Their
      // escaped text still needs the normal text_join conversion to render.
      for(const t of block.children)if(t.type==='text_special'){t.type='text';if(t.meta)t.meta.rawTo=t.meta.rawFrom+t.markup.length;}
      if(!block.map)continue;
      const positions:number[]=[];let sourceLine=block.map[0];
      for(const part of block.content.split('\n')){
        let found=false;
        for(;sourceLine<block.map[1];sourceLine++){
          const col=lines[sourceLine].indexOf(part,consumed.get(sourceLine)||0);
          if(col<0)continue;
          for(let n=0;n<part.length;n++)positions.push(starts[sourceLine]+col+n);
          positions.push(starts[sourceLine]+col+part.length);
          consumed.set(sourceLine,col+part.length);sourceLine++;found=true;break;
        }
        if(!found){positions.length=0;break;}
      }
      for(const t of block.children){
        if(t.type!=='text'||!t.content||t.meta?.rawFrom===undefined)continue;
        const {rawFrom:a,rawTo:b}=t.meta;
        if(b>a&&positions[a]!==undefined&&positions[b-1]===positions[a]+b-a-1){
          t.meta.editFrom=positions[a];t.meta.editTo=positions[b-1]+1;
        }
      }
    }
  });
  const text=md.renderer.rules.text!;
  md.renderer.rules.text=(ts,i,o,env,self)=>{
    const t=ts[i],html=text(ts,i,o,env,self);
    return env.editable&&t.meta?.editFrom!==undefined?`<span data-edit-from="${t.meta.editFrom}" data-edit-to="${t.meta.editTo}">${html}</span>`:html;
  };
}

export function editablePoem(content:string,line:number,source:string){
  const lines=source.split('\n');let offset=lines.slice(0,line+1).reduce((n,l)=>n+l.length+1,0);
  return content.split('\n').map(text=>{const start=offset;offset+=text.length+1;return text?`<span data-edit-from="${start}" data-edit-to="${start+text.length}" data-edit-literal="true">${escapeHTML(text)}</span>`:'';}).join('\n');
}
