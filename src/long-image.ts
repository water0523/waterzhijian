import {toCanvas} from 'html-to-image';
import {zipSync,strToU8} from 'fflate';
import {exportFragment} from './render';

export async function createLongImage(preview:HTMLElement,scale:number,signal:AbortSignal,progress:(message:string)=>void){
  const check=()=>{if(signal.aborted)throw new DOMException('已取消长图导出','AbortError');};
  const width=Math.round(preview.getBoundingClientRect().width);
  if(!width)throw new Error('请先切换到预览标签页，再导出长图。');
  const host=document.createElement('div');host.style.cssText='position:fixed;left:-20000px;top:0;pointer-events:none;z-index:-10;';
  const viewport=document.createElement('div');viewport.style.cssText=`position:relative;overflow:hidden;width:${width}px;margin:0;padding:0;`;
  viewport.innerHTML=exportFragment(preview);const content=viewport.firstElementChild as HTMLElement;
  content.style.cssText+=`;position:relative;left:0;top:0;width:${width}px;max-width:none;min-height:0;margin:0;box-shadow:none;filter:none;`;
  viewport.style.background=getComputedStyle(preview).backgroundColor;
  host.append(viewport);document.body.append(host);
  try{
    progress('正在准备图片、公式与字体…');await document.fonts.ready;await Promise.all([...content.querySelectorAll('img')].map(img=>img.decode()));check();
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    const height=Math.ceil(Math.max(content.getBoundingClientRect().height,content.scrollHeight));
    // Bound both canvas dimensions and memory; do not let the library silently
    // downscale or truncate an oversized canvas.
    const limit=Math.floor(Math.min(16000/scale,24000000/(width*scale*scale)));
    if(limit<300||Math.ceil(height/limit)>50)throw new Error('文章过长或清晰度过高，请降低清晰度，或改为导出 PDF。');
    const top=content.getBoundingClientRect().top;
    const boundaries=[...content.querySelectorAll('p,li,tr,.math-display,.poem,img,h1,h2,h3')].map(el=>Math.ceil(el.getBoundingClientRect().bottom-top)).sort((a,b)=>a-b);
    const parts:{start:number;end:number}[]=[];let start=0;
    while(start<height){let end=Math.min(height,start+limit);if(end<height){const candidates=boundaries.filter(y=>y>start+limit*.65&&y<=end);if(candidates.length)end=candidates.at(-1)!;}parts.push({start,end});start=end;}
    const output:Record<string,Uint8Array>={};let single:Blob|null=null;
    const images:{blob:Blob;name:string;width:number;height:number}[]=[];
    for(const [i,part] of parts.entries()){
      check();progress(`正在生成 ${i+1} / ${parts.length} 张${parts.length>1?'分段':''}长图…`);
      const tileHeight=part.end-part.start;viewport.style.height=tileHeight+'px';content.style.top=-part.start+'px';
      const canvas=await toCanvas(viewport,{width,height:tileHeight,pixelRatio:scale,skipFonts:true,skipAutoScale:true,backgroundColor:viewport.style.background,cacheBust:false});
      let blob:Blob|null;
      try{check();blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));}finally{canvas.width=1;canvas.height=1;}
      if(!blob||!blob.size)throw new Error('浏览器没有生成有效图片，请降低清晰度后重试。');
      images.push({blob,name:`长图-${String(i+1).padStart(2,'0')}.png`,width:width*scale,height:tileHeight*scale});
      if(parts.length===1)single=blob;else output[`长图-${String(i+1).padStart(2,'0')}.png`]=new Uint8Array(await blob.arrayBuffer());
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    check();
    if(single)return {blob:single,parts:1,width:width*scale,height:height*scale,images};
    output['阅读顺序.txt']=strToU8(`文章超过单张画布的安全尺寸，已按顺序拆成 ${parts.length} 张 PNG。\n按文件编号从上到下阅读，所有分段覆盖全文，不丢弃内容。通常在段落或表格行边界分段；超大单段可能跨图。\n原排版宽度：${width}px；清晰度：${scale} 倍；完整高度：${height}px。\n`);
    return {blob:new Blob([zipSync(output,{level:3}) as BlobPart],{type:'application/zip'}),parts:parts.length,width:width*scale,height:height*scale,images};
  }finally{host.remove();}
}
