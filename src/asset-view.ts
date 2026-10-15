import type {Article,Asset,AssetAppearance,AssetSettings} from './model';
import {assetRefs} from './files';
export function appearance(asset:Asset):AssetAppearance{
  return {width:asset.width,align:asset.align,alt:asset.alt,caption:asset.caption,figureLabel:asset.figureLabel||'',source:asset.source||''};
}
export function captureAssets(article:Pick<Article,'markdown'|'stickers'|'assetSettings'>,raw:Map<string,Asset>):AssetSettings{
  const settings:AssetSettings={};
  for(const id of new Set([...assetRefs(article.markdown),...(article.stickers||[]).map(s=>s.assetId)])){
    const asset=raw.get(id);if(asset)settings[id]={...appearance(asset),...article.assetSettings?.[id]};
  }
  return settings;
}
// Rendering sees article-local captions and widths; binary originals remain shared.
export class ArticleAssetMap extends Map<string,Asset>{
  constructor(private raw:Map<string,Asset>,private article:()=>Article){super();}
  override get(id:string){const asset=this.raw.get(id);return asset?{...asset,...this.article().assetSettings?.[id]}:undefined;}
  override set(id:string,asset:Asset){this.raw.set(id,asset);return this;}
  override has(id:string){return this.raw.has(id);}
  override get size(){return this.raw.size;}
  override keys(){return this.raw.keys();}
  override *values():Generator<Asset,undefined,unknown>{for(const id of this.raw.keys())yield this.get(id)!;return undefined;}
  override *entries():Generator<[string,Asset],undefined,unknown>{for(const id of this.raw.keys())yield [id,this.get(id)!];return undefined;}
  override [Symbol.iterator](){return this.entries();}
  override forEach(callback:(value:Asset,key:string,map:Map<string,Asset>)=>void,thisArg?:any){for(const [key,value] of this)callback.call(thisArg,value,key,this);}
  override delete(id:string){return this.raw.delete(id);}
  override clear(){this.raw.clear();}
}
