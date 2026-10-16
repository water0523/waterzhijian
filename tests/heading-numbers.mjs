import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
await mkdir('test-results',{recursive:true});
const target=path.resolve('test-results/heading-numbers-bundle.mjs');
await build({entryPoints:['src/writing-tools.ts'],bundle:true,platform:'node',format:'esm',outfile:target});
const {stripHeadingNumbers:strip}=await import(pathToFileURL(target));
const cases=[
 ['# 01 标题','# 标题'],['## 1. 标题','## 标题'],['### 1、标题','### 标题'],['#### 1）标题','#### 标题'],
 ['##### 1.2 标题','##### 标题'],['###### 1.2.3. 标题','###### 标题'],['# 一、标题','# 标题'],['# 壹·标题','# 标题'],
 ['# 第一章 标题','# 标题'],['# 第十二部分：标题','# 标题'],['# （一）标题','# 标题'],['# (01) 标题','# 标题'],
 ['# [01] 标题','# 标题'],['# IV. 标题','# 标题'],['# Ⅱ、标题','# 标题'],['# A. 标题','# 标题'],['# ①标题','# 标题'],
 ['# ⑴ 标题','# 标题'],['# 第1章 01. 标题','# 标题'],['> ## 一、引用标题','> ## 引用标题'],['- ## 01 标题','- ## 标题'],
 ['# 01 **原有格式** ##','# **原有格式** ##'],['  ###\t01\t标题\r\n\r\n正文。  \r\n','  ###\t标题\r\n\r\n正文。  \r\n'],
 ['# 01 · 标题','# 标题'],['# 一 · 标题','# 标题'],['# 02 — 标题','# 标题'],['# 12:30 的记录','# 12:30 的记录'],
 ['# 01 为什么会发生','# 为什么会发生'],['# 1. 种子的旅行','# 种子的旅行'],
 ['# 2026 年的变化','# 2026 年的变化'],['# 2026.10.16 记录','# 2026.10.16 记录'],['# 3D 世界','# 3D 世界'],
 ['# v1.2 版本','# v1.2 版本'],['# 一心一意','# 一心一意'],['# 3.14 是圆周率','# 3.14 是圆周率'],
 ['# 10 个问题','# 10 个问题'],['# 20 kg 物体','# 20 kg 物体'],['# [1](https://example.org) 标题','# [1](https://example.org) 标题'],
 ['# 1. ###','# 1. ###'],['# 一、','# 一、'],['    # 01 代码','    # 01 代码'],['没有标记的 01 标题','没有标记的 01 标题'],
 ['01 标题\n===','01 标题\n==='],['# 标题 01','# 标题 01']
];
for(const [input,expected] of cases){
 const result=strip(input);assert.equal(result.text,expected,input);
 assert.equal(strip(result.text).count,0,'idempotent: '+input);
 let applied=input;for(const c of [...result.changes].reverse())applied=applied.slice(0,c.from)+c.insert+applied.slice(c.to);
 assert.equal(applied,expected);
}
const protectedBlocks='正文中的 1、序号。\r\n\r\n```md\r\n# 01 代码标题\r\n```\r\n\r\n$$\r\n# 02 公式\r\n$$\r\n\r\n:::poem center\r\n# 03 诗行\r\n:::\r\n\r\n:::gallery grid2\r\n# 04 图库内容\r\n:::\r\n';
const input='# 01 标题\r\n\r\n'+protectedBlocks+'\r\n## 二、末节\r\n';
const result=strip(input);assert.equal(result.count,2);assert.equal(result.text,'# 标题\r\n\r\n'+protectedBlocks+'\r\n## 末节\r\n');
await writeFile('test-results/heading-numbers.json',JSON.stringify({cases:cases.length,protectedBlocks:true,exactSourceRanges:true,idempotent:true},null,2));
console.log(`PASS ${cases.length} heading cases, protected blocks, exact CRLF ranges and idempotence`);
