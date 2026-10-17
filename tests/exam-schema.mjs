import {build} from 'esbuild';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
const built=await build({stdin:{contents:"export * from './src/themes';export * from './src/theme-schema';export * from './src/format-prompts';export * from './src/exam-samples';export * from './src/component-check';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const m=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64')),checks=[];
const exams=m.themes.filter(t=>t.group==='试卷');assert.equal(exams.length,6);assert.equal(m.themes.length,50);
for(const t of exams){assert.equal(m.formatProfile(t),'exam');assert.deepEqual(m.inspectComponentStructure(m.examSamples[t.id]),[]);assert.doesNotMatch(m.examSamples[t.id],/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/);const prompt=m.buildFormatPrompt(t);for(const word of ['exam-key','exam-analysis','Times New Roman','宋体','楷体','不增','不删','绝不代答'])assert.ok(prompt.includes(word));assert.ok(m.formatTags('exam').includes('exam-pagebreak'));}
checks.push('all six themes have complete samples, preserved TeX characters, separate answers/analysis and strict format-only prompts');
const definition={id:'school-math',name:'校本数学卷',base:'exam-math',group:'试卷',palette:{accent:'#111111',paper:'#ffffff',ink:'#111111'},fonts:{body:'simsun',heading:'exam-hei',quote:'exam-kai'}};
const imported=m.materializeTheme(m.validateTheme(definition,m.builtInIds));assert.equal(imported.variant,'exam');assert.equal(m.formatProfile(imported),'exam');assert.match(m.themeCSS(imported),/Times New Roman/);assert.match(m.themeCSS(imported),/KaiTi/);
assert.throws(()=>m.validateTheme({...definition,fonts:{body:'untrusted-font'}},m.builtInIds));
assert.equal(m.inspectComponentStructure(':::exam-analysis\n未闭合解析。')[0].line,1);assert.deepEqual(m.inspectComponentStructure(':::exam-pagebreak\n\n正文。'),[]);
checks.push('custom exam themes import through the schema, inherit formatting rules, reject unknown fonts and report missing container ends without treating page breaks as containers');
await mkdir('test-results',{recursive:true});await writeFile('test-results/exam-schema.json',JSON.stringify({checks},null,2));for(const name of checks)console.log('PASS '+name);
