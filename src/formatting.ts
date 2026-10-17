import type {MarkdownEditor} from './editor';
import {parseInlineStyle,styleAttributes,type InlineStyle} from './inline-style';
export function toggleTextStyle(editor:MarkdownEditor,key:'bold'|'italic'|'underline'|'wave'|'strike'){
  const s=editor.view.state.selection.main,source=editor.view.state.doc.toString();
  let from=s.from,to=s.to,text=source.slice(from,to)||'文字';let style:InlineStyle={};
  const suffix=source.slice(to).match(/^\]\{([^}]+)\}/);
  const inner=source[from-1]==='['&&suffix?parseInlineStyle(suffix[1]):null;
  const full=/^\[([\s\S]*)\]\{([^}]+)\}$/.exec(text),outer=full?parseInlineStyle(full[2]):null;
  if(inner){style=inner;from--;to+=suffix![0].length;}
  else if(outer){style=outer;text=full![1];}
  style[key]=!style[key];const attrs=styleAttributes(style),insert=attrs?`[${text}]{${attrs}}`:text,offset=attrs?1:0;
  editor.view.dispatch({changes:{from,to,insert},selection:{anchor:from+offset,head:from+offset+text.length},userEvent:'input.format'});editor.view.focus();
}
export function hasSelectedStyle(editor:MarkdownEditor){const s=editor.view.state.selection.main,doc=editor.view.state.doc.toString();return doc[s.from-1]==='['&&/^\]\{/.test(doc.slice(s.to))||/\]\{[^}]+\}/.test(doc.slice(s.from,s.to));}
export function codeFormat(editor:MarkdownEditor){
  const s=editor.view.state.selection.main,text=editor.view.state.sliceDoc(s.from,s.to)||'代码';
  const n=Math.max(1,...[...text.matchAll(/`+/g)].map(m=>m[0].length+1));
  if(!text.includes('\n')){const delimiter='`'.repeat(n),padding=/^`|`$|^ .* $/.test(text)?' ':'';editor.wrap(delimiter+padding,padding+delimiter);}
  else{const fence='`'.repeat(Math.max(3,n));editor.wrap('\n'+fence+'\n','\n'+fence+'\n');}
}
export function insertFootnote(editor:MarkdownEditor){
  const s=editor.view.state.selection.main,doc=editor.view.state.doc.toString();let number=1;while(doc.includes(`[^${number}]`))number++;
  const marker=`[^${number}]`,prefix=doc.endsWith('\n\n')?'':doc.endsWith('\n')?'\n':'\n\n',definition=prefix+marker+': 脚注内容';
  const insert=doc.slice(0,s.to)+marker+doc.slice(s.to)+definition,from=insert.length-'脚注内容'.length;
  editor.view.dispatch({changes:{from:0,to:doc.length,insert},selection:{anchor:from,head:insert.length},scrollIntoView:true,userEvent:'input.format'});editor.view.focus();
}
export function blockFormat(editor:MarkdownEditor,kind:'quote'|'poem'|'h1'|'h2'|'h3'|'h4'|'h5'|'h6'|'paragraph'){
  const state=editor.view.state,s=state.selection.main,first=state.doc.lineAt(s.from),last=state.doc.lineAt(s.to>s.from&&state.doc.sliceString(s.to-1,s.to)==='\n'?s.to-1:s.to);
  let from=first.from,to=last.to,text=state.doc.sliceString(from,to),insert='';
  if(kind==='poem'){
    const before=first.number>1?state.doc.line(first.number-1):null,after=last.number<state.doc.lines?state.doc.line(last.number+1):null;
    if(before?.text.trim()===':::poem center'&&after?.text.trim()===':::'){from=before.from;to=after.to;insert=text;}
    else if(/^:::poem(?: center| left)?\n[\s\S]*\n:::$/.test(text)){insert=text.replace(/^:::poem[^\n]*\n/,'').replace(/\n:::$/,'');}
    else insert=`:::poem center\n${text||'第一行诗\n第二行诗'}\n:::`;
  }else{
    const lines=text.split('\n'),unquote=kind==='quote'&&lines.filter(l=>l.trim()).every(l=>/^\s*> ?/.test(l));
    insert=lines.map(line=>{
      if(kind==='quote')return unquote?line.replace(/^\s*> ?/,''):'> '+line;
      if(!line.trim())return line;
      const cleaned=line.replace(/^(\s*(?:>\s*)*)#{1,6}\s+/,'$1');
      if(kind==='paragraph')return cleaned;
      const prefix=cleaned.match(/^(\s*(?:>\s*)*)/)![0];return prefix+'#'.repeat(Number(kind[1]))+' '+cleaned.slice(prefix.length);
    }).join('\n');
    if(!text&&kind.startsWith('h'))insert='#'.repeat(Number(kind[1]))+' 新的章节';
  }
  editor.view.dispatch({changes:{from,to,insert},selection:{anchor:from,head:from+insert.length},userEvent:'input.format',scrollIntoView:true});editor.view.focus();
}
