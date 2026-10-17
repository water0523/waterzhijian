import type MarkdownIt from 'markdown-it';
import {escapeHTML} from './model';
import type {StyleSourceRange} from './inline-style';

// Keep source offsets while parsing, rather than searching the rendered article
// for repeated words. Only literal text receives an editable range.
export function installTextMapping(md:MarkdownIt){
  const parser=md.inline as any, Base=parser.State;
  parser.State=class extends Base {
    delimiterPosition=-1;delimiterOffset=0;
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
      if(this.env.editable&&type==='code_inline')token.meta={rawElementFrom:this.pos};
      if(this.env.editable&&type==='text'&&/[*_~]/.test(this.src[this.pos]||'')){
        if(this.delimiterPosition!==this.pos){this.delimiterPosition=this.pos;this.delimiterOffset=0;}
        token.meta={delimiterFrom:this.pos+this.delimiterOffset};
        const tildes=this.src[this.pos]==='~'?/^~+/.exec(this.src.slice(this.pos))![0].length:0;
        this.delimiterOffset+=tildes?(this.delimiterOffset===0&&tildes%2?1:2):1;
      }
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
    const consumed=new Map<number,number>();let tableLine:number|undefined;
    for(const block of state.tokens){
      if(block.type==='tr_open')tableLine=block.map?.[0];
      if(block.type==='tr_close')tableLine=undefined;
      if(block.type!=='inline'||!block.children)continue;
      // Generated inline tokens may lack their own source maps. Their escaped
      // text still needs the normal text_join conversion to render; table cells
      // can use the row map and the consumed column to distinguish duplicates.
      for(const t of block.children)if(t.type==='text_special'){t.type='text';if(t.meta)t.meta.rawTo=t.meta.rawFrom+t.markup.length;}
      const map=block.map||(tableLine!==undefined?[tableLine,tableLine+1]:null);
      if(!map)continue;
      const positions:number[]=[];let sourceLine=map[0];
      for(const part of block.content.split('\n')){
        let found=false;
        for(;sourceLine<map[1];sourceLine++){
          const col=lines[sourceLine].indexOf(part,consumed.get(sourceLine)||0);
          if(col<0)continue;
          for(let n=0;n<part.length;n++)positions.push(starts[sourceLine]+col+n);
          positions.push(starts[sourceLine]+col+part.length);
          consumed.set(sourceLine,col+part.length);sourceLine++;found=true;break;
        }
        if(!found){positions.length=0;break;}
      }
      const native:{token:typeof block.children[number];from:number;size:number;key:'bold'|'italic'|'strike'}[]=[];
      for(const t of block.children){
        const key=t.tag==='strong'?'bold':t.tag==='em'?'italic':t.tag==='s'?'strike':null;
        if(key&&t.nesting===1){
          const size=key==='italic'?1:2,from=t.meta?.nativeFrom??(t.meta?.delimiterFrom-(key==='bold'?1:0));
          native.push({token:t,from,size,key});
        }else if(key&&t.nesting===-1){
          const open=native.pop(),end=t.meta?.nativeFrom??t.meta?.delimiterFrom;
          if(open&&Number.isFinite(open.from)&&Number.isFinite(end))open.token.meta={...open.token.meta,styleSource:{from:open.from,to:end+open.size,contentFrom:open.from+open.size,contentTo:end,attrsFrom:end,attrsTo:end,style:{[open.key]:true},native:open.key} satisfies StyleSourceRange};
        }
      }
      for(const t of block.children){
        const original:StyleSourceRange|undefined=t.meta?.styleSource;
        if(original){
          const from=positions[original.from],to=positions[original.to-1]+1,contentFrom=positions[original.contentFrom],contentTo=positions[original.contentTo-1]+1,attrsFrom=positions[original.attrsFrom],attrsTo=positions[original.attrsTo];
          if([from,to,contentFrom,contentTo,attrsFrom,attrsTo].every(Number.isFinite))t.meta.fontStyle={from,to,contentFrom,contentTo,attrsFrom,attrsTo,style:original.style,native:original.native} satisfies StyleSourceRange;
        }
        if(t.type==='code_inline'&&t.meta?.rawElementFrom!==undefined){
          const a=t.meta.rawElementFrom as number,marker=t.markup;let b=a+marker.length;
          while((b=block.content.indexOf(marker,b))>=0){if(block.content[b-1]!=='`'&&block.content[b+marker.length]!=='`')break;b+=marker.length;}
          if(b>=0)t.meta.rawElementTo=b+marker.length;
        }
        if(t.meta?.rawElementFrom!==undefined&&t.meta?.rawElementTo!==undefined){
          const a=positions[t.meta.rawElementFrom],b=positions[t.meta.rawElementTo-1]+1;
          if(Number.isFinite(a)&&Number.isFinite(b))t.meta.protectedRange={from:a,to:b};
        }
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
