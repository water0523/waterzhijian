import {fontNames,type Article} from './model';
import type {ElementName,ElementStyle} from './theme-types';
import {enhanceColors} from './popover';
import {preference,readPreference} from './storage';

const labels:Record<ElementName,string>={h1:'H1 · 一级标题',h2:'H2 · 二级标题',h3:'H3 · 三级标题',quote:'引用块',caption:'图片说明',table:'表格',list:'列表',code:'代码块',formula:'独立公式',poem:'诗歌块',divider:'分割线'};
const selectors:Record<ElementName,string>={h1:'h1',h2:'h2',h3:'h3',quote:'blockquote',caption:'.image-caption',table:'table:not([role=presentation])',list:'ul,ol',code:'pre',formula:'.math-display',poem:'.poem',divider:'hr:not(.footnotes-sep),.decorative-divider'};
const numberSettings={size:['字号',10,48,.5,'px'],lineHeight:['行高',1,3.5,.05,'倍'],letterSpacing:['字间距',-1,8,.1,'px'],marginTop:['上间距',0,80,.5,'px'],marginBottom:['下间距',0,80,.5,'px'],padding:['内边距',0,40,.5,'px'],radius:['圆角',0,40,.5,'px'],borderWidth:['装饰线粗细',0,8,.5,'px']} as const;
type NumericKey=keyof typeof numberSettings;
type Host={article:()=>Article;preview:()=>HTMLElement;before:()=>void;change:()=>void};
const savedSelection=readPreference('element-selection','h2');
let selected=(Object.hasOwn(labels,savedSelection)?savedSelection:'h2') as ElementName;
let tab='文字';
const computedDefaults={size:16,lineHeight:1.85,letterSpacing:0,marginTop:24,marginBottom:16,padding:0,radius:0,borderWidth:0};
function colorHex(input:string,fallback:string){const values=input.match(/[\d.]+/g)?.map(Number);return values&&values.length>=3&&values[3]!==0?'#'+values.slice(0,3).map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''):fallback;}

export function mountElementPanel(root:HTMLElement,host:Host){
  const owner=host.article(),details=document.createElement('details');details.id='element-settings';details.className='element-settings';details.open=readPreference('element-panel-open','false')==='true';
  details.innerHTML=`<summary>标题与元素细调 <span id="element-override-count"></span></summary><p class="help">只作用于当前文章；未调整的项目继续跟随主题。</p><label for="element-choice">选择元素</label><select id="element-choice">${Object.entries(labels).map(([id,name])=>`<option value="${id}" ${selected===id?'selected':''}>${name}</option>`).join('')}</select><div class="element-tabs" role="group" aria-label="元素设置分类">${['文字','间距','边框'].map(t=>`<button type="button" data-element-tab="${t}" aria-pressed="${tab===t}">${t}</button>`).join('')}</div><p id="element-presence" class="help"></p><div id="element-fields"></div><div class="element-reset-actions"><button type="button" id="element-reset-current">此元素跟随主题</button><button type="button" id="element-reset-all">清除全部细调</button></div>`;
  root.append(details);
  const $=<T extends HTMLElement=HTMLElement>(id:string)=>details.querySelector<T>('#'+id)!;
  let changedAt=0;
  const style=()=>host.article().typography.elements?.[selected]||{};
  const count=()=>{const n=Object.values(host.article().typography.elements||{}).reduce((sum,s)=>sum+Object.keys(s).length,0);$('element-override-count').textContent=n?`${n} 项`:'';$<HTMLButtonElement>('element-reset-current').disabled=!Object.keys(style()).length;$<HTMLButtonElement>('element-reset-all').disabled=!n;};
  function publish(next:Article['typography']['elements']){
    if(host.article().id!==owner.id)return;
    if(Date.now()-changedAt>1500)host.before();changedAt=Date.now();
    const typography={...host.article().typography};if(next&&Object.keys(next).length)typography.elements=next;else delete typography.elements;
    host.article().typography=typography;host.change();count();
  }
  function update(key:keyof ElementStyle,value:unknown){
    const next={...host.article().typography.elements},s={...style()};
    if(value===undefined)delete s[key];else (s as Record<string,unknown>)[key]=value;
    if(Object.keys(s).length)next[selected]=s;else delete next[selected];publish(next);
    const field=$('element-fields').querySelector<HTMLElement>(`[data-field="${key}"]`);field?.classList.toggle('customized',Object.hasOwn(s,key));const clear=field?.querySelector<HTMLButtonElement>('[data-element-clear]');if(clear)clear.disabled=!Object.hasOwn(s,key);
  }
  function draw(){
    if(!details.isConnected||host.article().id!==owner.id)return;
    const node=host.preview().querySelector<HTMLElement>(selectors[selected]);let probe:HTMLElement|undefined,target=node;
    if(!target){
      const tags:Record<ElementName,string>={h1:'h1',h2:'h2',h3:'h3',quote:'blockquote',caption:'span',table:'table',list:'ul',code:'pre',formula:'section',poem:'section',divider:'section'};
      probe=document.createElement(tags[selected]);probe.setAttribute('aria-hidden','true');probe.dataset.styleProbe='true';probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;';
      if(selected==='caption'){probe.className='image-wrap';const child=document.createElement('span');child.className='image-caption';probe.append(child);target=child;}
      else{probe.className=({formula:'math-display',poem:'poem',divider:'decorative-divider'} as Partial<Record<ElementName,string>>)[selected]||'';target=probe;}
      host.preview().append(probe);
    }
    const computed=getComputedStyle(target!),s=style();
    $('element-presence').textContent=node?'显示当前效果；点击任一恢复按钮可继续跟随主题。':'正文中尚无此元素，设置会在插入后生效。';
    const numeric=(key:NumericKey)=>{
      const [name,min,max,step,unit]=numberSettings[key];let raw=key==='size'?parseFloat(computed.fontSize):key==='lineHeight'?parseFloat(computed.lineHeight)/parseFloat(computed.fontSize):key==='radius'?parseFloat(computed.borderRadius):key==='borderWidth'?Math.max(...['Top','Right','Bottom','Left'].map(side=>parseFloat(computed['border'+side+'Width' as keyof CSSStyleDeclaration] as string)||0)):parseFloat(computed[key as keyof CSSStyleDeclaration] as string);
      if(!Number.isFinite(raw))raw=computedDefaults[key];const value=s[key]??Math.max(min,Math.min(max,Math.round(raw*100)/100));
      return `<div class="element-field ${s[key]!==undefined?'customized':''}" data-field="${key}"><label for="element-number-${key}">${name}<span>${unit}</span></label><div class="numeric-setting"><input type="range" id="element-range-${key}" data-element-number="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${labels[selected]}${name}滑块"><input type="number" id="element-number-${key}" data-element-number="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${labels[selected]}${name}数值"></div><button type="button" class="element-clear" data-element-clear="${key}" ${s[key]===undefined?'disabled':''} aria-label="${name}跟随主题">↺</button></div>`;
    };
    const choice=(key:keyof ElementStyle,name:string,items:[string,string][])=>`<div class="element-field ${s[key]!==undefined?'customized':''}" data-field="${key}"><label for="element-${key}">${name}</label><select id="element-${key}" data-element-select="${key}"><option value="">跟随主题</option>${items.map(([id,label])=>`<option value="${id}" ${String(s[key])===id?'selected':''}>${label}</option>`).join('')}</select></div>`;
    const color=(key:'color'|'background'|'borderColor',name:string)=>{const current=key==='background'?computed.backgroundColor:key==='borderColor'?['Top','Right','Bottom','Left'].map(side=>({width:parseFloat(computed['border'+side+'Width' as keyof CSSStyleDeclaration] as string),color:computed['border'+side+'Color' as keyof CSSStyleDeclaration] as string})).find(s=>s.width>0)?.color||computed.color:computed.color;return `<div class="element-field ${s[key]!==undefined?'customized':''}" data-field="${key}"><label for="element-${key}">${name}</label><input id="element-${key}" type="color" data-element-color="${key}" value="${s[key]||colorHex(current,key==='background'?'#ffffff':'#315e53')}"><button type="button" class="element-clear" data-element-clear="${key}" ${s[key]===undefined?'disabled':''} aria-label="${name}跟随主题">↺</button></div>`;};
    try{
    $('element-fields').innerHTML=tab==='文字'?choice('font','字体',Object.entries(fontNames))+numeric('size')+choice('weight','粗细',[['100','极细 · 100'],['200','纤细 · 200'],['300','细体 · 300'],['400','常规 · 400'],['500','中等 · 500'],['600','半粗 · 600'],['700','粗体 · 700'],['800','特粗 · 800'],['900','黑体 · 900']])+choice('italic','字形',[['false','正常'],['true','斜体']])+choice('align','对齐',[['left','左对齐'],['center','居中'],['right','右对齐'],['justify','两端对齐']])+numeric('lineHeight')+numeric('letterSpacing')+color('color','文字颜色'):tab==='间距'?numeric('marginTop')+numeric('marginBottom')+numeric('padding')+color('background','背景颜色')+numeric('radius'):choice('borderSide',selected==='table'?'表格外框位置':'装饰线位置',[['all','四周'],['top','顶部'],['bottom','底部'],['left','左侧'],['right','右侧']])+numeric('borderWidth')+choice('borderStyle','线条样式',[['solid','实线'],['dashed','虚线'],['dotted','点线'],['double','双线']])+color('borderColor','线条颜色')+choice('shadow','阴影',[['none','无'],['soft','柔和'],['offset','纸层偏移']])+'<p class="help">改变线条位置会重新建立边框，默认 1px 实线；可继续调整。线宽 0 隐藏线条。表格内部线条用上方表格样式选择。</p>';
    if(tab==='文字'&&selected==='formula')$('element-fields').innerHTML=numeric('size')+choice('align','对齐',[['left','左对齐'],['center','居中'],['right','右对齐']])+color('color','公式默认颜色')+'<p class="help">数学粗体和局部彩色请用源码或选区工具；此处调整整体大小与默认色。</p>';
    if(tab==='文字'&&selected==='divider')$('element-fields').innerHTML=color('color','装饰颜色')+'<p class="help">普通横线的颜色请在「边框」中调整。</p>';
    }finally{probe?.remove();}
    enhanceColors($('element-fields'));count();
    $('element-fields').querySelectorAll<HTMLInputElement>('[data-element-number]').forEach(input=>{
      const key=input.dataset.elementNumber as NumericKey;let lastValid=Number(input.value);
      const apply=()=>{if(input.value==='')return;const value=Number(input.value),[,min,max]=numberSettings[key];if(!Number.isFinite(value)||value<min||value>max)return;lastValid=value;update(key,value);for(const other of $('element-fields').querySelectorAll<HTMLInputElement>(`[data-element-number="${key}"]`))if(other!==input)other.value=String(value);};
      input.oninput=apply;input.onblur=()=>{const [,min,max]=numberSettings[key],value=Number(input.value);if(input.value===''||!Number.isFinite(value)||value<min||value>max)input.value=String(style()[key]??lastValid);};
    });
    $('element-fields').querySelectorAll<HTMLSelectElement>('[data-element-select]').forEach(input=>input.onchange=()=>{const key=input.dataset.elementSelect as keyof ElementStyle;update(key,input.value===''?undefined:key==='weight'?Number(input.value):key==='italic'?input.value==='true':input.value);if(key==='borderSide'||key==='borderStyle'){draw();$<HTMLSelectElement>('element-'+key).focus();}});
    $('element-fields').querySelectorAll<HTMLInputElement>('[data-element-color]').forEach(input=>input.oninput=()=>update(input.dataset.elementColor as keyof ElementStyle,input.value));
    $('element-fields').querySelectorAll<HTMLButtonElement>('[data-element-clear]').forEach(b=>b.onclick=()=>{update(b.dataset.elementClear as keyof ElementStyle,undefined);draw();});
  }
  $('element-choice').onchange=()=>{selected=$<HTMLSelectElement>('element-choice').value as ElementName;preference('element-selection',selected);draw();};
  details.querySelectorAll<HTMLButtonElement>('[data-element-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.elementTab!;details.querySelectorAll<HTMLElement>('[data-element-tab]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));draw();});
  $('element-reset-current').onclick=()=>{const next={...host.article().typography.elements};delete next[selected];publish(next);draw();};
  $('element-reset-all').onclick=()=>{publish(undefined);draw();};
  details.ontoggle=()=>{preference('element-panel-open',String(details.open));if(details.open)draw();};
  if(details.open)draw();else count();
  return ()=>{if(details.open)draw();};
}
