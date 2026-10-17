import type {Theme} from './theme-types';
import {fontStacks,type Typography} from './model';
export const isExam=(theme:Theme)=>theme.variant==='exam';
export function examCSS(theme:Theme,o:Typography={}){
  const f=fontStacks[o.font||theme.font]||fontStacks.simsun,h=fontStacks[o.headingFont||theme.headingFont||'exam-hei'],k=fontStacks['exam-kai'];
  const components=`
  .article .exam-block{color:inherit;background:transparent;border:0;box-shadow:none;border-radius:0;margin:14px 0;padding:0;text-indent:0}
  .article .exam-title{font-weight:700;line-height:1.8;margin:0 0 8px;text-indent:0;break-after:avoid}
  .article .exam-content{display:flow-root}.article .exam-content>p:last-child{margin-bottom:0}
  .article .exam-meta{text-align:center;margin:6px 0 12px;font-family:${f};font-size:.875em}.article .exam-meta .exam-title{font-weight:400;font-size:1.2em}.article .exam-meta p{margin:3px 0;text-indent:0;text-align:center}
  .article .exam-info{padding:10px 0;border-top:1px solid currentColor;border-bottom:1px solid currentColor;font-size:.875em;line-height:2}.article .exam-info p{margin:0;text-indent:0}
  .article .exam-notice{font-size:.875em;line-height:1.7;margin:18px 0}.article .exam-notice .exam-title{font-family:${h}}.article .exam-notice ol{margin:5px 0;padding-left:1.8em}.article .exam-notice li{padding:0;margin:4px 0}
  .article .exam-passage{margin:16px 0}.article .exam-passage .exam-title{text-align:center}.article .exam-passage p{text-indent:2em;text-align:justify}
  .article .exam-question{margin:16px 0 18px;break-inside:avoid;page-break-inside:avoid}.article .exam-question>.exam-title{font-weight:400}.article .exam-question p{text-indent:0}
  .article .exam-options{margin:8px 0 6px;break-inside:avoid}.article .exam-options-table{border:0!important;width:100%;table-layout:fixed;margin:0;font-size:1em;background:transparent;border-collapse:collapse}.article .exam-options-table td{border:0!important;background:transparent!important;color:inherit;padding:4px 12px 4px 0;vertical-align:top;font-family:inherit;line-height:inherit;word-break:normal;overflow-wrap:anywhere}.article .exam-options-table p{margin:0!important;text-indent:0}
  .article .exam-answer{margin:12px 0 18px}.article .exam-answer-line{height:2.1em;line-height:2.1;margin:0!important;border-bottom:1px solid #999;text-indent:0;break-inside:avoid}
  .article .exam-key{font-family:${fontStacks.simsun};border-top:2px solid currentColor;padding-top:16px;margin-top:28px;font-size:.875em}.article .exam-key>.exam-title{font-family:${fontStacks.simsun};font-size:1.15em}.article .exam-key p{text-indent:0}
  .article .exam-analysis{font-family:${k};font-size:.9375em;border-top:1px solid #999;padding-top:14px;margin-top:20px}.article .exam-analysis>.exam-title{font-family:${k};font-size:1.15em}.article .exam-analysis p{text-indent:0}
  .article .exam-pagebreak{border-top:1px dashed #bbb;margin:30px 0;height:1px;break-before:page;page-break-before:always}
  @media print{.article .exam-pagebreak{border:0;margin:0;height:0}.article .exam-title{break-after:avoid}.article .exam-answer-line{break-inside:avoid}}
  `;
  if(!isExam(theme))return components;
  return components+`
  .article{color:#111;background:#fff;letter-spacing:0;text-align:left;font-family:${f};font-synthesis:weight style}
  .article h1{font-family:${h};font-size:27px;color:inherit;text-align:center;letter-spacing:.3em;padding:4px 0;border:0;background:none;margin:12px 0 18px;line-height:1.6}
  .article h2{font-family:${h};font-size:18px;color:inherit;text-align:left;letter-spacing:0;padding:0;border:0;background:none;margin:26px 0 12px;line-height:1.7}
  .article h3{font-family:${h};font-size:16px;color:inherit;text-align:left;padding:0;border:0;margin:18px 0 10px}
  .article strong,.article a{color:inherit}.article blockquote{font-family:${k};background:none;border:0;padding:0 1em;margin:14px 0;color:inherit}
  .article .exam-passage{font-family:${(theme.baseId||theme.id)==='exam-chinese'?k:f}}
  .article .poem{font-family:${k};font-size:1em;line-height:1.9;margin:14px 0;padding:0}
  .article .math-display{background:none;border:0;border-radius:0;box-shadow:none;padding:6px 0;margin:12px 0}
  .article table:not([role=presentation]){border:1px solid #111;font-size:.9em;margin:14px 0}.article table:not([role=presentation]) th,.article table:not([role=presentation]) td{background:#fff;color:inherit;border:1px solid #111;padding:6px 8px}
  .article hr{border-top:1px solid #111;margin:24px 0}.article em{font-style:italic}
  `;
}
