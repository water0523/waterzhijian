import MarkdownIt from 'markdown-it';
const parser=new MarkdownIt({html:false});
export interface WritingIssue {line:number;title:string;detail:string}
function protectedLines(text:string){
  const lines=text.split('\n'),protectedSet=new Set<number>();
  for(const token of parser.parse(text,{}))if((token.type==='fence'||token.type==='code_block')&&token.map)for(let i=token.map[0];i<token.map[1];i++)protectedSet.add(i);
  for(let i=0;i<lines.length;i++){
    if(protectedSet.has(i))continue;
    const first=lines[i].trim().replace(/^(?:>\s*)+/,'').replace(/^(?:[-+*]|\d+[.)])\s+/, '');
    if(/^:::poem(?:\s+(?:left|center))?$/.test(first)||/^:::gallery\b/.test(first)){
      protectedSet.add(i++);while(i<lines.length){protectedSet.add(i);if(lines[i].trim().replace(/^(?:>\s*)+/,'')===':::')break;i++;}
    }else if(first.startsWith('$$')){
      protectedSet.add(i);if(first.length>=4&&first.endsWith('$$'))continue;
      for(i++;i<lines.length;i++){protectedSet.add(i);if(lines[i].includes('$$'))break;}
    }
  }
  return {lines,protectedSet};
}
// Return source edits, rather than reserializing Markdown, so every other byte
// (including line endings and closing heading markers) stays untouched.
export function stripHeadingNumbers(text:string){
  const {lines,protectedSet}=protectedLines(text),starts:number[]=[];
  let offset=0;for(const line of lines){starts.push(offset);offset+=line.length+1;}
  const changes:{from:number;to:number;insert:string}[]=[];
  const cn='零〇一二三四五六七八九十百千万两壹贰叁肆伍陆柒捌玖拾佰仟';
  const number=`(?:[0-9]{1,3}|[${cn}]+|[IVXLCDM]+|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]+)`;
  const chapter=new RegExp(`^第${number}(?:部分|章节|章|节|篇|卷|讲|回|部)[ \\t]*(?:[、.．:：·—-][ \\t]*)?`);
  const wrapped=new RegExp(`^(?:（${number}）|\\(${number}\\)|\\[${number}\\](?!\\())[ \\t]*(?:[、.．:：·—-][ \\t]*)?`);
  const chinese=new RegExp(`^[${cn}]+[ \\t]*[、.．:：·）)—-][ \\t]*`);
  const roman=/^(?:[IVXLCDM]+|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]+|[A-Z])[ \t]*[、.．:：·）)—-][ \t]*/;
  const circled=/^[①-⑳⑴-⒇][ \t]*(?:[、.．:：·][ \t]*)?/;
  const arabic=/^[0-9]{1,3}(?:[.．][0-9]{1,3})*(?:[ \t]*[、.．:：·）)—-][ \t]*|[ \t]+)/;
  for(const token of parser.parse(text,{})){
    if(token.type!=='heading_open'||!token.map||protectedSet.has(token.map[0]))continue;
    const row=token.map[0],line=lines[row];
    const heading=/^([ \t]*(?:(?:>[ \t]*)|(?:[-+*]|[0-9]{1,9}[.)])[ \t]+)*#{1,6}[ \t]+)(.*)\r?$/.exec(line);
    if(!heading)continue;
    let rest=heading[2],removed=0;
    for(let i=0;i<6;i++){
      let prefix=[chapter,wrapped,chinese,roman,circled].map(re=>re.exec(rest)?.[0]).find(Boolean);
      if(!prefix){
        prefix=arabic.exec(rest)?.[0];
        if(prefix){
          const after=rest.slice(prefix.length),bare=/^[0-9]{1,3}(?:[.．][0-9]{1,3})*[ \t]+$/.test(prefix);
          // A year, quantity, decimal definition or date is part of the title.
          if(/[0-9０-９.．]/.test(after[0]||'')||(bare&&(/^(?:年|月|日|岁|个|种|条|次|项|位|本|篇|章|节|米|千米|公里|厘米|毫米|克|千克|吨|秒|分钟|小时|元|万|亿|%|％|℃|°|m\/s|kg\b|Hz\b|K\b)/i.test(after)||/^\d{3}/.test(prefix)||(/[.．]/.test(prefix)&&/^(?:是|为|等于)/.test(after)))))prefix=undefined;
        }
      }
      if(!prefix||!rest.slice(prefix.length).replace(/#+[ \t]*\r?$/,'').trim())break;
      removed+=prefix.length;rest=rest.slice(prefix.length);
    }
    if(removed){const from=starts[row]+heading[1].length;changes.push({from,to:from+removed,insert:''});}
  }
  let result=text;for(const change of [...changes].reverse())result=result.slice(0,change.from)+result.slice(change.to);
  return {text:result,changes,count:changes.length};
}
export function tidyMarkdown(text:string){
  const normalized=text.replace(/\r\n?/g,'\n'),{lines,protectedSet}=protectedLines(normalized),out:string[]=[];
  let blanks=0,singleSpaces=0,extraBlankLines=0;
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(protectedSet.has(i)){out.push(line);blanks=0;continue;}
    // Two trailing spaces are a Markdown hard break and must remain untouched.
    const cleaned=/[^ \t] $/.test(line)?line.slice(0,-1):line;if(cleaned!==line)singleSpaces++;
    if(cleaned===''){blanks++;if(blanks>2){extraBlankLines++;continue;}}else blanks=0;
    out.push(cleaned);
  }
  return {text:out.join('\n'),singleSpaces,extraBlankLines,newlines:normalized!==text};
}
function inlineVisible(line:string){
  return line.replace(/(`+)([\s\S]*?)\1/g,'').replace(/\$(?:\\.|[^$])*\$/g,'').replace(/https?:\/\/\S+/g,'');
}
export function inspectWriting(text:string):WritingIssue[]{
  const {lines,protectedSet}=protectedLines(text),issues:WritingIssue[]=[];let level=0,h1=0;
  const add=(line:number,title:string,detail:string)=>{if(issues.length<80)issues.push({line,title,detail});};
  for(const token of parser.parse(text,{})){
    if(token.type!=='heading_open'||!token.map||protectedSet.has(token.map[0]))continue;
    const next=Number(token.tag.slice(1));if(level&&next>level+1)add(token.map[0]+1,'标题层级跳跃',`从 H${level} 跳到了 H${next}，可检查是否需要补上中间一级。`);
    if(next===1&&++h1>1)add(token.map[0]+1,'多个一级标题','文章名称默认来自首个一级标题，后续章节通常可使用 H2。');level=next;
  }
  const definitions=new Set<string>();for(let i=0;i<lines.length;i++)if(!protectedSet.has(i)){const m=/^\s{0,3}\[\^([^\]\s]+)\]:/.exec(lines[i]);if(m)definitions.add(m[1]);}
  for(let i=0;i<lines.length;i++){
    if(protectedSet.has(i))continue;
    const source=lines[i],visible=inlineVisible(source);
    if(/\[(?:待补|待核实|待引用|待配图|待完善)[^\]]*\]|\b(?:TODO|FIXME)\b/i.test(visible))add(i+1,'还有待补内容',source.trim().slice(0,120));
    if(/\]\(https?:\/\/(?:www\.)?example\.(?:com|org|net)(?:[\/#?)]|$)/i.test(source.replace(/(`+)([\s\S]*?)\1/g,'')))add(i+1,'链接仍是示例地址','请确认是否已换成真实资料来源。');
    if(/^\s{0,3}#{1,6}\s*#*\s*$/.test(source))add(i+1,'标题没有文字','可以补上标题，或移除空标题行。');
    const references=visible.matchAll(/(?<!\\)\[\^([^\]\s]+)\](?!:)/g);
    for(const m of references)if(!definitions.has(m[1]))add(i+1,'脚注可能缺少说明',`未找到 [^${m[1]}]: 对应的注释，请检查文末。`);
  }
  return issues.sort((a,b)=>a.line-b.line);
}
export const writingOutlines=[
  {name:'科普解读',description:'问题 → 解释 → 证据 → 边界 → 延伸阅读',theme:'rational',text:'# 一个值得解释的问题\n\n[待补：从读者熟悉的现象或疑问开始]\n\n## 先说结论\n\n[待补：用一两句话回答核心问题]\n\n## 它为什么会发生\n\n[待补：解释机制，必要时加入公式或示意图]\n\n## 我们有哪些证据\n\n[待引用：写出研究、实验或数据的来源]\n\n## 这个结论适用于哪里\n\n[待核实：说明适用条件与尚不确定的部分]\n\n## 继续阅读\n\n[待引用：补充可追溯的资料链接]\n'},
  {name:'实验与推导',description:'目的 → 条件 → 步骤 → 数据 → 推导 → 结论',theme:'lab',text:'# 一次观察与推导\n\n## 要验证什么\n\n[待补：提出可检验的问题]\n\n## 条件与方法\n\n[待补：材料、条件、变量与步骤]\n\n## 观察记录\n\n| 条件 | 测量结果 | 单位 / 备注 |\n| --- | --- | --- |\n| [待补] | [待补] | [待补] |\n\n## 从结果到解释\n\n[待补：推理过程与公式，注意符号和单位]\n\n## 结论与局限\n\n[待核实：误差、适用范围与进一步的问题]\n'},
  {name:'随笔与书评',description:'一幕开场 → 片段与感受 → 留白收束',theme:'plain',text:'# 值得留下的一页\n\n[待补：一个具体场景、一句话，或一个想起的人]\n\n## 那一刻\n\n[待补：写下细节，让读者看见当时的画面]\n\n## 回声\n\n[待补：延伸你的感受与思考；引用时记下来源]\n\n## 后来\n\n[待补：回到开头的意象，或留下一句余韵]\n'}
] as const;
