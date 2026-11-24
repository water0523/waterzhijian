import {workshopComponent,type WorkshopBlock} from './workshop-blocks';

export const workshopSampleTitle='留住一页值得重读的文字';
export const workshopThumbnail='# '+workshopSampleTitle+'\n\n## 从一个好问题开始\n\n> 认真观察，让日常的细节拥有自己的光。';

const item=(title:string,text:string)=>workshopComponent('item',text,title);
export const workshopExamples:Record<Exclude<WorkshopBlock,'item'>,string>={
  lead:workshopComponent('lead','把值得读者先知道的内容放在这里。','卷首导读'),
  toc:workshopComponent('toc','- 从一个好问题开始\n- 留下可供重读的线索','本文目录'),
  tip:workshopComponent('tip','给重点和正文留出足够间距。','排版小贴士'),
  note:workshopComponent('note','可以补充背景、原理与相关线索。','延伸阅读'),
  warning:workshopComponent('warning','刊发前核对引文出处与图表单位。','刊发前核对'),
  kpi:workshopComponent('kpi',[item('12 篇','本月阅读'),item('4 次','同行讨论'),item('3 页','整理札记')].join('\n'),'观察记录'),
  figure:workshopComponent('figure','可在此处插入自己的图片。\n\n图注写在图片下方。'),
  steps:workshopComponent('steps','1. 确认文章结构\n2. 梳理写作材料\n3. 通读全文','三个步骤'),
  timeline:workshopComponent('timeline','- 09:00 收集原始资料\n- 11:30 整理访谈记录\n- 16:00 校对图表和引用','撰写记录'),
  compare:workshopComponent('compare',[item('第一种','用细节推动叙述。'),item('第二种','把论点放在开篇。')].join('\n'),'两种写法'),
  gallery:workshopComponent('gallery',[item('第一幅','在此处插入图片和图注。'),item('第二幅','在此处插入图片和图注。')].join('\n')),
  dialogue:workshopComponent('dialogue',[item('问','如何给读者留下清晰的线索？'),item('答','让小标题承担阅读导航。')].join('\n')),
  checklist:workshopComponent('checklist','- 标题层级准确\n- 数据来源清楚\n- 图注便于理解','核对清单'),
  poster:workshopComponent('poster','真正的发现，始于认真观察。'),
  references:workshopComponent('references','1. 作者，《资料标题》，出版年份。','参考资料'),
  author:workshopComponent('author','将这段文字替换为你的作者简介。','作者简介'),
  recommend:workshopComponent('recommend','在此处插入你的往期文章链接。','往期推荐'),
  footer:workshopComponent('footer','感谢阅读。','写在最后')
};
export const workshopSample=[
  '# '+workshopSampleTitle,
  workshopExamples.lead,workshopExamples.toc,
  '## 从一个好问题开始\n\n排版是文章的线索。用**适量的强调**和自然的留白，让人一眼找到值得停留的地方。\n\n### 观察与证据\n\n> 线索来自细节，判断来自可复查的证据。',
  workshopExamples.tip,workshopExamples.kpi,workshopExamples.figure,'---',
  '## 留下可供重读的线索',
  workshopExamples.note,workshopExamples.steps,workshopExamples.timeline,workshopExamples.compare,
  '| 栏目 | 内容 |\n| --- | --- |\n| 观察 | 核对事实 |\n| 注释 | 列出来源 |',
  workshopExamples.gallery,workshopExamples.dialogue,workshopExamples.warning,'---',
  '## 发表前再读一遍',
  workshopExamples.checklist,workshopExamples.poster,workshopExamples.references,
  workshopExamples.author,workshopExamples.recommend,workshopExamples.footer
].join('\n\n');

export const workshopExampleGroups:Record<string,(keyof typeof workshopExamples)[]>={
  '开篇与导航':['lead','toc'],
  '说明与重点':['tip','note','warning','checklist','poster'],
  '图文与数据':['figure','gallery','kpi','compare'],
  '流程与访谈':['steps','timeline','dialogue'],
  '文末与出处':['references','author','recommend','footer']
};
