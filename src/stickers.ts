import {toPng} from 'html-to-image';
import {uid,escapeHTML as esc,type Article,type Asset,type Sticker} from './model';
import {exportFragment} from './render';

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function updateStickerLines(stickers:Sticker[]|undefined,before:string,after:string){
  if(!stickers?.length)return;
  const old=before.split('\n'),next=after.split('\n');let prefix=0,suffix=0;
  while(prefix<old.length&&prefix<next.length&&old[prefix]===next[prefix])prefix++;
  while(suffix<old.length-prefix&&suffix<next.length-prefix&&old[old.length-1-suffix]===next[next.length-1-suffix])suffix++;
  for(const s of stickers){if(s.line>=old.length-suffix)s.line=Math.max(0,s.line+next.length-old.length);else if(s.line>=prefix)s.line=Math.min(s.line,next.length-suffix-1);s.line=Math.max(0,s.line);}
}

export class StickerController {
  private enabled=true;
  setEnabled(value:boolean){this.enabled=value;if(!value){this.toolbar.hidden=true;this.selected=null;}}
  selected:string|null=null;private selectedImage:string|null=null;private imageNode:HTMLElement|undefined;private wrapDrop:{line:number;layout:'wrap-left'|'wrap-right'}|null=null;
  private toolbar:HTMLElement;private drag:{id:string;clientX:number;clientY:number;x:number;top:number;resize:boolean;width:number;scroll:number}|null=null;
  constructor(private node:HTMLElement,private getArticle:()=>Article,private assets:Map<string,Asset>,private change:()=>void,private convert:(assetId:string,node?:HTMLElement)=>void,private restore:(id:string)=>void,private exportRegion:()=>void){
    node.style.position='relative';node.style.display='flow-root';
    this.toolbar=document.createElement('div');this.toolbar.className='sticker-toolbar';this.toolbar.hidden=true;node.closest('.preview-pane')!.append(this.toolbar);
    node.addEventListener('click',event=>{
      if(!this.enabled)return;
      const image=(event.target as HTMLElement).closest<HTMLElement>('.image-wrap[data-asset]');
      if(image?.dataset.asset){this.selected=null;this.selectedImage=image.dataset.asset;this.imageNode=image;this.showImageTools();}
      else if(!(event.target as HTMLElement).closest('.sticker-item')){this.selected=null;this.selectedImage=null;this.toolbar.hidden=true;this.drawSelection();}
    });
  }
  private contentBox(){const rect=this.node.getBoundingClientRect(),style=getComputedStyle(this.node),padding=parseFloat(style.paddingLeft);return {rect,padding,width:this.node.clientWidth-padding-parseFloat(style.paddingRight)};}
  private anchors(){return [...this.node.querySelectorAll<HTMLElement>('[data-line]')].filter(el=>!el.classList.contains('math-inline')&&!el.closest('.footnotes')).map(el=>({line:Number(el.dataset.line),top:el.getBoundingClientRect().top-this.node.getBoundingClientRect().top}));}
  private position(sticker:Sticker){const anchors=this.anchors();let anchor=anchors.find(a=>a.line===sticker.line);if(!anchor)anchor=anchors.reduce<{line:number;top:number}|undefined>((best,a)=>!best||Math.abs(a.line-sticker.line)<Math.abs(best.line-sticker.line)?a:best,undefined);return (anchor?.top||24)+sticker.offsetY;}
  anchorFor(top:number){const list=this.anchors().sort((a,b)=>a.top-b.top);return [...list].reverse().find(a=>a.top<=top)||list[0]||{line:0,top:24};}
  make(assetId:string,line=0):Sticker{return {id:uid(),assetId,line,x:.58,offsetY:0,width:.35,rotation:0,layout:'wrap-right'};}
  private anchorElement(s:Sticker){
    const blocks=[...this.node.children].filter(el=>!el.classList.contains('sticker-layer')&&!el.classList.contains('sticker-item')&&el.hasAttribute('data-line')) as HTMLElement[];
    const selected=blocks.reduce<HTMLElement|undefined>((best,el)=>!best||Math.abs(Number(el.dataset.line)-s.line)<Math.abs(Number(best.dataset.line)-s.line)?el:best,undefined);
    if(selected&&/^H[1-6]$/.test(selected.tagName))return selected.nextElementSibling||selected;
    return selected||this.node.firstElementChild;
  }
  render(){
    this.node.querySelector('.sticker-layer')?.remove();
    this.node.querySelectorAll('.sticker-item').forEach(el=>el.remove());
    const layer=document.createElement('div');layer.className='sticker-layer';layer.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:1;';
    const all=[...(this.getArticle().stickers||[])].sort((a,b)=>Number(!a.layout||a.layout==='free')-Number(!b.layout||b.layout==='free')||a.line-b.line);
    for(const sticker of all){
      const asset=this.assets.get(sticker.assetId);if(!asset)continue;
      const item=document.createElement('div');item.className='sticker-item';item.dataset.sticker=sticker.id;item.dataset.asset=sticker.assetId;item.setAttribute('role','button');item.tabIndex=0;item.setAttribute('aria-label','贴纸：'+(asset.alt||asset.name));
      item.innerHTML=`<img src="${esc(asset.data)}" alt="${esc(asset.alt||asset.name)}" draggable="false" style="display:block;width:100%;height:auto;pointer-events:none"><span class="sticker-handle" data-ui="true" title="拖动缩放"></span>`;
      item.style.cssText='position:absolute;pointer-events:auto;touch-action:none;cursor:grab;transform-origin:center;';
      if(sticker.layout?.startsWith('wrap')){const anchor=this.anchorElement(sticker);if(anchor)this.node.insertBefore(item,anchor);else this.node.append(item);}else layer.append(item);
      this.place(item,sticker);
      item.addEventListener('pointerdown',e=>{
        if(!this.enabled)return;
        if(e.button!==0)return;e.preventDefault();e.stopPropagation();this.selected=sticker.id;this.selectedImage=null;this.showStickerTools();this.drawSelection();
        const box=this.contentBox();this.wrapDrop=null;this.drag={id:sticker.id,clientX:e.clientX,clientY:e.clientY,x:sticker.x,top:item.getBoundingClientRect().top-box.rect.top,width:sticker.width,resize:(e.target as HTMLElement).classList.contains('sticker-handle'),scroll:this.node.parentElement!.scrollTop};item.setPointerCapture(e.pointerId);item.style.cursor='grabbing';
      });
      item.addEventListener('pointermove',e=>{
        if(!this.drag||this.drag.id!==sticker.id)return;
        const box=this.contentBox(),dy=e.clientY-this.drag.clientY+this.node.parentElement!.scrollTop-this.drag.scroll,dx=e.clientX-this.drag.clientX;
        if(sticker.layout?.startsWith('wrap')&&!this.drag.resize){
          const top=clamp(this.drag.top+dy,box.padding,this.node.clientHeight-box.padding);const anchor=this.anchorFor(top);this.wrapDrop={line:anchor.line,layout:e.clientX<box.rect.left+box.rect.width/2?'wrap-left':'wrap-right'};item.style.transform=`translate(${dx}px,${dy}px)`;item.style.opacity='.65';
          const scroller=this.node.parentElement!,bounds=scroller.getBoundingClientRect();if(e.clientY<bounds.top+35)scroller.scrollTop-=12;else if(e.clientY>bounds.bottom-35)scroller.scrollTop+=12;return;
        }
        if(this.drag.resize){sticker.width=clamp(this.drag.width+dx/box.width,.08,sticker.layout?.startsWith('wrap') ? .55 : .85);sticker.x=Math.min(sticker.x,1-sticker.width);}
        else {sticker.x=clamp(this.drag.x+dx/box.width,0,1-sticker.width);const top=clamp(this.drag.top+dy,box.padding,Math.max(box.padding,this.node.clientHeight-item.clientHeight-box.padding));const a=this.anchorFor(top);sticker.line=a.line;sticker.offsetY=top-a.top;}
        this.place(item,sticker);this.updateInputs();
        const scroller=this.node.parentElement!,bounds=scroller.getBoundingClientRect();if(e.clientY<bounds.top+35)scroller.scrollTop-=12;else if(e.clientY>bounds.bottom-35)scroller.scrollTop+=12;
      });
      const finish=()=>{if(this.drag?.id!==sticker.id)return;this.drag=null;item.style.cursor='grab';item.style.opacity='';if(this.wrapDrop){sticker.line=this.wrapDrop.line;sticker.layout=this.wrapDrop.layout;sticker.offsetY=0;this.wrapDrop=null;this.render();this.showStickerTools();}this.change();};item.addEventListener('pointerup',finish);item.addEventListener('pointercancel',finish);
      item.addEventListener('keydown',e=>{
        if(!this.enabled)return;
        if(e.key==='Enter'){this.selected=sticker.id;this.showStickerTools();this.drawSelection();return;}
        if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const step=e.shiftKey?10:2;if(e.key==='ArrowLeft'||e.key==='ArrowRight')sticker.x=clamp(sticker.x+(e.key==='ArrowRight'?step:-step)/this.contentBox().width,0,1-sticker.width);else sticker.offsetY+=e.key==='ArrowDown'?step:-step;this.place(item,sticker);this.change();}
      });
    }
    this.node.append(layer);this.drawSelection();
    if(this.selected&&!this.getArticle().stickers?.some(s=>s.id===this.selected)){this.selected=null;this.toolbar.hidden=true;}
  }
  private place(item:HTMLElement,s:Sticker){
    item.dataset.stickerLine=String(s.line);
    const box=this.contentBox();
    if(s.layout?.startsWith('wrap')){
      const side=s.layout==='wrap-left'?'left':'right',asset=this.assets.get(s.assetId)!;s.width=Math.min(.55,s.width);
      item.style.cssText=`position:relative;float:${side};width:${s.width*100}%;margin:${Math.max(0,s.offsetY)}px ${side==='left'?10:0}px 10px ${side==='right'?10:0}px;shape-outside:url("${asset.data}");shape-image-threshold:0.1;shape-margin:8px;pointer-events:auto;touch-action:none;cursor:grab;transform:none;`;
    }else {item.style.left=(box.padding+s.x*box.width)+'px';item.style.top=this.position(s)+'px';item.style.width=(s.width*box.width)+'px';item.style.transform=`rotate(${s.rotation}deg)`;}
  }
  reposition(){for(const s of this.getArticle().stickers||[]){const item=this.node.querySelector<HTMLElement>(`[data-sticker="${s.id}"]`);if(item)this.place(item,s);}}
  private drawSelection(){this.node.querySelectorAll<HTMLElement>('.sticker-item').forEach(el=>el.classList.toggle('selected',el.dataset.sticker===this.selected));}
  private showImageTools(){this.toolbar.hidden=false;this.toolbar.innerHTML='<span class="sticker-tool-label">已选中图片</span><button id="make-sticker" class="button primary">切换贴纸 / 文字环绕</button><button class="sticker-dismiss" aria-label="关闭图片工具">×</button>';this.toolbar.querySelector('#make-sticker')!.addEventListener('click',()=>{if(this.selectedImage)this.convert(this.selectedImage,this.imageNode);});this.bindClose();}
  select(id:string){this.selected=id;this.selectedImage=null;this.showStickerTools();this.drawSelection();}
  private bindClose(){this.toolbar.querySelector('.sticker-dismiss')!.addEventListener('click',()=>{this.selected=null;this.toolbar.hidden=true;this.drawSelection();});}
  private updateInputs(){const s=this.getArticle().stickers?.find(s=>s.id===this.selected);if(!s)return;const width=this.toolbar.querySelector<HTMLInputElement>('#sticker-size');if(width)width.value=String(Math.round(s.width*100));}
  private showStickerTools(){
    const s=this.getArticle().stickers?.find(s=>s.id===this.selected);if(!s)return;
    const wrapped=s.layout?.startsWith('wrap');
    this.toolbar.hidden=false;this.toolbar.innerHTML=`<div class="sticker-tool-row"><span class="sticker-tool-label">贴纸布局</span><select id="sticker-layout" aria-label="贴纸布局">${[['wrap-left','左侧 · 轮廓环绕'],['wrap-right','右侧 · 轮廓环绕'],['free','自由叠放']].map(([id,name])=>`<option value="${id}" ${id===(s.layout||'free')?'selected':''}>${name}</option>`).join('')}</select><button class="sticker-dismiss" aria-label="关闭贴纸工具">×</button></div><div class="sticker-tool-row"><label>大小 <input id="sticker-size" type="range" min="8" max="${wrapped?55:85}" value="${Math.round(s.width*100)}"></label><label>旋转 <input id="sticker-angle" type="number" min="-180" max="180" value="${wrapped?0:s.rotation}" ${wrapped?'disabled title="轮廓环绕时保持正向，切换自由叠放可旋转"':''}>°</label><button id="sticker-region">下载局部图</button><button id="sticker-restore">回到正文</button></div>`;
    const update=()=>{s.width=clamp(Number(this.toolbar.querySelector<HTMLInputElement>('#sticker-size')!.value)/100,.08,s.layout?.startsWith('wrap') ? .55 : .85);s.rotation=clamp(Number(this.toolbar.querySelector<HTMLInputElement>('#sticker-angle')!.value)||0,-180,180);s.x=clamp(s.x,0,1-s.width);this.reposition();this.change();};
    this.toolbar.querySelector('#sticker-layout')!.addEventListener('change',()=>{s.layout=(this.toolbar.querySelector('#sticker-layout') as HTMLSelectElement).value as Sticker['layout'];s.offsetY=0;this.render();this.showStickerTools();this.change();});
    this.toolbar.querySelector('#sticker-size')!.addEventListener('input',update);this.toolbar.querySelector('#sticker-angle')!.addEventListener('input',update);this.toolbar.querySelector('#sticker-restore')!.addEventListener('click',()=>this.restore(s.id));this.toolbar.querySelector('#sticker-region')!.addEventListener('click',this.exportRegion);this.bindClose();
  }
}

export interface Flattened {html:string;regions:{data:string;index:number}[]}
export async function flattenStickers(node:HTMLElement):Promise<Flattened>{
  const html=exportFragment(node);
  if(!node.querySelector('.sticker-item'))return {html,regions:[]};
  const root=document.createElement('div');root.innerHTML=html;const output=root.firstElementChild as HTMLElement;
  const originals=[...node.children].filter(el=>!el.classList.contains('sticker-layer')&&!el.classList.contains('sticker-item')) as HTMLElement[];
  const cloned=[...output.children].filter(el=>!el.classList.contains('sticker-layer')&&!el.classList.contains('sticker-item')) as HTMLElement[];
  const originalItems=[...node.querySelectorAll<HTMLElement>('.sticker-item')];
  const outputItems=[...output.querySelectorAll<HTMLElement>('.sticker-item')];
  const nodeRect=node.getBoundingClientRect(),padding=parseFloat(getComputedStyle(node).paddingLeft),contentWidth=node.clientWidth-padding-parseFloat(getComputedStyle(node).paddingRight);
  const groups:{start:number;end:number;stickers:number[]}[]=[];
  [...node.querySelectorAll<HTMLElement>('.sticker-item')].forEach((s,stickerIndex)=>{
    const box=s.getBoundingClientRect();let start=originals.findIndex(el=>el.getBoundingClientRect().bottom>=box.top);if(start<0)start=Math.max(0,originals.length-1);
    let end=start;while(end+1<originals.length&&originals[end+1].getBoundingClientRect().top<=box.bottom)end++;
    groups.push({start,end,stickers:[stickerIndex]});
  });
  groups.sort((a,b)=>a.start-b.start);
  for(let i=1;i<groups.length;){if(groups[i].start<=groups[i-1].end){groups[i-1].end=Math.max(groups[i-1].end,groups[i].end);groups[i-1].stickers.push(...groups[i].stickers);groups.splice(i,1);}else i++;}
  const regions:Flattened['regions']=[];
  for(const [index,group] of groups.entries()){
    const host=document.createElement('div');host.style.cssText=`position:fixed;left:-20000px;top:0;width:${contentWidth}px;pointer-events:none;z-index:-10;`;
    const region=output.cloneNode(false) as HTMLElement;region.style.cssText+=';position:relative;display:flow-root;margin:0;padding:0;min-height:0;width:100%;max-width:100%;box-shadow:none;';
    const regionNodes=new Map<number,HTMLElement>();
    for(let i=group.start;i<=group.end;i++){const copy=cloned[i].cloneNode(true) as HTMLElement;region.append(copy);regionNodes.set(i,copy);}
    for(const i of group.stickers){
      if(getComputedStyle(originalItems[i]).cssFloat==='none')continue;
      const item=outputItems[i].cloneNode(true) as HTMLElement;item.classList.remove('selected');item.querySelector('.sticker-handle')?.remove();
      let next=originalItems[i].nextElementSibling;while(next?.classList.contains('sticker-item'))next=next.nextElementSibling;
      const anchorIndex=originals.indexOf(next as HTMLElement);const target=regionNodes.get(anchorIndex)||region.firstElementChild;
      region.insertBefore(item,target);
    }
    host.append(region);document.body.append(host);
    try{
      await Promise.all([...region.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
      const first=regionNodes.get(group.start)!;
      const shift=originals[group.start].getBoundingClientRect().top-nodeRect.top-(first.getBoundingClientRect().top-region.getBoundingClientRect().top);
      for(const i of group.stickers){if(getComputedStyle(originalItems[i]).cssFloat!=='none')continue;const item=outputItems[i].cloneNode(true) as HTMLElement;item.classList.remove('selected');item.querySelector('.sticker-handle')?.remove();item.style.left=(parseFloat(item.style.left)-padding)+'px';item.style.top=(parseFloat(item.style.top)-shift)+'px';region.append(item);}
      const minHeight=Math.max(region.offsetHeight,...[...region.querySelectorAll<HTMLElement>('.sticker-item')].map(el=>el.offsetTop+el.offsetHeight));region.style.minHeight=minHeight+'px';
      const data=await toPng(region,{pixelRatio:2,skipFonts:true,cacheBust:false,backgroundColor:getComputedStyle(node).backgroundColor});
      const replacement=document.createElement('section');replacement.style.cssText='margin:0 0 20px;padding:0;text-indent:0;';replacement.dataset.stickerRegion=String(index+1);
      const img=document.createElement('img');img.src=data;img.alt='贴纸排版区域 '+(index+1);img.style.cssText='display:block;width:100%;height:auto;max-width:100%;';replacement.append(img);
      cloned[group.start].before(replacement);for(let i=group.start;i<=group.end;i++)cloned[i].remove();regions.push({data,index:index+1});
    }finally{host.remove();}
  }
  output.querySelector('.sticker-layer')?.remove();output.querySelectorAll('.sticker-item').forEach(el=>el.remove());return {html:output.outerHTML,regions};
}

export async function publicationHTML(node:HTMLElement,mode:'outline'|'rectangle'|'image'){
  const snapshotHost=document.createElement('div');snapshotHost.style.cssText=`position:fixed;left:-30000px;top:0;width:${node.offsetWidth}px;pointer-events:none`;snapshotHost.innerHTML=exportFragment(node);document.body.append(snapshotHost);node=snapshotHost.firstElementChild as HTMLElement;
  try{const hasFree=[...node.querySelectorAll<HTMLElement>('.sticker-item')].some(el=>getComputedStyle(el).cssFloat==='none');
  if(mode==='image'||hasFree)return (await flattenStickers(node)).html;
  const host=document.createElement('div');host.innerHTML=exportFragment(node);host.querySelector('.sticker-layer')?.remove();
  if(mode==='rectangle')host.querySelectorAll<HTMLElement>('.sticker-item').forEach(el=>{el.style.shapeOutside='none';el.style.shapeMargin='0';el.style.shapeImageThreshold='0';});
  return host.innerHTML;
  }finally{snapshotHost.remove();}
}
