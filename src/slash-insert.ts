import type {CompletionContext,Completion} from '@codemirror/autocomplete';
import {syntaxTree} from '@codemirror/language';
import {readPreference} from './storage';
export const insertSnippets=[
 ['h1','一级标题','# 标题\n'],['h2','二级标题','## 标题\n'],['h3','三级标题','### 标题\n'],['quote','引用','> 引用文字\n'],['poem','诗歌',':::poem center\n诗句\n:::'],['image','图片','![图片说明](图片地址)'],['table','表格','| 项目 | 内容 |\n| --- | --- |\n| 示例 | 内容 |'],['math','公式','$$\nx = y\n$$'],['divider','分割线','---\n'],['code','代码块','```text\n代码\n```'],['component','主题组件','']
 ];
export function slashInsertSource(context:CompletionContext){
 if(readPreference('slash-insert','true')!=='true'||!context.state.selection.main.empty)return null;
 const line=context.state.doc.lineAt(context.pos),before=line.text.slice(0,context.pos-line.from),match=before.match(/(?:^|\s)\/([^\s/]*)$/);if(!match)return null;
 for(let n=syntaxTree(context.state).resolveInner(context.pos,-1);n;n=n.parent!)if(/Code|Link|URL/.test(n.name))return null;
 const preceding=context.state.sliceDoc(0,line.from);let math=false,component=0;for(const l of preceding.split('\n')){if(/^\s*\$\$/.test(l))math=!math;if(/^\s*:::\S/.test(l))component++;else if(/^\s*:::\s*$/.test(l))component=Math.max(0,component-1);}if(math||component||/(?:^|[^\\])\$[^$]*$/.test(before))return null;
 const from=context.pos-match[1].length-1,q=match[1].toLowerCase();const options:Completion[]=insertSnippets.filter(([id,title])=>id.includes(q)||title.includes(q)).map(([id,title,text])=>({label:title,detail:'插入 · '+id,type:'keyword',apply:(view)=>{const block=id!=='image',prefix=block&&context.state.sliceDoc(line.from,from).trim()?'\n\n':'',insert=prefix+text;view.dispatch({changes:{from,to:context.pos,insert},selection:{anchor:from+insert.length},userEvent:'input.insert'});if(id==='component')document.dispatchEvent(new Event('paper-insert-components'));}}));return options.length?{from,options,filter:false}:null;
}
