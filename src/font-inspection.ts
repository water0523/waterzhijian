const roles:Record<string,string>={H1:'H1 标题',H2:'H2 章节',H3:'H3 小节',P:'P 正文',BLOCKQUOTE:'文献引文',CODE:'CODE 等宽'};
export function inspectFonts(root:HTMLElement,enabled:boolean){
  root.toggleAttribute('data-font-inspect',enabled);
  if(!enabled){root.querySelectorAll('[data-font-label]').forEach(n=>n.removeAttribute('data-font-label'));return;}
  for(const node of root.querySelectorAll<HTMLElement>('h1,h2,h3,p,blockquote,code,.journal-block-title,.journal-initial,.folio-title,.text-initial,.literary-note,.literary-aside,.literary-preface,.literary-painting,.poem')){
    if(node.closest('.math-inline,.math-display')||node.matches('blockquote p'))continue;
    const family=getComputedStyle(node).fontFamily.split(',').slice(0,2).map(s=>s.trim().replaceAll('"','')).join(' / ');
    node.dataset.fontLabel=(roles[node.tagName]||(node.matches('.journal-initial,.text-initial')?'首字下沉':'卡片标题'))+' · '+family;
  }
  for(const node of root.querySelectorAll<HTMLElement>('.math-display'))node.dataset.fontLabel='MATH · MathJax SVG 内置字形';
}
