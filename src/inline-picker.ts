import {escapeHTML as esc} from './model';
import {inlineFonts,inlineCSS,literaryRoles,markerInk,type InlineStyle} from './inline-style';
import {openPopover,standardColors} from './popover';

export type InlineMenu='font'|'size'|'color'|'highlight'|'marker'|'effect'|'role';
const menus:[InlineMenu,string][]=[['font','字体'],['size','字号'],['color','字色'],['highlight','荧光'],['marker','半高荧光'],['effect','修饰'],['role','文体']];
const effects=[['dots','字下着重号'],['gold','泥金金句']] as const;

export function mountInlineMenus(handler:(event:Event)=>void){
  for(const id of ['inline-style-button','selection-style-button']){
    const first=document.getElementById(id)!;first.dataset.inlineMenu='font';first.textContent='字体 ▾';first.title='为选中文字选择字体';first.setAttribute('aria-haspopup','menu');first.addEventListener('click',handler);
    let previous=first;
    for(const [kind,name] of menus.slice(1)){
      const button=document.createElement('button');button.id=id==='inline-style-button'?`inline-${kind}-button`:`selection-${kind}-button`;button.dataset.inlineMenu=kind;button.textContent=name+' ▾';button.title='设置选中文字的'+name;button.setAttribute('aria-haspopup','menu');button.addEventListener('click',handler);previous.after(button);previous=button;
    }
  }
}

export function showInlineMenu(target:HTMLElement,kind:InlineMenu,existing:InlineStyle|null,renderSample:(root:HTMLElement,markdown:string)=>void,apply:(style:InlineStyle,change?:{clear?:boolean;effect?:'dots'|'gold'})=>boolean,math=false){
  const current:InlineStyle={...existing},label=menus.find(([id])=>id===kind)![1];
  const row=(value:string,content:string,checked:boolean,extra='')=>`<button type="button" role="menuitemradio" aria-checked="${checked}" data-inline-choice="${esc(value)}" ${extra}>${content}<span class="inline-menu-check" aria-hidden="true">${checked?'✓':''}</span></button>`;
  let html='';
  if(kind==='font')html=row('','<span>跟随正文</span>',!current.font)+Object.entries(inlineFonts).map(([id,font])=>row(id,`<span style="font-family:${esc(font.css)}">${esc(font.name.split(' · ')[0])}</span><small>${esc(font.name.split(' · ')[1])}</small>`,current.font===id,`data-picker-font="${id}"`)).join('');
  if(kind==='role')html=row('','<span>普通文字</span>',!current.role)+Object.entries(literaryRoles).map(([id,name])=>row(id,`<span class="inline-role-row article" data-role-demo="${id}"></span>`,current.role===id,`data-picker-role="${id}" aria-label="${name}"`)).join('');
  if(kind==='effect')html=(math?'':effects.map(([id,name])=>row(id,`<span style="${esc(inlineCSS({[id]:true}))}">${name}</span>`,!!current[id],`data-inline-effect="${id}"`).replace('role="menuitemradio"','role="menuitemcheckbox"')).join(''))+'<button type="button" role="menuitem" class="inline-menu-clear" data-inline-choice="clear">清除选区全部样式</button>';
  if(kind==='size')html=row('','<span>跟随正文</span>',current.size===undefined)+[12,14,15,15.5,16,18,20,24,28,32].map(size=>row(String(size),`<span style="font-size:${size}px">${size}<small> px</small></span>`,current.size===size)).join('');
  const isColor=kind==='color'||kind==='highlight'||kind==='marker';
  const chosen=kind==='marker'?(current.marker?markerInk(current):undefined):kind==='highlight'?current.highlight:current.color;
  if(isColor){
    const palette=kind==='color'?standardColors:[['暖黄','#f5d878'],...standardColors];
    html=row('',`<span>${kind==='color'?'跟随正文':'无'+label}</span>`,!chosen);
    if(kind==='marker')html+='<div class="inline-marker-palette" role="group" aria-label="半高荧光预设颜色">'+palette.map(([name,color])=>{
      const rgb=[1,3,5].map(start=>parseInt(color.slice(start,start+2),16)),contrast=rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>150?'#263b32':'#fff';
      return row(color,'',chosen===color,`data-color="${color}" class="inline-marker-swatch" style="background:${color};--marker-contrast:${contrast}" title="${name} ${color}" aria-label="${name} ${color}"`);
    }).join('')+'</div>';
    else html+=palette.map(([name,color])=>row(color,`<span class="inline-menu-color-swatch" style="background:${color}"></span><span>${name}</span><span class="inline-menu-color-demo" style="${kind==='color'?'color:'+color+(color==='#ffffff'?';background:#34463b':''):'background-color:'+color}">文字 Aa</span>`,chosen===color,`data-color="${color}"`)).join('');
  }
  const custom=kind==='size'?`<label class="inline-menu-custom" for="inline-size">自定字号 <input id="inline-size" type="number" min="10" max="64" step=".5" value="${current.size||''}" placeholder="10–64"> px <small>回车应用</small></label>`:isColor?`<label class="inline-menu-custom">自定${label}<input type="color" id="inline-${kind}" value="${chosen||(kind==='color'?'#315e53':kind==='marker'?'#f5d878':'#fff29b')}" aria-label="自定${label}"></label>`:'';
  const panel=openPopover(target,label,`${math?'<p class="help">作用于选中的公式表达式，保留公式结构。'+(kind==='effect'?'加粗、斜体、下划线和删除线可直接使用工具栏按钮。':'')+'</p>':''}<div class="inline-menu-list" role="menu" aria-label="${label}">${html}</div>${custom}`,{width:kind==='font'?330:kind==='size'?270:kind==='marker'?252:300});panel.classList.add('inline-menu-popover');
  if(kind==='role')for(const [role,name] of Object.entries(literaryRoles))renderSample(panel.querySelector<HTMLElement>(`[data-role-demo="${role}"]`)!,`[${name}]{role=${role}}`);
  if(kind==='font')panel.querySelector<HTMLElement>('[data-inline-choice=""]>span')!.style.fontFamily=getComputedStyle(document.getElementById('preview')!).fontFamily;
  panel.querySelectorAll<HTMLElement>('[data-inline-choice]').forEach(button=>button.onclick=()=>{
    const value=button.dataset.inlineChoice!,style={...current};
    if(kind==='effect'){if(value==='clear'){apply({},{clear:true});return;}const key=value as typeof effects[number][0];if(style[key])delete style[key];else {style[key]=true;if(key==='gold'){delete style.marker;delete style.markerColor;}}apply(style,{effect:key});return;}
    else if(kind==='size'){if(value)style.size=Number(value);else delete style.size;}
    else if(kind==='role'){if(value)style.role=value as InlineStyle['role'];else delete style.role;}
    else if(kind==='font'){if(value)style.font=value;else delete style.font;}
    else if(kind==='marker'){if(value){style.marker=true;style.markerColor=value;delete style.gold;}else {delete style.marker;delete style.markerColor;}}
    else {if(value)style[kind]=value;else delete style[kind];}
    apply(style);
  });
  const number=panel.querySelector<HTMLInputElement>('#inline-size');if(number)number.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(number.value!=='')apply({...current,size:Number(number.value)});}};
  const color=panel.querySelector<HTMLInputElement>('input[type=color]');if(color)color.onchange=()=>{const style={...current};if(kind==='marker'){style.marker=true;style.markerColor=color.value;delete style.gold;}else if(kind==='color'||kind==='highlight')style[kind]=color.value;apply(style);};
  const items=[...panel.querySelectorAll<HTMLButtonElement>('[role^=menuitem]')];
  panel.addEventListener('keydown',e=>{if((e.target as HTMLElement).tagName==='INPUT')return;const index=items.indexOf(document.activeElement as HTMLButtonElement),next=e.key==='ArrowDown'?(index+1)%items.length:e.key==='ArrowUp'?(index+items.length-1)%items.length:e.key==='Home'?0:e.key==='End'?items.length-1:-1;if(next<0)return;e.preventDefault();items[next].focus();});
  items.forEach(item=>item.tabIndex=-1);const checked=items.find(item=>item.getAttribute('aria-checked')==='true')||items[0];checked.tabIndex=0;if(panel.dataset.mode==='pinned'){checked.focus({preventScroll:true});requestAnimationFrame(()=>{if(checked.isConnected)checked.scrollIntoView({block:'nearest'});});}
  return panel;
}
