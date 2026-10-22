import {slashInsertSource} from './slash-insert';
import {readPreference} from './storage';
import {extraLatexEntries,type LatexEntry} from './latex-catalog';
import {offlineModule} from './offline-modules';
import {Prec,type Extension} from '@codemirror/state';
import {keymap} from '@codemirror/view';
import {syntaxTree} from '@codemirror/language';
import {acceptCompletion,autocompletion,completionKeymap,snippetCompletion,type Completion,type CompletionContext} from '@codemirror/autocomplete';

type Entry=LatexEntry;
const structures:Entry[]=[
  {command:'frac',detail:'分式',example:'\\frac{a}{b}',template:String.raw`\frac{#{1:a}}{#{2:b}}#{0}`},
  {command:'sqrt',detail:'平方根',symbol:'√',example:'\\sqrt{x}',template:String.raw`\sqrt{#{1:x}}#{0}`,aliases:['sqar']},
  {command:'sum',detail:'求和',symbol:'∑',example:'\\sum_{i=1}^{n}',template:String.raw`\sum_{#{1:i=1}}^{#{2:n}} {#{3:a_i}}#{0}`},
  {command:'prod',detail:'连乘',symbol:'∏',example:'\\prod_{i=1}^{n}',template:String.raw`\prod_{#{1:i=1}}^{#{2:n}} {#{3:a_i}}#{0}`},
  {command:'int',detail:'定积分',symbol:'∫',example:'\\int_{a}^{b}',template:String.raw`\int_{#{1:a}}^{#{2:b}} #{3:f(x)}\,d{#{4:x}}#{0}`},
  {command:'iint',detail:'二重积分',symbol:'∬'},
  {command:'iiint',detail:'三重积分',symbol:'∭'},
  {command:'oint',detail:'闭合路径积分',symbol:'∮'},
  {command:'lim',detail:'极限',example:'\\lim_{x\\to 0}',template:String.raw`\lim_{#{1:x}\to #{2:0}} {#{3:f(x)}}#{0}`},
  {command:'binom',detail:'二项式系数',example:'\\binom{n}{k}',template:String.raw`\binom{#{1:n}}{#{2:k}}#{0}`},
  {command:'vec',detail:'向量',example:'\\vec{a}',template:String.raw`\vec{#{1:a}}#{0}`},
  {command:'hat',detail:'帽符号',example:'\\hat{x}',template:String.raw`\hat{#{1:x}}#{0}`},
  {command:'bar',detail:'上横线',example:'\\bar{x}',template:String.raw`\bar{#{1:x}}#{0}`},
  {command:'overline',detail:'长上横线',example:'\\overline{AB}',template:String.raw`\overline{#{1:AB}}#{0}`},
  {command:'dot',detail:'一阶导数点',example:'\\dot{x}',template:String.raw`\dot{#{1:x}}#{0}`},
  {command:'ddot',detail:'二阶导数点',example:'\\ddot{x}',template:String.raw`\ddot{#{1:x}}#{0}`},
  {command:'text',detail:'公式内文字',example:'\\text{文字}',template:String.raw`\text{#{1:文字}}#{0}`},
  {command:'mathrm',detail:'正体字母 / 单位',example:'\\mathrm{m}',template:String.raw`\mathrm{#{1:m}}#{0}`},
  {command:'mathbf',detail:'粗体字母',example:'\\mathbf{v}',template:String.raw`\mathbf{#{1:v}}#{0}`},
  {command:'mathbb',detail:'数集黑板体',example:'\\mathbb{R}',template:String.raw`\mathbb{#{1:R}}#{0}`},
  {command:'left',detail:'自动伸缩括号',example:'\\left( x \\right)',template:String.raw`\left( #{1:x} \right)#{0}`},
  {command:'begin',detail:'矩阵',example:'\\begin{pmatrix}',template:String.raw`\begin{pmatrix}
#{1:a} & #{2:b} \\
#{3:c} & #{4:d}
\end{pmatrix}#{0}`}
];
const greek=[
  ['alpha','α'],['beta','β'],['gamma','γ'],['delta','δ'],['epsilon','ϵ'],['varepsilon','ε'],['zeta','ζ'],['eta','η'],['theta','θ'],['vartheta','ϑ'],['iota','ι'],['kappa','κ'],['lambda','λ'],['mu','μ'],['nu','ν'],['xi','ξ'],['pi','π'],['varpi','ϖ'],['rho','ρ'],['varrho','ϱ'],['sigma','σ'],['varsigma','ς'],['tau','τ'],['upsilon','υ'],['phi','ϕ'],['varphi','φ'],['chi','χ'],['psi','ψ'],['omega','ω'],
  ['Gamma','Γ'],['Delta','Δ'],['Theta','Θ'],['Lambda','Λ'],['Xi','Ξ'],['Pi','Π'],['Sigma','Σ'],['Upsilon','Υ'],['Phi','Φ'],['Psi','Ψ'],['Omega','Ω']
].map(([command,symbol])=>({command,symbol,detail:'希腊字母'}));
const operators=[
  ['sin','正弦'],['cos','余弦'],['tan','正切'],['cot','余切'],['sec','正割'],['csc','余割'],['arcsin','反正弦'],['arccos','反余弦'],['arctan','反正切'],['sinh','双曲正弦'],['cosh','双曲余弦'],['tanh','双曲正切'],['log','对数'],['ln','自然对数'],['exp','指数函数'],['max','最大值'],['min','最小值'],['det','行列式'],['gcd','最大公约数']
].map(([command,detail])=>({command,detail}));
const symbols=[
  ['infty','∞','无穷'],['partial','∂','偏导数'],['nabla','∇','梯度'],['times','×','乘号'],['cdot','·','点乘'],['div','÷','除号'],['pm','±','正负'],['mp','∓','负正'],['leq','≤','小于等于'],['geq','≥','大于等于'],['neq','≠','不等于'],['approx','≈','约等于'],['equiv','≡','恒等'],['propto','∝','正比'],['to','→','趋向'],['rightarrow','→','右箭头'],['leftarrow','←','左箭头'],['Rightarrow','⇒','推出'],['Leftrightarrow','⇔','等价'],['in','∈','属于'],['notin','∉','不属于'],['subset','⊂','子集'],['subseteq','⊆','子集或相等'],['cup','∪','并集'],['cap','∩','交集'],['emptyset','∅','空集'],['forall','∀','任意'],['exists','∃','存在'],['ldots','…','横向省略号'],['cdots','⋯','居中省略号'],['angle','∠','角'],['perp','⊥','垂直'],['parallel','∥','平行']
].map(([command,symbol,detail])=>({command,symbol,detail}));
export const latexEntries:Entry[]=[...structures,...greek,...operators,...symbols,...extraLatexEntries];
const entries=latexEntries,byLabel=new Map(entries.map(entry=>['\\'+entry.command,entry]));
// The same default text is used for the candidate preview and snippet insertion.
export const latexPreviewSource=(entry:Entry)=>entry.template?entry.template.replace(/#\{\d+(?::([^{}]*))?\}/g,(_,value)=>value||''):'\\'+entry.command;
function preview(entry:Entry,large=false){
 const node=document.createElement('span');node.className=large?'latex-preview latex-preview-large':'latex-preview';node.dataset.latexPreview=entry.command;node.setAttribute('aria-hidden','true');
 requestAnimationFrame(()=>{if(!node.isConnected)return;try{const result=offlineModule<typeof import('./math-engine')>('math').renderMath(latexPreviewSource(entry),false);if(result.error)throw Error(result.error);node.innerHTML=result.html;node.dataset.rendered='true';}catch{node.textContent='预览暂不可用';}});
 return node;
}
function information(entry:Entry){
 const node=document.createElement('div');node.className='latex-completion-info';const code=document.createElement('code'),help=document.createElement('p');
 code.textContent=latexPreviewSource(entry);help.textContent=entry.template?'Enter / Tab 插入；Tab 切换待填内容，Shift + Tab 返回。公式写在 $…$ 或 $$…$$ 中。':'Enter / Tab 插入命令。公式写在 $…$ 或 $$…$$ 中。';node.append(preview(entry,true),code,help);return node;
}
const choices=new Map<Entry,Completion>(entries.map(entry=>{
  const completion:Completion={label:'\\'+entry.command,displayLabel:entry.example||'\\'+entry.command,type:entry.template?'function':'constant',info:()=>information(entry)};
  return [entry,entry.template?snippetCompletion(entry.template,completion):completion];
}));

export function latexCompletionSource(context:CompletionContext){
  if(!context.state.selection.main.empty)return null;
  const match=context.matchBefore(/\\[A-Za-z]*$/);
  if(!match||match.text.length<2&&!context.explicit)return null;
  if(match.from>0&&context.state.sliceDoc(match.from-1,match.from)==='\\')return null;
  // Markdown code is literal. Math commands remain available in prose and formulas.
  for(let node=syntaxTree(context.state).resolveInner(context.pos,-1);node;node=node.parent!)
    if(/^(?:FencedCode|CodeBlock|InlineCode|CodeText)$/.test(node.name))return null;
  const prefix=match.text.slice(1);
  const options=entries.filter(entry=>entry.command.startsWith(prefix)||entry.aliases?.some(alias=>alias.startsWith(prefix))).map(entry=>choices.get(entry)!);
  return options.length?{from:match.from,options,filter:false}:null;
}

export function latexCompletionExtension():Extension{
  return [autocompletion({override:[ctx=>readPreference('latex-completion','true')==='true'?latexCompletionSource(ctx):null,slashInsertSource],activateOnTypingDelay:65,interactionDelay:0,defaultKeymap:false,icons:false,maxRenderedOptions:24,tooltipClass:()=> 'latex-completion-menu',addToOptions:[{position:60,render:completion=>{const entry=byLabel.get(completion.label);return entry?preview(entry):null;}}]}),Prec.highest(keymap.of([{key:'Tab',run:acceptCompletion},...completionKeymap]))];
}
