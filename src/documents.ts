import {Document,Packer,Paragraph,TextRun,ImageRun,Table,TableRow,TableCell,HeadingLevel,WidthType,AlignmentType,BorderStyle,ExternalHyperlink,LevelFormat,VerticalAlign,UnderlineType,type ParagraphChild,type IRunOptions,type INumberingOptions} from 'docx';
import {renderMarkdown,exportFragment} from './render';
import {bytesFromData,svgToPNG} from './files';
import {escapeHTML as esc,type Article,type Asset} from './model';
import {publicationHTML} from './stickers';
import {inlineFonts} from './inline-style';
import {flattenJournalBlocks} from './journal-blocks';
import {flattenFolioBlocks} from './folio-blocks';
import {flattenEditionBlocks} from './edition-blocks';

export function standardCSS(selector='.article'){
  return `${selector}{box-sizing:border-box;background:#fff;color:#222;font:16px/1.75 "Microsoft YaHei","PingFang SC",sans-serif;padding:24px;overflow-wrap:anywhere;text-align:left;display:flow-root}
  ${selector} h1,${selector} h2,${selector} h3,${selector} h4,${selector} h5,${selector} h6{color:#111;font-weight:700;line-height:1.45;margin:1.4em 0 .7em;padding:0;border:0;background:none;clear:both}
  ${selector} h1{font-size:28px;margin-top:0}${selector} h2{font-size:22px}${selector} h3{font-size:19px}${selector} h4,${selector} h5,${selector} h6{font-size:17px}
  ${selector} p{margin:0 0 1em;text-indent:0}${selector} strong{color:inherit;font-weight:700}${selector} em{font-style:italic}${selector} a{color:#245b91;text-decoration:underline}${selector} .journal-subtitle{display:block;color:#666;font-size:12px;line-height:1.6;margin:0 0 1em}
  ${selector} blockquote{margin:1em 0;padding:0 1em;border:0;border-left:3px solid #ccc;color:#555;background:none}${selector} blockquote p:last-child{margin-bottom:0}
  ${selector} ul,${selector} ol{padding-left:1.8em;margin:1em 0}${selector} li{margin:.4em 0}${selector} li p{margin:.3em 0}
  ${selector} table{width:100%;border-collapse:collapse;table-layout:fixed;margin:1em 0;clear:both}${selector} td,${selector} th{border:1px solid #d9d9d9;padding:9px;word-break:break-word}${selector} th{background:#f2f2f2;text-align:left}
  ${selector} pre{font:13px/1.6 Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f5f5;color:#222;padding:14px;margin:1em 0;clear:both}${selector} code{font-family:Consolas,monospace;font-size:.9em}${selector} pre code{font-size:inherit}
  ${selector} img{max-width:100%;height:auto}${selector} .image-wrap{display:block;margin:1em 0;text-indent:0}${selector} .image-caption{display:block;color:#666;font-size:12px;line-height:1.7;margin-top:8px}${selector} .image-source{display:block;color:#777;font-size:11px;line-height:1.7;margin-top:4px}
  ${selector} hr{border:0;border-top:1px solid #ddd;margin:1.5em 0;clear:both}${selector} .poem{white-space:pre-wrap;line-height:2;margin:1.5em 0;text-align:left}${selector} .poem[data-align=center]{text-align:center}
  ${selector} .math-inline{display:inline-block;vertical-align:middle;max-width:100%}${selector} .math-display{text-align:center;margin:1em 0;padding:10px 0;clear:both;overflow-x:auto}${selector} svg{max-width:100%;height:auto;vertical-align:middle}${selector} mjx-container{display:inline-block;margin:0!important;max-width:100%}
  ${selector} .footnotes{font-size:12px;border-top:1px solid #ddd;margin-top:2em;padding-top:12px;color:#666}${selector} .math-error,${selector} .missing-image{color:#9b3838;background:#fff0ed;padding:8px}`;
}
export function standardBody(article:Article,assets:Map<string,Asset>,rendered?:string){
  const node=document.createElement('div');node.innerHTML=rendered??renderMarkdown(article.markdown,assets).html;
  flattenJournalBlocks(node);
  flattenFolioBlocks(node);
  flattenEditionBlocks(node);
  node.querySelectorAll('.decorative-divider').forEach(el=>el.replaceWith(document.createElement('hr')));
  node.querySelectorAll('.image-gallery').forEach(group=>{
    const fragment=document.createDocumentFragment();group.querySelectorAll('.image-wrap,.missing-image').forEach(image=>{const p=document.createElement('p');p.append(image);fragment.append(p);});group.replaceWith(fragment);
  });
  const original=[...node.children] as HTMLElement[];
  for(const sticker of article.stickers||[]){
    const asset=assets.get(sticker.assetId);if(!asset)continue;
    const image=document.createElement('section');image.className='image-wrap';image.dataset.line=String(sticker.line);image.dataset.asset=asset.id;image.dataset.source='asset:'+asset.id;image.style.textAlign='center';
    image.innerHTML=`<img src="${esc(asset.data)}" alt="${esc(asset.alt||asset.name)}" style="width:${Math.round(sticker.width*100)}%;max-width:320px;height:auto">${asset.caption?`<span class="image-caption">${esc(asset.caption)}</span>`:''}`;
    const anchor=original.find(el=>Number(el.dataset.line)>=sticker.line);if(anchor)node.insertBefore(image,anchor);else node.append(image);
  }
  return node.innerHTML;
}
function mountStandard(article:Article,assets:Map<string,Asset>){
  const host=document.createElement('div');host.style.cssText='position:fixed;left:-20000px;top:0;width:650px;pointer-events:none;';
  const style=document.createElement('style');style.textContent=standardCSS('.standard-document');host.append(style);
  const content=document.createElement('article');content.className='standard-document';content.innerHTML=standardBody(article,assets);host.append(content);document.body.append(host);return {host,content};
}
export async function standardFragment(article:Article,assets:Map<string,Asset>){const {host,content}=mountStandard(article,assets);try{await Promise.all([...content.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));return exportFragment(content);}finally{host.remove();}}

async function rasterImage(img:HTMLImageElement,maxWidth=570):Promise<ImageRun>{
  if(!img.src.startsWith('data:image/'))throw new Error('请先将网络图片导入本地，再导出 Word');
  await img.decode();const width=Math.min(maxWidth,img.naturalWidth),height=width*img.naturalHeight/img.naturalWidth;
  const maxHeight=720,scale=Math.min(1,maxHeight/height);
  let data:Uint8Array,type:'png'|'jpg'='png';
  if(img.src.startsWith('data:image/png'))data=bytesFromData(img.src);
  else if(img.src.startsWith('data:image/jpeg')){data=bytesFromData(img.src);type='jpg';}
  else {const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d')!.drawImage(img,0,0);data=bytesFromData(canvas.toDataURL('image/png'));}
  return new ImageRun({type,data,transformation:{width:Math.round(width*scale),height:Math.round(height*scale)},altText:{title:img.alt||'插图',description:img.alt||'文章插图',name:'图片'}});
}
export async function createWord(article:Article,assets:Map<string,Asset>):Promise<Blob>{
  const {host,content}=mountStandard(article,assets);
  const numbering:INumberingOptions['config'][number][]=[];let listSequence=0;
  try{
    const inline=async(node:Node,format:IRunOptions={}):Promise<ParagraphChild[]>=>{
      if(node.nodeType===Node.TEXT_NODE)return node.textContent?[new TextRun({...format,text:node.textContent})]:[];
      if(!(node instanceof HTMLElement)&&!(node instanceof SVGElement))return [];
      if(node instanceof SVGElement)return [];
      if(node.matches('.footnote-backref'))return [];
      if(node.matches('.math-inline,.math-display')){
        const svg=node.querySelector('svg');if(!svg)return [new TextRun(node.textContent||'公式错误')];
        const box=svg.getBoundingClientRect(),blob=await svgToPNG(svg);const width=Math.min(570,box.width||180),height=(box.height||30)*width/(box.width||180);
        return [new ImageRun({type:'png',data:new Uint8Array(await blob.arrayBuffer()),transformation:{width:Math.round(width),height:Math.round(height)},altText:{title:'数学公式',description:node.dataset.tex||'',name:'公式'}})];
      }
      if(node.tagName==='IMG')return [await rasterImage(node as HTMLImageElement)];
      if(node.tagName==='BR')return [new TextRun({...format,break:1})];
      const next={...format};if(node.tagName==='STRONG')next.bold=true;if(node.tagName==='EM')next.italics=true;if(node.tagName==='CODE'){next.font='Consolas';next.size=21;}if(node.tagName==='S')next.strike=true;if(node.tagName==='SUP')next.superScript=true;
      if(node.classList.contains('inline-style')){
        const font=inlineFonts[node.dataset.inlineFont||''];if(font)next.font={ascii:font.word,hAnsi:font.word,eastAsia:font.word};
        if(node.style.fontSize)next.size=Math.round(Number.parseFloat(node.style.fontSize)*1.5);
        const color=node.style.color.match(/\d+/g);if(color?.length===3)next.color=color.map(n=>Number(n).toString(16).padStart(2,'0')).join('');
        const background=node.style.backgroundColor.match(/\d+/g);if(background?.length===3)next.shading={fill:background.map(n=>Number(n).toString(16).padStart(2,'0')).join('')};
        // Word cannot express partial-height gradients; retain the chosen ink
        // as editable text shading when no full highlight overrides it.
        else if(/^#[\da-f]{6}$/i.test(node.dataset.inlineMarker||''))next.shading={fill:node.dataset.inlineMarker!.slice(1)};
        if(node.style.fontWeight==='700')next.bold=true;if(node.style.fontStyle==='italic')next.italics=true;
        if(node.dataset.inlineUnderline)next.underline={type:node.dataset.inlineUnderline==='wave'?UnderlineType.WAVE:UnderlineType.SINGLE};
        if(node.dataset.inlineStrike)next.strike=true;
      }
      const children:ParagraphChild[]=[];for(const child of node.childNodes)children.push(...await inline(child,next));
      if(node.tagName==='A'&&/^https?:\/\//.test(node.getAttribute('href')||''))return [new ExternalHyperlink({link:node.getAttribute('href')!,children})];
      return children;
    };
    const blocks=async(nodes:Iterable<Element>,quote=false,depth=0):Promise<(Paragraph|Table)[]>=>{
      const output:(Paragraph|Table)[]=[];
      for(const node of nodes){
        if(!(node instanceof HTMLElement))continue;
        const tag=node.tagName;
        if(/^H[1-6]$/.test(tag)){const headings=[HeadingLevel.HEADING_1,HeadingLevel.HEADING_2,HeadingLevel.HEADING_3,HeadingLevel.HEADING_4,HeadingLevel.HEADING_5,HeadingLevel.HEADING_6];output.push(new Paragraph({children:await inline(node),heading:headings[Number(tag[1])-1],keepNext:true,spacing:{before:260,after:160}}));}
        else if(tag==='TABLE'){
          const rows:TableRow[]=[];
          for(const row of node.querySelectorAll('tr')){const cells:TableCell[]=[];for(const cell of row.children)cells.push(new TableCell({children:[new Paragraph({children:await inline(cell),spacing:{after:60,before:60}})],verticalAlign:VerticalAlign.CENTER,shading:cell.tagName==='TH'?{fill:'EFEFEF'}:undefined,margins:{top:90,bottom:90,left:110,right:110}}));rows.push(new TableRow({children:cells,tableHeader:!!row.querySelector('th')}));}
          const border={style:BorderStyle.SINGLE,size:4,color:'D9D9D9'};output.push(new Table({rows,width:{size:100,type:WidthType.PERCENTAGE},borders:{top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border}}));output.push(new Paragraph({spacing:{after:100}}));
        }else if(tag==='UL'||tag==='OL'){
          const reference='list-'+(++listSequence);if(tag==='OL')numbering.push({reference,levels:Array.from({length:9},(_,i)=>({level:i,format:LevelFormat.DECIMAL,text:`%${i+1}.`,alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:720*(i+1),hanging:360}}}}))});
          for(const li of [...node.children].filter(el=>el.tagName==='LI')){
            const parts:ParagraphChild[]=[];for(const child of li.childNodes){if(child instanceof HTMLElement&&['UL','OL'].includes(child.tagName))continue;parts.push(...await inline(child));}
            output.push(new Paragraph({children:parts,...(tag==='UL'?{bullet:{level:Math.min(8,depth)}}:{numbering:{reference,level:Math.min(8,depth)}}),spacing:{after:110}}));
            const nested=[...li.children].filter(el=>['UL','OL'].includes(el.tagName));if(nested.length)output.push(...await blocks(nested,quote,depth+1));
          }
        }else if(tag==='BLOCKQUOTE')output.push(...await blocks(node.children,true,depth));
        else if(node.classList.contains('footnotes'))output.push(...await blocks(node.children,false,depth));
        else if(tag==='PRE'){
          const lines=(node.textContent||'').replace(/\n$/,'').split('\n');for(const line of lines)output.push(new Paragraph({children:[new TextRun({text:line,font:'Consolas',size:20})],spacing:{after:0,line:270},shading:{fill:'F5F5F5'}}));output.push(new Paragraph({spacing:{after:100}}));
        }else if(node.classList.contains('poem')){
          const runs:ParagraphChild[]=[];for(const [i,line] of [...node.querySelectorAll(':scope > .poem-line')].entries()){if(i)runs.push(new TextRun({break:1}));runs.push(...await inline(line));}output.push(new Paragraph({children:runs,alignment:node.dataset.align==='center'?AlignmentType.CENTER:AlignmentType.LEFT,spacing:{after:200,line:380}}));
        }else if(tag==='HR')output.push(new Paragraph({text:'',spacing:{before:120,after:120},border:{bottom:{style:BorderStyle.SINGLE,size:4,color:'DDDDDD'}}}));
        else if(node.matches('.math-display'))output.push(new Paragraph({children:await inline(node),alignment:AlignmentType.CENTER,spacing:{before:180,after:180}}));
        else {const children=await inline(node);if(children.length)output.push(new Paragraph({children,alignment:node.querySelector('img')?AlignmentType.CENTER:AlignmentType.LEFT,indent:quote?{left:360}:undefined,spacing:{after:180,line:330}}));}
      }
      return output;
    };
    const children=await blocks(content.children);
    const doc=new Document({creator:'纸间',title:article.title,description:'Markdown 标准文档',styles:{default:{document:{run:{font:{ascii:'Calibri',eastAsia:'宋体',hAnsi:'Calibri'},size:24,color:'222222'},paragraph:{spacing:{after:180,line:330}}},heading1:{run:{font:'Microsoft YaHei',size:36,bold:true,color:'000000'}},heading2:{run:{font:'Microsoft YaHei',size:30,bold:true,color:'000000'}},heading3:{run:{font:'Microsoft YaHei',size:26,bold:true,color:'000000'}}}},numbering:{config:numbering},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,bottom:1134,left:1134,right:1134}}},children}]});
    return await Packer.toBlob(doc);
  }finally{host.remove();}
}

export async function preparePrintWindow(popup:Window,article:Article,assets:Map<string,Asset>,preview:HTMLElement,mode:'standard'|'theme'){
  const html=mode==='standard'?await standardFragment(article,assets):await publicationHTML(preview,'image');
  const width=mode==='theme'&&article.stickers?.length?`${preview.clientWidth}px`:'100%';
  popup.document.open();popup.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(article.title)}</title><style>@page{size:A4;margin:18mm}body{margin:0;background:white;color:#222}.print-controls{position:sticky;top:0;background:#f0f3ed;padding:14px;font:13px/1.7 sans-serif;border-bottom:1px solid #d7dfd1}.print-controls button{padding:7px 14px;margin-right:12px;cursor:pointer}.print-content{width:${width};max-width:100%;margin:20px auto}h1,h2,h3,h4{break-after:avoid}p{orphans:3;widows:3}img,svg{max-width:100%;height:auto}img,table tr,.math-display,.poem{break-inside:avoid}pre{white-space:pre-wrap;overflow-wrap:anywhere}thead{display:table-header-group}@media print{.print-controls{display:none}.print-content{margin:0 auto}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="print-controls"><button id="print-now">打印 / 另存为 PDF</button>目标选择“另存为 PDF”。建议 A4，关闭页眉页脚${mode==='theme'?'，开启背景图形':''}。</div><main class="print-content">${html}</main></body></html>`);popup.document.close();
  await Promise.all([...popup.document.images].map(img=>img.decode().catch(()=>{})));
  popup.document.getElementById('print-now')!.addEventListener('click',()=>popup.print());
}
