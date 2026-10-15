import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
await mkdir('test-results',{recursive:true});const target=path.resolve('test-results/writing-core-bundle.mjs');
await build({stdin:{contents:'export * from "./src/revision-diff.ts"; export * from "./src/writing-tools.ts"; export * from "./src/inline-style.ts";',resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:target});
const {compareText,compactDiff,tidyMarkdown,inspectWriting,writingOutlines,installInlineStyles}=await import(pathToFileURL(target));const checks=[];
const check=name=>{checks.push(name);console.log('PASS '+name);};
let seed=392381;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
for(let n=0;n<250;n++){
 const a=Array.from({length:Math.floor(random()*90)+1},()=>['重复行','','正文','$$','中文：12.3%','<img src=x>'][Math.floor(random()*6)]),b=a.slice();
 for(let i=0;i<12;i++)b.splice(Math.floor(random()*b.length),random()<.5?1:0,...(random()<.5?['新增'+i]:[]));
 const before=a.join('\n'),after=b.join('\n'),diff=compareText(before,after);if(before===after)continue;
 assert.equal(diff.lines.filter(r=>r.kind!=='added').map(r=>r.text).join('\n'),before);assert.equal(diff.lines.filter(r=>r.kind!=='removed').map(r=>r.text).join('\n'),after);
}
check('250 repeated-line edits reconstruct both complete source versions');
const many=Array.from({length:2000},(_,i)=>'行'+i).join('\n');const changed=many.split('\n').map((l,i)=>i%2?l:l+'改').join('\n');const view=compactDiff(compareText(many,changed));assert.ok(view.truncated);assert.ok(view.rows.filter(r=>r.kind!=='gap').length<=600);assert.ok(compareText('\n'.repeat(100001),'small').tooLarge);check('comparison bounds displayed rows and refuses excessive line counts');
const protectedText='# 整理\n\n普通段落。 \n\n\n\n\n保留硬换行。  \n下一行\n\n```python\nx = 1 \n\n\n\nprint(x)  \n```\n\n$$\n\\begin{align}\na &= 1 \\\\\n\n\n\nb &= 2 \n\\end{align}\n$$\n\n:::poem center\n留白 \n\n\n\n是诗的一部分  \n:::\n\n:::gallery grid2 sample\n![图](asset:abc) \n\n\n\n:::\n';
const tidy=tidyMarkdown(protectedText);assert.equal(tidy.singleSpaces,1);assert.equal(tidy.extraBlankLines,2);assert.ok(tidy.text.includes('保留硬换行。  \n'));assert.equal(tidy.text.slice(tidy.text.indexOf('```')),protectedText.slice(protectedText.indexOf('```')));check('cleanup protects fenced code, aligned equations, poetry, galleries and hard line breaks');
const parser=new MarkdownIt();for(const text of ['# 标题 \n\n\n\n正文。 \n\n尾部','- 第一项 \n\n\n\n- 第二项\n\n    缩进正文','> 引用 \n> 换行  \n> 内容','    代码 \n\n\n\n    尾部  '])assert.equal(parser.render(text),parser.render(tidyMarkdown(text).text));check('ordinary Markdown rendering is unchanged after whitespace cleanup');
assert.equal(tidyMarkdown('中文 25% 与 x = 1；English。').text,'中文 25% 与 x = 1；English。');assert.ok(tidyMarkdown('a\r\nb').newlines);check('cleanup leaves punctuation, numerals, units and wording unchanged');
const issues=inspectWriting('# 正文\n\n### 跳级\n\n[待核实：出处]。\n\n[资料](https://example.com/ref)\n\n脚注[^missing]\n\n```md\n# 代码中的 H1\n[待补] [^skip]\n```\n\n$$\nTODO = 1\n$$\n\n:::poem center\n# 不是标题\n:::\n');assert.ok(issues.some(i=>i.title==='标题层级跳跃'));assert.ok(issues.some(i=>i.title==='还有待补内容'));assert.ok(issues.some(i=>i.title==='链接仍是示例地址'));assert.ok(issues.some(i=>i.title==='脚注可能缺少说明'));assert.equal(issues.length,4);check('writing review locates meaningful source issues and ignores protected blocks');
assert.ok(writingOutlines.every(o=>inspectWriting(o.text).some(i=>i.title==='还有待补内容')));check('all writing outlines contain discoverable completion markers');
const styled=new MarkdownIt({html:false}).use(installInlineStyles);
const linked=styled.render('[[文字]{color=#dc2626 bold wave}](https://example.org)');assert.match(linked,/<a href="https:\/\/example.org"><span class="inline-style"/);assert.match(linked,/font-weight:700/);assert.match(linked,/wavy/);
assert.ok((styled.render('[[外层[内层]{wave}]{bold}](https://example.org)').match(/class="inline-style"/g)||[]).length===2);assert.equal((styled.render('[外层[真链接](https://inner.example)](https://outer.example)').match(/<a /g)||[]).length,1);assert.doesNotMatch(styled.render('`[[文字]{bold}](https://example.org)`'),/<a |inline-style/);check('styled hyperlink labels render spans while real nested links and code remain isolated');
await writeFile('test-results/writing-core.json',JSON.stringify({checks},null,2));
