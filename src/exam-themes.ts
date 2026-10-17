import type {Theme} from './theme-types';
export const examSubjects=[
  {id:'exam-chinese',name:'语文',minutes:150,score:150,topics:'现代文阅读 · 古诗文 · 语言运用 · 作文'},
  {id:'exam-math',name:'数学',minutes:120,score:150,topics:'单选 · 多选 · 填空 · 解答'},
  {id:'exam-physics',name:'物理',minutes:75,score:100,topics:'单选 · 多选 · 实验 · 计算'},
  {id:'exam-geography',name:'地理',minutes:75,score:100,topics:'材料组题 · 数据表 · 综合分析'},
  {id:'exam-english',name:'英语',minutes:120,score:150,topics:'听力文字示例 · 阅读 · 语言运用 · 写作'},
  {id:'exam-biology',name:'生物',minutes:75,score:100,topics:'单选 · 不定项 · 实验探究 · 遗传分析'}
] as const;
export const examThemes:Theme[]=examSubjects.map(s=>({id:s.id,name:'湖南高考 · '+s.name,group:'试卷',description:s.topics+'；宋体题干、黑体标题、西文 Times New Roman 的黑白练习卷',accent:'#111111',paper:'#ffffff',ink:'#111111',font:'simsun',headingFont:'exam-hei',quoteFont:s.id==='exam-chinese'?'exam-kai':'simsun',captionFont:'simsun',poemFont:'exam-kai',codeFont:'mono',variant:'exam',defaults:{size:16,lineHeight:1.8,paragraphGap:10,padding:30,indent:false}}));
export const examSubject=(id:string)=>examSubjects.find(s=>s.id===id);
