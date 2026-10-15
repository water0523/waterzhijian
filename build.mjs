import {build} from 'esbuild';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
const result=await build({entryPoints:['src/app.ts'],loader:{'.webp':'dataurl'},bundle:true,write:false,metafile:true,format:'iife',platform:'browser',target:['chrome110','edge110'],minify:true,legalComments:'inline',define:{'process.env.NODE_ENV':'"production"'}});
const packages=new Set(Object.keys(result.metafile.inputs).filter(p=>p.startsWith('node_modules/')).map(p=>{const parts=p.split('/');return parts.slice(0,parts[1].startsWith('@')?3:2).join('/');}));
let notices='纸间 · Third-party software notices\nLibraries are embedded for offline use. Their respective licenses apply.\n';
for(const dir of [...packages].sort()){
 const pkg=JSON.parse(await readFile(dir+'/package.json','utf8'));
 notices+=`\n${'='.repeat(70)}\n${pkg.name} ${pkg.version} (${pkg.license||'See license below'})\n`;
 const licenses=(await readdir(dir)).filter(f=>/^(licen[cs]e|copying|notice)(\.|$)/i.test(f));
 for(const f of licenses)notices+='\n'+await readFile(dir+'/'+f,'utf8')+'\n';
}
const template=await readFile('index.template.html','utf8');
const css=await readFile('src/app.css','utf8')+'\n'+await readFile('src/workspace.css','utf8')+'\n'+await readFile('src/studio.css','utf8');
const script=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const html=template.replace('</body>',()=>'<script type="text/plain" id="third-party-notices">'+notices.replace(/<\/script/gi,'<\\/script')+'</script></body>').replace('/*APP_CSS*/',()=>css).replace('/*APP_JS*/',()=>script);
await mkdir('dist',{recursive:true});
await writeFile('dist/纸间-离线公众号排版器.html',html,'utf8');
await writeFile('dist/THIRD_PARTY_NOTICES.txt',notices,'utf8');
// GitHub Pages publishes only this generated application folder.
await mkdir('docs',{recursive:true});
await writeFile('docs/index.html',html,'utf8');
await writeFile('docs/.nojekyll','','utf8');
console.log(`Built dist/纸间-离线公众号排版器.html (${(Buffer.byteLength(html)/1024/1024).toFixed(2)} MB)`);
