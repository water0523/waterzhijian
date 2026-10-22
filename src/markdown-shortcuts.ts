import {readPreference,preference} from './storage';
import {escapeHTML as esc} from './model';
import type {MarkdownEditor} from './editor';
import {blockFormat,codeFormat} from './formatting';
import {closePopover} from './popover';

export function mountMarkdownShortcuts(editor:MarkdownEditor,open?:(title:string,html:string)=>void){
 const click=(selector:string)=>document.querySelector<HTMLButtonElement>(selector)?.click();
 const wrap=(before:string,after:string,placeholder:string)=>{
  const s=editor.view.state.selection.main,text=editor.view.state.sliceDoc(s.from,s.to)||placeholder;
  editor.view.dispatch({changes:{from:s.from,to:s.to,insert:before+text+after},selection:{anchor:s.from+before.length,head:s.from+before.length+text.length},userEvent:'input.format',scrollIntoView:true});editor.view.focus();
 };
 const list=(ordered:boolean)=>{
  const state=editor.view.state,s=state.selection.main,a=state.doc.lineAt(s.from),b=state.doc.lineAt(s.to>s.from&&state.doc.sliceString(s.to-1,s.to)==='\n'?s.to-1:s.to),lines=state.doc.sliceString(a.from,b.to).split('\n');
  const pattern=ordered?/^(\s*)\d+[.)]\s+/:/^(\s*)[-+*]\s+/,remove=lines.filter(l=>l.trim()).length>0&&lines.filter(l=>l.trim()).every(l=>pattern.test(l));let index=0;
  const insert=lines.map(l=>{if(!l.trim()&&lines.length>1)return l;if(remove)return l.replace(pattern,'$1');const clean=l.replace(/^(\s*)(?:\d+[.)]|[-+*])\s+/,'$1'),indent=clean.match(/^\s*/)![0];return indent+(ordered?`${++index}. `:'- ')+clean.slice(indent.length);}).join('\n');
  editor.view.dispatch({changes:{from:a.from,to:b.to,insert},selection:{anchor:a.from,head:a.from+insert.length},userEvent:'input.format',scrollIntoView:true});editor.view.focus();
 };
 const commands:Record<string,()=>void>={
  b:()=>click('.format-toolbar [data-format=bold]'),l:()=>click('.format-toolbar [data-format=italic]'),u:()=>click('.format-toolbar [data-format=underline]'),e:()=>{const s=editor.view.state.selection.main;if(!editor.view.state.sliceDoc(s.from,s.to).includes('\n'))codeFormat(editor);},m:()=>wrap('$','$',''),k:()=>click('.format-toolbar [data-format=link]'),
  'alt-x':()=>click('.format-toolbar [data-format=strike]'),'alt-q':()=>blockFormat(editor,'quote'),'alt-o':()=>list(true),'alt-u':()=>list(false),'alt-e':()=>wrap('\n\n```\n','\n```\n\n','代码'),'alt-m':()=>wrap('\n\n$$\n','\n$$\n\n',''),'alt-h':()=>editor.insert('\n\n---\n\n'),'alt-t':()=>click('.format-toolbar [data-format=table]'),'alt-l':()=>click('#image-button')
 };
 for(let level=1;level<=6;level++)commands[String(level)]=()=>blockFormat(editor,`h${level}` as 'h1');
 const labels:Record<string,string>={'1':'一级标题','2':'二级标题','3':'三级标题','4':'四级标题','5':'五级标题','6':'六级标题',b:'加粗',l:'倾斜',u:'下划线',e:'行内代码',m:'行内公式',k:'链接','alt-x':'删除线','alt-q':'引用','alt-o':'有序列表','alt-u':'无序列表','alt-e':'代码块','alt-m':'公式块','alt-h':'分割线','alt-t':'表格','alt-l':'图片'};
 const original=Object.fromEntries(Object.keys(commands).map(k=>[k,'Ctrl+'+k.replace('alt-','Alt+').toUpperCase().replace('ALT+','Alt+')])),safe={...original};for(let i=1;i<=6;i++)safe[String(i)]='Ctrl+Alt+'+i;Object.assign(safe,{l:'Ctrl+Alt+I',e:'Ctrl+Alt+C',k:'Ctrl+Alt+K'});
 let custom:Record<string,string>={};try{custom=JSON.parse(readPreference('shortcut-custom','{}'));}catch{}
 let profile=readPreference('shortcut-profile','safe');const bindings=()=>profile==='original'?original:profile==='custom'?{...safe,...custom}:safe;
 const signature=(e:KeyboardEvent)=>'Ctrl+'+(e.altKey?'Alt+':'')+(e.shiftKey?'Shift+':'')+e.key.toUpperCase();
 document.addEventListener('keydown',e=>{
  if(!e.ctrlKey||e.metaKey||e.isComposing||e.getModifierState('AltGraph')||!editor.view.hasFocus||document.querySelector('dialog[open]'))return;
  const action=Object.entries(bindings()).find(([,key])=>key===signature(e))?.[0]||(profile==='safe'&&signature(e)==='Ctrl+Alt+F'?'m':undefined);if(!action)return;e.preventDefault();e.stopImmediatePropagation();closePopover();commands[action]();
 },true);
 document.addEventListener('paper-shortcut-settings',()=>{if(!open)return;open('快捷键设置',`<p>浏览器友好方案避开地址栏、标签切换等常用组合。原方案保留供选择；所有功能仍可使用按钮。</p><select id="shortcut-profile"><option value="safe">浏览器友好（默认）</option><option value="original">原方案（存在浏览器冲突）</option><option value="custom">自定义</option></select><p id="shortcut-status" role="status"></p>${Object.entries(labels).map(([key,label])=>`<label style="display:flex;justify-content:space-between;margin:6px">${label}<input data-shortcut="${key}" value="${esc(bindings()[key])}" placeholder="留空禁用"></label>`).join('')}<button id="shortcut-save" class="button primary">保存映射</button>`);const select=document.getElementById('shortcut-profile') as HTMLSelectElement;select.value=profile;document.querySelectorAll<HTMLInputElement>('[data-shortcut]').forEach(n=>n.oninput=()=>select.value='custom');select.onchange=()=>{const map=select.value==='original'?original:select.value==='safe'?safe:{...safe,...custom};document.querySelectorAll<HTMLInputElement>('[data-shortcut]').forEach(n=>n.value=map[n.dataset.shortcut!]);};document.getElementById('shortcut-save')!.onclick=()=>{const next:Record<string,string>={},seen=new Set<string>();let error='';for(const n of document.querySelectorAll<HTMLInputElement>('[data-shortcut]')){const key=n.value.trim();if(key&&!/^Ctrl\+(?:Alt\+)?(?:Shift\+)?[A-Z0-9]$/.test(key)){error='格式应为 Ctrl+Alt+X，可加 Shift；字母使用大写。';break;}if(key&&seen.has(key)){error='两个功能使用了相同快捷键。';break;}if(key)seen.add(key);next[n.dataset.shortcut!]=key;}const status=document.getElementById('shortcut-status')!;if(error){status.textContent=error;return;}custom=next;profile=select.value==='safe'||select.value==='original'?select.value:'custom';preference('shortcut-profile',profile);preference('shortcut-custom',JSON.stringify(next));document.dispatchEvent(new Event('paper-shortcut-updated'));status.textContent='已保存。Ctrl+L、Ctrl+数字等组合可能由浏览器优先处理，建议使用友好方案。';};});
 const tips:Record<string,string[]>={'[data-format=heading]':['1','2','3','4','5','6'],'[data-format=bold]':['b'],'[data-format=italic]':['l'],'[data-format=underline]':['u'],'[data-format=strike]':['alt-x'],'[data-format=code]':['e','alt-e'],'[data-format=quote]':['alt-q'],'[data-format=link]':['k'],'[data-format=table]':['alt-t'],'#image-button':['alt-l'],'#math-button':['m','alt-m'],'#divider-button':['alt-h']};
 const updateHints=()=>{for(const [selector,keys] of Object.entries(tips))document.querySelectorAll<HTMLElement>(selector).forEach(n=>n.title=keys.map(k=>labels[k]+' '+(bindings()[k]||'未设快捷键')).join('；'));};updateHints();document.addEventListener('paper-shortcut-updated',updateHints);
}
