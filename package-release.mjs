import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {zipSync,unzipSync} from 'fflate';import assert from 'node:assert/strict';
const source={},usage={},evidence={};const root='非水·成章/';
async function add(target,name){target[root+name]=new Uint8Array(await readFile(name));}
async function tree(target,dir,filter=()=>true){for(const d of await readdir(dir,{withFileTypes:true})){const name=dir+'/'+d.name;if(!filter(name,d))continue;if(d.isDirectory())await tree(target,name,filter);else await add(target,name);}}
for(const name of ['src','assets','scripts','tests','folder-helper','local-model','试卷示例','动漫手记示例','主题示例','docs/plans','plans'])await tree(source,name);
for(const f of await readdir('.'))if(/\.md$/.test(f)||['package.json','package-lock.json','tsconfig.json','build.mjs','package-release.mjs','index.template.html','.gitignore','.gitattributes'].includes(f))await add(source,f);
for(const f of ['dist/非水·成章-离线公众号排版器.html','dist/非水成章-下载定位助手.zip','使用说明.md','Markdown快捷键.md','审查优化交付说明.md','补充审查与后续优化方案.md','本轮验收结果.md','当前构建信息.md','写作面板与效率工具说明.md'])await add(usage,f);
await add(evidence,'本轮验收结果.md');await tree(evidence,'test-results/runs',name=>!name.includes('node_modules'));
await tree(usage,'local-model');
async function pack(files,names){const data=zipSync(files,{level:6}),check=unzipSync(data);for(const name of Object.keys(files))assert.deepEqual(check[name],files[name]);for(const name of names)await writeFile('dist/'+name,data);return data;}
await mkdir('dist',{recursive:true});const src=await pack(source,['非水·成章-源码与使用说明.zip','纸间-源码与使用说明.zip']);await pack(usage,['非水·成章-使用包.zip']);await pack(evidence,['非水·成章-验收证据.zip']);
const hash=b=>createHash('sha256').update(b).digest('hex');const names=['非水·成章-离线公众号排版器.html','非水·成章-源码与使用说明.zip','纸间-离线公众号排版器.html','纸间-源码与使用说明.zip','非水成章-下载定位助手.zip','非水·成章-使用包.zip','非水·成章-验收证据.zip'];const lines=[];for(const name of names)lines.push(hash(await readFile('dist/'+name))+'  '+name);await writeFile('dist/SHA256.txt',lines.join('\n')+'\n');console.log(`Source ${Object.keys(source).length} files ${(src.length/1024/1024).toFixed(2)} MiB; usage and current evidence are separate, no historical screenshot dependency.`);
