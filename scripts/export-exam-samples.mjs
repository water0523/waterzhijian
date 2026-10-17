import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
const built=await build({stdin:{contents:"export {examSubjects} from './src/exam-themes';export {examSamples} from './src/exam-samples';export {themes} from './src/themes';export {buildFormatPrompt} from './src/format-prompts';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {examSubjects,examSamples,themes,buildFormatPrompt}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
await mkdir('试卷示例',{recursive:true});
for(const subject of examSubjects){const source=examSamples[subject.id];assert.ok(source.includes(':::exam-key')&&source.includes(':::exam-analysis'));assert.doesNotMatch(source,/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/);await writeFile('试卷示例/'+subject.name+'.md',source);}
console.log('Exported six original subject samples, each with answers and analysis.');
const marker='\n<!-- exam-format-prompts -->',guide='主题格式改写提示词.md',before=(await readFile(guide,'utf8')).split(marker)[0];
await writeFile(guide,before.trimEnd()+marker+'\n\n## 试卷主题 · 六科专用提示词\n\n参考答案使用宋体，解析使用楷体，英文默认 Times New Roman；原文没有答案或解析时不补写。\n\n'+examSubjects.map(s=>'### '+s.name+'试卷\n\n```text\n'+buildFormatPrompt(themes.find(t=>t.id===s.id))+'\n```').join('\n\n')+'\n');
