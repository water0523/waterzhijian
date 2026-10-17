import atlasReference from '../assets/witch/elaina-atlas.png';
import {embeddedImage} from './offline-modules';
import {readPreference,preference} from './storage';
import {uiIcon} from './ui-icons';

export type UISkin='water'|'witch-light'|'witch-immersive';
export const uiSkins=[{id:'water',name:'天蓝 · 默认',description:'熟悉的天蓝界面，清楚、轻快。'},{id:'witch-light',name:'魔女之旅 · 轻装写作',description:'月紫与奶油纸，城堡横幅和少量魔法小物。'},{id:'witch-immersive',name:'魔女之旅 · 沉浸旅途',description:'角色插画、天空城堡、星象与羽毛笔环绕。'}] as const;
const regions={castle:[858,0,839,196],portrait:[0,0,492,416],traveler:[489,0,373,442],books:[786,605,222,154],quill:[1074,706,138,165],compass:[447,704,89,104],bookIcon:[1006,274,66,67],starIcon:[1078,274,67,67]} as const;
type Region=keyof typeof regions;
type Host={open:(title:string,html:string,eyebrow?:string)=>void;notify:(message:string,error?:boolean)=>void;layout:()=>void};
export const validUISkin=(input:string|null):UISkin=>uiSkins.some(s=>s.id===input)?input as UISkin:'water';
let assetURL:Promise<string>|undefined;
function atlasURL(){return assetURL??=(async()=>{const data=embeddedImage(atlasReference),response=await fetch(data);if(!response.ok)throw new Error('界面插画未能载入');return URL.createObjectURL(await response.blob());})().catch(error=>{assetURL=undefined;throw error;});}
function sprite(kind:Region,extra=''){
 const [x,y,w,h]=regions[kind];
 return `<span class="witch-sprite witch-${kind} ${extra}" aria-hidden="true" style="aspect-ratio:${w}/${h}"><img alt="" decoding="async" draggable="false" data-witch-image style="width:${1697/w*100}%;left:${-x/w*100}%;top:${-y/h*100}%"></span>`;
}
export function mountUISkin(host:Host){
 let selected=validUISkin(readPreference('ui-skin','water')),generation=0;
 const root=document.documentElement,settings=document.createElement('button');settings.id='ui-settings-button';settings.className='button outline';settings.title='选择编辑器界面外观';settings.setAttribute('aria-label','界面设置');settings.setAttribute('aria-haspopup','dialog');settings.innerHTML=uiIcon('settings')+'<span>界面</span>';document.getElementById('night-button')!.after(settings);
 const banner=document.createElement('section');banner.className='witch-journey-banner';banner.setAttribute('aria-hidden','true');banner.setAttribute('data-editor-only','true');banner.innerHTML='<div class="witch-journey-copy"><span class="witch-eyebrow">THE WANDERING WITCH</span><strong>旅途中的一页</strong><small>落笔非水，行文成章。</small></div>'+sprite('castle')+sprite('traveler')+sprite('compass');document.querySelector('.app-header')!.after(banner);
 const libraryArt=document.createElement('div');libraryArt.className='witch-library-art';libraryArt.setAttribute('aria-hidden','true');libraryArt.setAttribute('data-editor-only','true');libraryArt.innerHTML=sprite('portrait')+'<span class="witch-library-caption">把沿途的灵感，写进下一页。</span>';document.querySelector('.library-footer')!.before(libraryArt);
 const footer=document.createElement('span');footer.className='witch-footer-art';footer.setAttribute('aria-hidden','true');footer.setAttribute('data-editor-only','true');footer.innerHTML=sprite('books')+sprite('quill');document.querySelector('.workspace-footer')!.append(footer);
 for(const [id,kind]of [['rail-documents','bookIcon'],['theme-sidebar-toggle','starIcon']] as const)document.getElementById(id)!.insertAdjacentHTML('afterbegin',sprite(kind,'witch-rail-icon'));
 const load=async(scope:ParentNode=document)=>{const url=await atlasURL(),images=[...scope.querySelectorAll<HTMLImageElement>('[data-witch-image]')];await Promise.all(images.map(async img=>{if(img.src!==url)img.src=url;await img.decode();}));root.dataset.witchAssets='ready';};
 const updateChoices=()=>{document.querySelectorAll<HTMLButtonElement>('[data-ui-skin-choice]').forEach(button=>{const active=button.dataset.uiSkinChoice===selected;button.setAttribute('aria-pressed',String(active));button.querySelector('.ui-skin-current')!.textContent=active?'使用中':'点击使用';});};
 const apply=(skin:UISkin,save=false)=>{
  selected=skin;root.dataset.uiSkin=skin;const ticket=++generation;
  if(save){preference('ui-skin',skin);host.notify('已切换为「'+uiSkins.find(s=>s.id===skin)!.name+'」');}
  updateChoices();host.layout();
  if(skin!=='water')void load().catch(()=>{if(ticket!==generation||selected==='water')return;root.dataset.witchAssets='unavailable';host.notify('插画暂时未能载入，界面配色仍可使用。请重新选择界面重试。',true);});
 };
 const open=()=>{
  host.open('界面设置',`<p class="modal-subtitle">选择这台电脑上的写作界面。文章主题、正文排版和导出内容不受影响，日间 / 夜间仍可单独切换。</p><div class="ui-skin-choices">${uiSkins.map(s=>`<button class="ui-skin-choice" data-ui-skin-choice="${s.id}" aria-pressed="${selected===s.id}"><span class="ui-skin-mini ui-skin-mini-${s.id}" aria-hidden="true"><span class="ui-mini-header"></span>${s.id==='water'?'':sprite('castle','ui-mini-castle')+(s.id==='witch-immersive'?sprite('portrait','ui-mini-character'):sprite('books','ui-mini-books'))}<span class="ui-mini-sidebar"></span><span class="ui-mini-editor"></span><span class="ui-mini-preview"></span></span><span class="ui-skin-description"><strong>${s.name}</strong><small>${s.description}</small><span class="ui-skin-current">${selected===s.id?'使用中':'点击使用'}</span></span></button>`).join('')}</div><p id="ui-skin-status" class="help" role="status">默认使用天蓝界面 · 选择后自动记住</p>`,'APPEARANCE / 写作空间');
  document.querySelectorAll<HTMLButtonElement>('[data-ui-skin-choice]').forEach(button=>button.onclick=()=>apply(validUISkin(button.dataset.uiSkinChoice||null),true));
  void load(document.getElementById('modal-body')!).catch(()=>{const status=document.getElementById('ui-skin-status');if(status)status.textContent='插画预览暂不可用，仍可选择界面配色。';});
 };
 settings.onclick=open;apply(selected);return {open,selected:()=>selected};
}
