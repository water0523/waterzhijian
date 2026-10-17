import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {exportFormatPrompts} from './export-format-prompts.mjs';
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
const built=await build({stdin:{contents:"export {examSubjects} from './src/exam-themes';export {examSamples} from './src/exam-samples';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {examSubjects,examSamples}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
await mkdir('试卷示例',{recursive:true});
for(const subject of examSubjects){const source=examSamples[subject.id];assert.ok(source.includes(':::exam-key')&&source.includes(':::exam-analysis'));assert.doesNotMatch(source,/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/);await writeFile('试卷示例/'+subject.name+'.md',source);}
console.log('Exported six original subject samples, each with answers and analysis.');
await exportFormatPrompts();
