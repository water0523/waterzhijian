import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {uid,fontStacks,type Article,type Asset,type AssetSettings,type Typography,type Sticker} from './model';
import {themes,builtInIds,themesForArticles,themeLibraryDocument} from './themes';
import {parseThemeFile,libraryDocument,validateElements} from './theme-schema';
import type {ThemeDefinition} from './theme-types';
export const safeName=(s:string)=>s.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,90)||'未命名文章';
export function download(data:BlobPart,name:string,type='application/octet-stream'){
  const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export const extension=(mime:string)=>({'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[mime]||'png');
export function bytesFromData(data:string){const raw=atob(data.split(',')[1]);return Uint8Array.from(raw,c=>c.charCodeAt(0));}
function dataFromBytes(bytes:Uint8Array,mime:string){let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));return `data:${mime};base64,${btoa(raw)}`;}
export function assetRefs(markdown:string){return [...new Set([...markdown.matchAll(/asset:([a-zA-Z0-9-]+)/g)].map(m=>m[1]))];}
export function createBackup(articles:Article[],assets:Map<string,Asset>,folders:string[]=[],all=false):Uint8Array{
  const files:Record<string,Uint8Array>={};
  const ids=new Set(articles.flatMap(a=>[...assetRefs(a.markdown),...(a.stickers||[]).map(s=>s.assetId),...a.revisions.flatMap(r=>[...assetRefs(r.markdown),...(r.stickers||[]).map(s=>s.assetId)])]));
  const assetList:Omit<Asset,'data'>[]=[];
  for(const id of ids){const asset=assets.get(id);if(!asset)continue;const {data,...rest}=asset;assetList.push(rest);files[`assets/${id}.${extension(asset.mime)}`]=bytesFromData(data);}
  const themeLibrary=all?themeLibraryDocument():libraryDocument(themesForArticles(articles),[]);
  const manifest={format:'paper-studio',version:1,exportedAt:Date.now(),articles,assets:assetList,folders:[...new Set([...folders,...articles.map(a=>a.folder).filter(Boolean)])],themeLibrary};
  files['manifest.json']=strToU8(JSON.stringify(manifest,null,2));
  for(const a of articles){
    const lines=a.markdown.split('\n');
    for(const s of [...(a.stickers||[])].sort((x,y)=>y.line-x.line)){
      const asset=assets.get(s.assetId);if(asset)lines.splice(Math.min(s.line,lines.length),0,`![${(asset.alt||asset.name).replace(/[\[\]\\\r\n]/g,'')}](asset:${s.assetId})`,'');
    }
    files[`articles/${safeName(a.title)}-${a.id.slice(0,8)}.md`]=strToU8(lines.join('\n').replace(/asset:([a-zA-Z0-9-]+)/g,(_m,id)=>`../assets/${id}.${extension(assets.get(id)?.mime||'image/png')}`));
  }
  return zipSync(files,{level:6});
}
function validTypography(t:any):Typography{
  if(!t||typeof t!=='object')return {};
  const out:Typography={};
  if(typeof t.font==='string'&&Object.hasOwn(fontStacks,t.font))out.font=t.font;
  if(typeof t.headingFont==='string'&&Object.hasOwn(fontStacks,t.headingFont))out.headingFont=t.headingFont;
  for(const [key,min,max] of [['size',12,24],['lineHeight',1.3,2.8],['paragraphGap',0,40],['padding',12,48]] as const)if(Number.isFinite(t[key]))out[key]=Math.min(max,Math.max(min,t[key]));
  if(/^#[a-f\d]{6}$/i.test(t.accent))out.accent=t.accent;
  if(typeof t.indent==='boolean')out.indent=t.indent;
  if(['theme','three-line','striped','grid'].includes(t.tableStyle))out.tableStyle=t.tableStyle;
  if(t.elements!==undefined)out.elements=validateElements(t.elements,'文章元素样式');
  return out;
}
export function readBackup(buffer:Uint8Array):{articles:Article[];assets:Asset[];folders:string[];themes:ThemeDefinition[];hiddenThemes:string[]}{
  if(buffer.length>100*1024*1024)throw new Error('备份超过 100 MB，请拆分为单篇备份');
  let total=0;
  const entries=unzipSync(buffer,{filter:file=>{total+=file.originalSize;if(total>200*1024*1024)throw new Error('解压后超过 200 MB，已停止导入');return true;}});
  if(!entries['manifest.json'])throw new Error('这不是本工具导出的文章备份，请导入 .md 或带 manifest.json 的 ZIP');
  const m=JSON.parse(strFromU8(entries['manifest.json']));
  if(m.format!=='paper-studio'||m.version!==1||!Array.isArray(m.articles)||!Array.isArray(m.assets)||m.articles.length>1000||m.assets.length>5000)throw new Error('备份格式或版本不支持');
  const themeLibrary=m.themeLibrary===undefined?{themes:[],hidden:[]}:parseThemeFile(JSON.stringify(m.themeLibrary),builtInIds);
  const knownThemes=new Set([...themes.map(t=>t.id),...themeLibrary.themes.map(t=>t.id)]);
  const checkedTheme=(id:unknown)=>{if(typeof id==='string'&&knownThemes.has(id))return id;if(typeof id==='string'&&id.startsWith('custom-'))throw new Error('备份缺少自定义主题定义：'+id);return builtInIds[0];};
  const validFolder=(name:unknown)=>typeof name==='string'&&name.length>0&&name.length<=40&&name!=='*'&&!/[\\/\r\n]/.test(name);
  if(m.folders!==undefined&&(!Array.isArray(m.folders)||m.folders.length>500||!m.folders.every(validFolder)))throw new Error('备份文件夹信息无效');
  const folders:string[]=[...new Set<string>(m.folders||[])];
  const mapping=new Map<string,string>();const assetOutput:Asset[]=[];
  for(const a of m.assets){
    if(!a||!/^[-a-z\d]+$/i.test(a.id)||!['image/png','image/jpeg','image/gif','image/webp'].includes(a.mime))throw new Error('备份包含无效图片');
    if(mapping.has(a.id))throw new Error('备份图片编号重复');
    const bytes=entries[`assets/${a.id}.${extension(a.mime)}`];if(!bytes)throw new Error(`备份缺少图片：${String(a.name).slice(0,80)}`);
    const id=uid();mapping.set(a.id,id);
    assetOutput.push({id,name:String(a.name||'图片'),mime:a.mime,data:dataFromBytes(bytes,a.mime),width:Math.max(10,Math.min(100,Number(a.width)||100)),align:['left','right'].includes(a.align)?a.align:'center',alt:String(a.alt||''),caption:String(a.caption||''),figureLabel:String(a.figureLabel||''),source:String(a.source||'')});
  }
  const rewrite=(s:string)=>s.replace(/asset:([a-zA-Z0-9-]+)/g,(_m,id)=>`asset:${mapping.get(id)||id}`);
  const appearanceImport=(settings:any):AssetSettings=>{
    if(settings===undefined)return {};
    if(!settings||typeof settings!=='object'||Array.isArray(settings)||Object.keys(settings).length>5000)throw new Error('图片排版设置无效');
    const output:AssetSettings={};
    for(const [oldId,value] of Object.entries(settings)){
      const id=mapping.get(oldId);if(!id)continue; // Unreferenced originals are not included in a single-article archive.
      const a=value as any;
      if(!a||!Number.isFinite(a.width)||a.width<10||a.width>100||!['left','center','right'].includes(a.align)||typeof a.alt!=='string'||typeof a.caption!=='string'||(a.figureLabel!==undefined&&typeof a.figureLabel!=='string')||(a.source!==undefined&&typeof a.source!=='string'))throw new Error('图片排版设置损坏');
      output[id]={width:a.width,align:a.align,alt:a.alt,caption:a.caption,figureLabel:a.figureLabel||'',source:a.source||''};
    }
    return output;
  };
  const stickerImport=(items:any):Sticker[]=>{
    if(!Array.isArray(items))return [];
    if(items.length>200)throw new Error('单篇文章的贴纸数量超过 200');
    return items.map(s=>{
      if(!s||!mapping.has(s.assetId)||![s.line,s.x,s.offsetY,s.width,s.rotation].every(Number.isFinite))throw new Error('贴纸数据损坏或图片缺失');
      return {id:uid(),assetId:mapping.get(s.assetId)!,line:Math.max(0,Math.floor(s.line)),x:Math.max(0,Math.min(.9,s.x)),offsetY:Math.max(-1000,Math.min(3000,s.offsetY)),width:Math.max(.08,Math.min(.85,s.width)),rotation:Math.max(-180,Math.min(180,s.rotation)),layout:['wrap-left','wrap-right'].includes(s.layout)?s.layout:'free'};
    });
  };
  const articleOutput:Article[]=m.articles.map((a:any)=>{
    if(!a||a.version!==1||typeof a.markdown!=='string'||a.markdown.length>5000000||typeof a.title!=='string')throw new Error('备份包含无效文章');
    const markdown=rewrite(a.markdown);
    if(a.folder!==undefined&&a.folder!==''&&!validFolder(a.folder))throw new Error('文章文件夹无效');
    if(a.folder&&!folders.includes(a.folder))folders.push(a.folder);
    if(a.linkMode!==undefined&&!['direct','end'].includes(a.linkMode))throw new Error('文章链接设置无效');
    const stickers=stickerImport(a.stickers);
    return {version:1,id:uid(),title:a.title,titleMode:a.titleMode==='auto'?'auto':'manual',markdown,folder:a.folder||undefined,theme:checkedTheme(a.theme),typography:validTypography(a.typography),assets:[...new Set([...assetRefs(markdown),...stickers.map(s=>s.assetId)])],stickers,assetSettings:appearanceImport(a.assetSettings),linkMode:a.linkMode,created:Number(a.created)||Date.now(),updated:Date.now(),deleted:!!a.deleted,
      revisions:(Array.isArray(a.revisions)?a.revisions:[]).slice(-20).map((r:any)=>{
        if(typeof r.markdown!=='string')throw new Error('恢复版本损坏');
        if(r.linkMode!==undefined&&!['direct','end'].includes(r.linkMode))throw new Error('恢复版本链接设置无效');
        const text=rewrite(r.markdown),stickers=stickerImport(r.stickers);return {at:Number(r.at)||Date.now(),title:String(r.title||a.title),titleMode:r.titleMode==='auto'?'auto':'manual',markdown:text,theme:checkedTheme(r.theme),typography:validTypography(r.typography),assets:[...new Set([...assetRefs(text),...stickers.map(s=>s.assetId)])],stickers,assetSettings:appearanceImport(r.assetSettings),linkMode:r.linkMode};
      })};
  });
  return {articles:articleOutput,assets:assetOutput,folders,themes:themeLibrary.themes,hiddenThemes:themeLibrary.hidden};
}
export async function fileToAsset(file:File):Promise<Asset>{
  if(!['image/png','image/jpeg','image/gif','image/webp'].includes(file.type))throw new Error('支持 PNG、JPEG、GIF、WebP 图片；其他格式请先转换');
  if(file.size>30*1024*1024)throw new Error('单张图片请小于 30 MB');
  const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error);r.readAsDataURL(file);});
  await new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve();image.onerror=()=>reject(new Error('图片文件无法解码'));image.src=data;});
  return {id:uid(),name:file.name||'粘贴的图片.png',mime:file.type,data,width:100,align:'center',alt:'',caption:''};
}
export async function svgToPNG(svg:SVGElement,scale=3):Promise<Blob>{
  const clone=svg.cloneNode(true) as SVGElement;
  const viewBox=(svg.getAttribute('viewBox')||'').split(/[ ,]+/).map(Number);
  const box=svg.getBoundingClientRect();let width=box.width||320,height=box.height||80;
  if(viewBox.length===4&&viewBox[2]>0&&viewBox[3]>0){height=width*viewBox[3]/viewBox[2];}
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',String(width));clone.setAttribute('height',String(height));clone.style.color='#1f2937';
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));
  try{
    const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('公式图片转换失败'));img.src=url;});
    const canvas=document.createElement('canvas');canvas.width=Math.min(8192,Math.ceil(width*scale));canvas.height=Math.min(8192,Math.ceil(height*scale));const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG 导出失败')),'image/png'));
  }finally{URL.revokeObjectURL(url);}
}
