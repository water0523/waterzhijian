import {build} from 'esbuild';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

export async function exportFormatPrompts(){
  globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
  const built=await build({stdin:{contents:"export {themes} from './src/themes';export {buildFormatPrompt,formatProfile} from './src/format-prompts';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
  const {themes,buildFormatPrompt,formatProfile}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  const special=themes.filter(theme=>!['standard','exam'].includes(formatProfile(theme))),standard=themes.find(theme=>theme.id==='rational'),exams=themes.filter(theme=>formatProfile(theme)==='exam');
  const entry=theme=>'## '+theme.name+'\n\n'+buildFormatPrompt(theme);
  const intro='# 主题格式改写提示词\n\n入口在「同步滚动」左边的「格式改写」。选择主题后，可以只复制提示词，也可以连同当前文章一次复制，发给你自己选择的 AI；把返回的完整 Markdown 粘回编辑区，并切换到对应主题。这里不调用 AI，不自动发送文章或修改稿件。\n\n提示词让 AI 先理解你的具体文本，再根据内容、语气、重点、段落关系和阅读节奏自主选择合适的格式，尽可能发挥主题特色。无需原文先有同名栏目或强调标记；组件用途、搭配、复用、样式密度由 AI 判断，没有必用组件、固定顺序或数量配额。原文文字、标点和顺序必须保持不变，不增删、不润色、不翻译、不总结、不补写，不为凑组件伪造事实材料。\n\n界面中的提示词与下方内容一致，由 scripts/export-format-prompts.mjs 从同一份规则生成。每次只选一套，将你的全文放在最后的「下面是我的原文」之后。语法示例只演示位置，不是新增素材；外部 AI 的实际结果仍应与原文核对。\n\n';
  const examPart='\n<!-- exam-format-prompts -->\n\n## 试卷主题 · 六科专用提示词\n\n参考答案使用宋体，解析使用楷体，英文默认 Times New Roman；原文没有答案或解析时不补写。\n\n'+exams.map(theme=>'### '+theme.name+'\n\n```text\n'+buildFormatPrompt(theme)+'\n```').join('\n\n');
  await writeFile('主题格式改写提示词.md',intro+[...special,standard].filter(Boolean).map(entry).join('\n\n')+examPart+'\n');
  console.log(`Exported ${special.length} special, ${exams.length} exam and one standard prompt from the runtime rules.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await exportFormatPrompts();
