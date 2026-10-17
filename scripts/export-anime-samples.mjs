import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const built=await build({entryPoints:['src/anime-sample.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {animeSample}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
await mkdir('动漫手记示例',{recursive:true});
for(const name of ['樱粉魔法','抹茶猫猫'])await writeFile('动漫手记示例/'+name+'.md',animeSample);
console.log('Exported both anime theme samples.');
