import atlasReference from '../assets/witch/elaina-atlas.png';
import skyReference from '../assets/witch/sky-workspace.webp';
import hatReference from '../assets/witch/hat-corner.webp';
import {embeddedImage} from './offline-modules';
import {readPreference,preference} from './storage';
import {uiIcon} from './ui-icons';

export type UISkin='water'|'witch-light'|'witch-immersive';
export const uiSkins=[{id:'water',name:'天蓝 · 默认',description:'清透天蓝与整齐面板，留一张安静的书桌。'},{id:'witch-light',name:'魔女之旅 · 轻装写作',description:'淡紫天空、远方城堡，点缀少量魔法小物。'},{id:'witch-immersive',name:'魔女之旅 · 沉浸旅途',description:'云海环绕的写作空间，星轨、书籍与魔女相伴。'}] as const;
const regions={castle:[858,0,839,196],portrait:[0,0,492,416],traveler:[489,0,373,442],books:[786,605,222,154],quill:[1074,706,138,165],compass:[447,704,89,104],bookIcon:[1006,274,66,67],starIcon:[1078,274,67,67]} as const;
type Region=keyof typeof regions;
type Host={open:(title:string,html:string,eyebrow?:string)=>void;notify:(message:string,error?:boolean)=>void;layout:()=>void};
export const validUISkin=(input:string|null):UISkin=>uiSkins.some(s=>s.id===input)?input as UISkin:'water';
const references={atlas:atlasReference,sky:skyReference,hat:hatReference},assetURLs=new Map<string,Promise<string>>();
function assetURL(kind:keyof typeof references){let pending=assetURLs.get(kind);if(!pending){pending=(async()=>{const response=await fetch(embeddedImage(references[kind]));if(!response.ok)throw new Error('界面插画未能载入');return URL.createObjectURL(await response.blob());})().catch(error=>{assetURLs.delete(kind);throw error;});assetURLs.set(kind,pending);}return pending;}
const illustration=(kind:'sky'|'hat',className:string)=>`<span class="${className}" aria-hidden="true"><img alt="" decoding="async" draggable="false" data-witch-image="${kind}"></span>`;
function sprite(kind:Region,extra=''){
 const [x,y,w,h]=regions[kind];
 return `<span class="witch-sprite witch-${kind} ${extra}" aria-hidden="true" style="aspect-ratio:${w}/${h}"><img alt="" decoding="async" draggable="false" data-witch-image="atlas" style="width:${1697/w*100}%;left:${-x/w*100}%;top:${-y/h*100}%"></span>`;
}
export function mountUISkin(host:Host){
 let selected=validUISkin(readPreference('ui-skin','water')),generation=0;
 const root=document.documentElement,settings=document.createElement('button');settings.id='ui-settings-button';settings.className='button outline';settings.title='选择编辑器界面外观';settings.setAttribute('aria-label','界面设置');settings.setAttribute('aria-haspopup','dialog');settings.innerHTML=uiIcon('settings')+'<span>界面</span>';document.getElementById('night-button')!.after(settings);
 const scene=document.createElement('div');scene.className='witch-sky-scene';scene.setAttribute('aria-hidden','true');scene.setAttribute('data-editor-only','true');scene.innerHTML=illustration('sky','witch-sky-image');document.getElementById('app')!.prepend(scene);
 const ornaments=document.createElement('div');ornaments.className='witch-edge-ornaments';ornaments.setAttribute('aria-hidden','true');ornaments.setAttribute('data-editor-only','true');ornaments.innerHTML=illustration('hat','witch-corner-hat')+sprite('compass','witch-edge-compass')+'<span class="witch-star witch-star-one">✧</span><span class="witch-star witch-star-two">✦</span><span class="witch-star witch-star-three">✧</span>';document.getElementById('app')!.append(ornaments);
 const libraryArt=document.createElement('div');libraryArt.className='witch-library-art';libraryArt.setAttribute('aria-hidden','true');libraryArt.setAttribute('data-editor-only','true');libraryArt.innerHTML=sprite('portrait')+'<span class="witch-library-caption">把沿途的灵感，写进下一页。</span>';document.querySelector('.library-footer')!.before(libraryArt);
 const footer=document.createElement('span');footer.className='witch-footer-art';footer.setAttribute('aria-hidden','true');footer.setAttribute('data-editor-only','true');footer.innerHTML=sprite('books')+sprite('quill');document.querySelector('.workspace-footer')!.append(footer);
 for(const [id,kind]of [['rail-documents','bookIcon'],['theme-sidebar-toggle','starIcon']] as const)document.getElementById(id)!.insertAdjacentHTML('afterbegin',sprite(kind,'witch-rail-icon'));
 const load=async(scope:ParentNode=document)=>{const images=[...scope.querySelectorAll<HTMLImageElement>('[data-witch-image]')].filter(img=>img.getClientRects().length>0);await Promise.all(images.map(async img=>{const url=await assetURL(img.dataset.witchImage as keyof typeof references);if(img.src!==url)img.src=url;await img.decode();}));};
 const updateChoices=()=>{document.querySelectorAll<HTMLButtonElement>('[data-ui-skin-choice]').forEach(button=>{const active=button.dataset.uiSkinChoice===selected;button.setAttribute('aria-pressed',String(active));button.querySelector('.ui-skin-current')!.textContent=active?'使用中':'点击使用';});};
 const apply=(skin:UISkin,save=false)=>{
  selected=skin;root.dataset.uiSkin=skin;const ticket=++generation;if(skin!=='water')root.dataset.witchAssets='loading';
  if(save){preference('ui-skin',skin);host.notify('已切换为「'+uiSkins.find(s=>s.id===skin)!.name+'」');}
  updateChoices();host.layout();
  if(skin!=='water')void load().then(()=>{if(ticket===generation&&selected===skin)root.dataset.witchAssets='ready';}).catch(()=>{if(ticket!==generation||selected==='water')return;root.dataset.witchAssets='unavailable';host.notify('插画暂时未能载入，界面配色仍可使用。请重新选择界面重试。',true);});
 };
 const open=()=>{
  host.open('界面设置',`<p class="modal-subtitle">同一张书桌，三种写作氛围。选择会在这台电脑上记住，日间 / 夜间可单独切换。</p><div class="ui-skin-choices">${uiSkins.map(s=>`<button class="ui-skin-choice" data-ui-skin-choice="${s.id}" aria-pressed="${selected===s.id}"><span class="ui-skin-mini ui-skin-mini-${s.id}" aria-hidden="true">${s.id==='water'?'':illustration('sky','ui-mini-sky')}<span class="ui-mini-header"></span><span class="ui-mini-sidebar"></span><span class="ui-mini-editor"></span><span class="ui-mini-preview"></span>${s.id==='witch-immersive'?illustration('hat','ui-mini-hat')+sprite('portrait','ui-mini-character'):''}</span><span class="ui-skin-description"><strong>${s.name}</strong><small>${s.description}</small><span class="ui-skin-current">${selected===s.id?'使用中':'点击使用'}</span></span></button>`).join('')}</div><p id="ui-skin-status" class="help" role="status">默认使用天蓝界面 · 文章主题、正文排版和导出内容保持独立</p>`,'APPEARANCE / 写作空间');
  document.querySelectorAll<HTMLButtonElement>('[data-ui-skin-choice]').forEach(button=>button.onclick=()=>apply(validUISkin(button.dataset.uiSkinChoice||null),true));
  void load(document.getElementById('modal-body')!).then(()=>{if(selected==='water')root.dataset.witchAssets='ready';}).catch(()=>{const status=document.getElementById('ui-skin-status');if(status)status.textContent='插画预览暂不可用，仍可选择界面配色。';});
 };
 settings.onclick=open;apply(selected);return {open,selected:()=>selected};
}
