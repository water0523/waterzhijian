import {build} from 'esbuild';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {gzipSync,strToU8,zipSync} from 'fflate';
const options={bundle:true,write:false,metafile:true,format:'iife',platform:'browser',target:['chrome110','edge110'],minify:true,legalComments:'inline',define:{'process.env.NODE_ENV':'"production"'}};
const helperFiles={};
for(const name of ['manifest.json','background.js','content.js','使用说明.txt'])helperFiles['非水成章-下载定位助手/'+name]=new Uint8Array(await readFile('folder-helper/'+name));
const helperZIP=zipSync(helperFiles,{level:9,mtime:new Date(2020,0,1)});
await mkdir('dist',{recursive:true});await writeFile('dist/非水成章-下载定位助手.zip',helperZIP);
options.define.__FOLDER_HELPER_ZIP__=JSON.stringify(Buffer.from(helperZIP).toString('base64'));
const images=new Map(),imageNames=new Map();
const result=await build({...options,entryPoints:['src/app.ts'],plugins:[{name:'offline-example-images',setup(builder){builder.onLoad({filter:/\.(?:webp|png)$/},async({path:filename})=>{
 const key='embedded-image-'+createHash('sha256').update(path.relative(process.cwd(),filename).replaceAll('\\','/')).digest('hex').slice(0,16);
 imageNames.set(key,path.basename(filename));images.set(key,'data:image/'+(filename.endsWith('.png')?'png':'webp')+';base64,'+(await readFile(filename)).toString('base64'));
 return {contents:'export default '+JSON.stringify(key)+';',loader:'js'};
});}}]});
const vendors=[];
for(const name of ['math','word','highlight']){
 const output=await build({...options,entryPoints:['src/'+name+'-engine.ts'],globalName:'__offlineExports'});
 const script='globalThis.__feishuiOfflineModules['+JSON.stringify(name)+']=(()=>{'+output.outputFiles[0].text+';return __offlineExports;})();';
 vendors.push({name,script,metafile:output.metafile});
}
const packages=new Set([result.metafile,...vendors.map(v=>v.metafile)].flatMap(meta=>Object.keys(meta.inputs)).filter(p=>p.startsWith('node_modules/')).map(p=>{const parts=p.split('/');return parts.slice(0,parts[1].startsWith('@')?3:2).join('/');}));
let notices='非水·成章 · Third-party software notices\nLibraries are embedded for offline use. Their respective licenses apply.\n';
for(const dir of [...packages].sort()){
 const pkg=JSON.parse(await readFile(dir+'/package.json','utf8'));
 notices+=`\n${'='.repeat(70)}\n${pkg.name} ${pkg.version} (${pkg.license||'See license below'})\n`;
 const licenses=(await readdir(dir)).filter(f=>/^(licen[cs]e|copying|notice)(\.|$)/i.test(f)).sort();
 for(const f of licenses)notices+='\n'+await readFile(dir+'/'+f,'utf8')+'\n';
}
const logo='data:image/jpeg;base64,'+(await readFile('assets/brand-logo.jpg')).toString('base64');
const template=(await readFile('index.template.html','utf8')).replaceAll('/*BRAND_LOGO*/',logo);
const css=await readFile('src/app.css','utf8')+'\n'+await readFile('src/workspace.css','utf8')+'\n'+await readFile('src/studio.css','utf8')+'\n'+await readFile('src/workbench.css','utf8')+'\n'+await readFile('src/find-replace.css','utf8')+'\n'+await readFile('src/ui-skin.css','utf8');
const script=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const payloads=vendors.map(v=>'<script type="application/x-feishui-module" data-encoding="gzip-base64" id="offline-module-'+v.name+'">'+Buffer.from(gzipSync(strToU8(v.script),{level:9,mtime:0})).toString('base64')+'</script>').join('\n')+'\n'+[...images].sort(([a],[b])=>a.localeCompare(b)).map(([key,data])=>'<script type="application/x-feishui-image" data-name="'+imageNames.get(key)+'" id="'+key+'">'+data+'</script>').join('\n');
const html=template.replace('</body>',()=>'<script type="text/plain" id="third-party-notices">'+notices.replace(/<\/script/gi,'<\\/script')+'</script></body>').replace('/*APP_CSS*/',()=>css).replace('<script>/*APP_JS*/</script>',()=>payloads+'\n<script>'+script+'</script>');
await mkdir('dist',{recursive:true});
await writeFile('dist/非水·成章-离线公众号排版器.html',html,'utf8');
// Keep the original entry point so existing file-origin drafts remain accessible.
await writeFile('dist/纸间-离线公众号排版器.html',html,'utf8');
await writeFile('dist/THIRD_PARTY_NOTICES.txt',notices,'utf8');
// GitHub Pages publishes only this generated application folder.
await mkdir('docs',{recursive:true});
await writeFile('docs/index.html',html,'utf8');
await writeFile('docs/.nojekyll','','utf8');
console.log(`Built dist/非水·成章-离线公众号排版器.html (${(Buffer.byteLength(html)/1024/1024).toFixed(2)} MB)`);
console.log(`Startup script ${(Buffer.byteLength(script)/1024/1024).toFixed(2)} MB; optional engines and ${images.size} example images stay embedded and load on use.`);

const inventory=await build({...options,format:'esm',platform:'node',stdin:{contents:"export {themes} from './src/themes';",resolveDir:process.cwd()}});globalThis.localStorage={getItem:()=>null,setItem:()=>{}};const {themes}=await import('data:text/javascript;base64,'+Buffer.from(inventory.outputFiles[0].text).toString('base64'));
const info={at:new Date().toISOString(),version:JSON.parse(await readFile('package.json','utf8')).version,themes:themes.length,htmlBytes:Buffer.byteLength(html),startupBytes:Buffer.byteLength(script),imagePayloads:images.size,sha256:createHash('sha256').update(html).digest('hex')};await writeFile('dist/build-info.json',JSON.stringify(info,null,2));await writeFile('当前构建信息.md',`# 当前构建信息\n\n生成时间：${info.at}\n\n主题：${info.themes} 套\n\n离线 HTML：${(info.htmlBytes/1024/1024).toFixed(2)} MiB\n\n启动脚本：${(info.startupBytes/1024/1024).toFixed(2)} MiB\n\nSHA256：${info.sha256}\n`);
