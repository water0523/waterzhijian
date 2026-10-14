import {richThemeCSS} from './theme-design';
import {fontStacks, type Typography} from './model';
export interface Theme { id:string; name:string; group:string; description:string; accent:string; paper:string; ink:string; font:string; variant:string; headingFont?:string }
export const themes: Theme[] = [
  {id:'rational',name:'理性蓝',group:'科普',description:'有条理，也有好奇心',accent:'#2563a6',paper:'#ffffff',ink:'#293647',font:'sans',variant:'bar'},
  {id:'academic',name:'学术简报',group:'科普',description:'沉稳的论述，清楚的证据',accent:'#3b4148',paper:'#ffffff',ink:'#303237',font:'serif',variant:'rule'},
  {id:'nature',name:'自然观察',group:'科普',description:'把目光交给万物',accent:'#486a47',paper:'#fafbf5',ink:'#354033',font:'sans',variant:'leaf'},
  {id:'cosmos',name:'宇宙来信',group:'科普',description:'从一束光，读到远方',accent:'#635299',paper:'#fcfcff',ink:'#33364b',font:'sans',variant:'cosmos'},
  {id:'math',name:'数理手札',group:'科普',description:'在推导之间留下思考',accent:'#2f526b',paper:'#ffffff',ink:'#27333e',font:'serif',variant:'theorem'},
  {id:'lab',name:'实验记录',group:'科普',description:'一步一步，让发现发生',accent:'#087f83',paper:'#ffffff',ink:'#263e42',font:'sans',variant:'steps'},
  {id:'earth',name:'地球档案',group:'科普',description:'大地有自己的时间',accent:'#947047',paper:'#fcfaf5',ink:'#4a4034',font:'serif',variant:'label'},
  {id:'tech',name:'科技前沿',group:'科普',description:'简练、锐利、面向未来',accent:'#255bd5',paper:'#ffffff',ink:'#253044',font:'sans',variant:'geometry'},
  {id:'qa',name:'科学问答',group:'科普',description:'每一个为什么，都值得回答',accent:'#ac561d',paper:'#fffdfa',ink:'#44362f',font:'sans',variant:'question'},
  {id:'magazine',name:'青春读本',group:'文学',description:'首字下沉、双色刊头与环绕插图，读一本温暖的杂志',accent:'#9c4c37',paper:'#fffdf6',ink:'#413c35',font:'serif',headingFont:'sans',variant:'magazine'},
  {id:'plain',name:'素笺',group:'文学',description:'留白，让文字自在呼吸',accent:'#706359',paper:'#fffdf7',ink:'#464039',font:'serif',variant:'plain'},
  {id:'ink',name:'墨韵',group:'文学',description:'一笔墨色，一点朱红',accent:'#a63d36',paper:'#fbf8ef',ink:'#302d29',font:'serif',headingFont:'kai',variant:'ink'},
  {id:'moon',name:'月下诗页',group:'文学',description:'让每一行，安静落下',accent:'#65778c',paper:'#f9fbfe',ink:'#404b5b',font:'serif',variant:'moon'},
  {id:'letter',name:'旧日书信',group:'文学',description:'纸短，情长',accent:'#8a624a',paper:'#fff8ea',ink:'#594537',font:'serif',headingFont:'kai',variant:'letter'},
  {id:'wild',name:'山野随笔',group:'文学',description:'带着风和草木的气息',accent:'#65704a',paper:'#fbfcf5',ink:'#454b3d',font:'serif',variant:'wild'},
  {id:'editorial',name:'编辑部',group:'通用',description:'像一本值得翻开的杂志',accent:'#222a31',paper:'#ffffff',ink:'#353b42',font:'sans',headingFont:'serif',variant:'editorial'},
  {id:'weekend',name:'周末长读',group:'通用',description:'给一篇好文章，多一点时间',accent:'#873d4d',paper:'#fffaf8',ink:'#453b3e',font:'serif',variant:'weekend'},
  {id:'mint',name:'清爽薄荷',group:'通用',description:'轻快地整理每一个想法',accent:'#258375',paper:'#fbfffd',ink:'#344943',font:'sans',variant:'card'},
  {id:'minimal',name:'极简留白',group:'通用',description:'只有文字，恰到好处',accent:'#42474d',paper:'#ffffff',ink:'#383d42',font:'sans',variant:'minimal'},
  {id:'orange',name:'橘子汽水',group:'通用',description:'橘色丝带与奶油引文，明快而有层次',accent:'#cb6222',paper:'#fffefa',ink:'#493a30',font:'sans',variant:'ribbon'},
  {id:'blueprint',name:'蓝图实验室',group:'科普',description:'蓝图封面、工程编号与坐标格纸',accent:'#245e9c',paper:'#ffffff',ink:'#2d4254',font:'sans',variant:'blueprint'},
  {id:'matcha',name:'抹茶手账',group:'文学',description:'纸胶带标题、植物色卡与手账留白',accent:'#687e3e',paper:'#fbfcf4',ink:'#444d36',font:'serif',variant:'tape'},
  {id:'berry',name:'莓果气泡',group:'通用',description:'圆形数字与莓果色气泡，轻盈鲜明',accent:'#ac3e76',paper:'#fffafd',ink:'#513f4a',font:'sans',variant:'bubble'},
  {id:'gold',name:'金色刊物',group:'文学',description:'香槟金双线边框与对称的刊物题签',accent:'#987837',paper:'#fffdf8',ink:'#494438',font:'serif',variant:'deco'},
  {id:'ocean',name:'深海电台',group:'科普',description:'深蓝封面与海浪分隔，安静有力量',accent:'#256a7e',paper:'#fcfeff',ink:'#324c55',font:'sans',variant:'ocean'},
  {id:'pixel',name:'像素信号',group:'科普',description:'荧光绿标签、硬边阴影与终端代码',accent:'#4c6834',paper:'#fffffa',ink:'#2c3c31',font:'sans',variant:'pixel'},
  {id:'sunset',name:'日落来信',group:'文学',description:'暖橘与珊瑚色渐层，柔软的弧形引文',accent:'#b96851',paper:'#fffdfa',ink:'#58413a',font:'serif',variant:'sunset'},
  {id:'lavender',name:'薰衣草札记',group:'文学',description:'紫色双线题签与花瓣般的章节标签',accent:'#88649e',paper:'#fffdfd',ink:'#4d4359',font:'serif',variant:'lavender'},
  {id:'newspaper',name:'复古报刊',group:'通用',description:'旧报头、衬线章节和双线剪报边框',accent:'#544b3b',paper:'#f9f5e9',ink:'#3e3b34',font:'serif',variant:'newspaper'},
  {id:'cream',name:'奶油便签',group:'通用',description:'奶黄色折角与便签卡片，适合知识清单',accent:'#927128',paper:'#fffef8',ink:'#514832',font:'sans',variant:'note'},
  {id:'terracotta',name:'赤陶画册',group:'文学',description:'赤陶封面、画册边框与大号章节数字',accent:'#a65f46',paper:'#fffbf6',ink:'#584338',font:'serif',variant:'gallery'},
  {id:'cartoon',name:'卡通手账',group:'通用',description:'笑脸星星、圆润贴纸与彩色手账引文',accent:'#a57543',paper:'#fffef8',ink:'#5a4a3c',font:'sans',variant:'cartoon'},
  {id:'arcade',name:'像素电玩',group:'通用',description:'游戏手柄、关卡编号与像素对话框',accent:'#3c7180',paper:'#fcfefd',ink:'#34475a',font:'sans',variant:'arcade'},
  {id:'kuromi',name:'库洛米灵感',group:'通用',description:'黑紫粉配色、小恶魔与甜酷心情卡片',accent:'#87569c',paper:'#fffaff',ink:'#4c3c54',font:'sans',variant:'kuromi'},
  {id:'pop',name:'波普漫画',group:'通用',description:'网点爆炸框、粗黑描边与高对比色块',accent:'#d33460',paper:'#fffefd',ink:'#343034',font:'sans',variant:'pop'},
  {id:'classical',name:'文言课本',group:'文学',description:'宋楷书页、朱红课题与旁批式引用',accent:'#9a5141',paper:'#fffdf6',ink:'#473f33',font:'serif',headingFont:'serif',variant:'classical'}
];
export const themeById = (id:string) => themes.find(t=>t.id===id) || themes[0];
export function themeCSS(theme: Theme, o: Typography = {}): string {
  const a = /^#[0-9a-f]{6}$/i.test(o.accent||'') ? o.accent! : theme.accent;
  const f = fontStacks[o.font||theme.font] || fontStacks.sans;
  const hf = fontStacks[o.headingFont||theme.headingFont||o.font||theme.font] || f;
  const size = Math.min(24,Math.max(12,Number(o.size)||16));
  const lh = Math.min(2.8,Math.max(1.3,Number(o.lineHeight)||(theme.id==='classical'?2.15:theme.group==='文学'?2:1.85)));
  const gap = Math.min(40,Math.max(0,o.paragraphGap??20));
  const padding = Math.min(48,Math.max(12,o.padding??24));
  const v = theme.variant;
  let special = '';
  if(v==='bar') special='.article h2{border-left:4px solid ACCENT;padding-left:12px}.article blockquote{background:#f1f6fc}';
  if(v==='rule') special='.article h1{font-size:27px;border-bottom:2px solid ACCENT;padding-bottom:18px}.article h2{border-bottom:1px solid #cdd0d3;padding-bottom:8px}.article blockquote{border-left:0;border-top:1px solid #ddd;border-bottom:1px solid #ddd;font-style:italic}';
  if(v==='leaf') special='.article h2{display:table;background:#eaf0df;padding:6px 14px;border-radius:2px 16px 2px 16px}.article blockquote{border-left:2px solid ACCENT;background:#f0f4e7}.article figure{padding:10px;background:#f0f3e9}';
  if(v==='cosmos') special='.article h1{background:#202f50;color:#fff;padding:26px 18px;font-size:27px}.article h2{border-bottom:1px solid #cbc4e2;padding-bottom:10px;letter-spacing:1px}.article .math-display{background:#f0edf7;border:1px solid #e3dcf0}.article blockquote{background:#f3f0fa}';
  if(v==='theorem') special='.article h2{font-size:19px;border-top:2px solid ACCENT;padding-top:10px}.article blockquote{border:1px solid #cdd9e2;border-left:4px solid ACCENT;background:#f8fafc}.article .math-display{padding:24px 8px;background:#f5f8fb}';
  if(v==='steps') special='.article h2{background:ACCENT;color:#fff;padding:8px 14px;border-radius:3px}.article th{background:ACCENT;color:#fff}.article ol{border-left:1px solid #c3dfde}.article blockquote{background:#eaf7f6}';
  if(v==='label') special='.article h2{display:table;background:#eee5d6;border-top:3px solid ACCENT;padding:6px 12px;letter-spacing:1px}.article figcaption{border-top:1px solid #ded1bd;padding-top:9px;text-align:left}.article hr{border-top:1px dashed ACCENT}';
  if(v==='geometry') special='.article h1{font-size:30px;letter-spacing:-1px}.article h2{border-left:8px solid ACCENT;border-bottom:1px solid #d7e0f7;padding:6px 12px}.article pre{border-radius:0;border-left:3px solid ACCENT}.article blockquote{background:#eff4ff}';
  if(v==='question') special='.article h2{background:#fff0df;border-radius:12px 12px 12px 0;padding:12px;color:ACCENT}.article blockquote{background:#fff6e9;border:1px solid #e8cdb0;border-radius:8px}.article strong{background:#fff0d9}';
  if(v==='plain') special='.article h1{font-size:27px;font-weight:500;line-height:1.65;margin-bottom:38px}.article h2{font-weight:500;margin-top:40px}.article blockquote{border:0;padding:10px 22px;color:#807469}.article hr{width:40px;margin:36px auto}';
  if(v==='ink') special='.article h1{text-align:center;letter-spacing:4px;font-weight:500;border-bottom:1px solid #d8cabc;padding-bottom:24px}.article h2{border-left:2px solid ACCENT;padding-left:14px;letter-spacing:2px}.article blockquote{border-left:0;border-right:2px solid ACCENT;font-family:KaiTi,STKaiti,serif;text-align:right}.article hr{width:30%;margin:32px auto;border-color:ACCENT}';
  if(v==='moon') special='.article h1,.article h2{text-align:center;font-weight:400;letter-spacing:3px}.article h1{margin:12px 0 38px}.article .poem{text-align:center;line-height:2.6;padding:16px 0}.article blockquote{border:0;text-align:center;color:#728196}.article hr{width:24px;margin:38px auto}';
  if(v==='letter') special='.article h1{font-weight:400;font-size:29px}.article h2{font-weight:400;border-bottom:1px dashed #c6b09a;padding-bottom:10px}.article blockquote{border:0;background:#f6ecda;padding:20px}.article hr{border-top:1px dashed #baa68c}.article figcaption{text-align:right}';
  if(v==='wild') special='.article h1{font-weight:500;letter-spacing:2px}.article h2{padding-top:16px;border-top:1px solid #c6cdb4;font-weight:500}.article blockquote{border:0;border-left:2px solid #a5b08a;font-style:italic}.article figure{margin:30px 0}.article hr{width:60px;margin:34px 0}';
  if(v==='editorial') special='.article h1{font-size:34px;line-height:1.35;border-top:6px solid ACCENT;padding-top:20px}.article h2{font-size:24px;border-bottom:2px solid ACCENT;padding-bottom:8px}.article blockquote{border:0;font-size:20px;font-family:Georgia,SimSun,serif}.article figcaption{text-align:left;letter-spacing:1px}';
  if(v==='weekend') special='.article h1{font-size:29px;line-height:1.6;margin-bottom:30px}.article h2{font-weight:500;display:table;border-bottom:3px solid #d8b8bf;padding-bottom:8px}.article blockquote{border:0;background:#f7edef;padding:22px}.article p{margin-bottom:26px}';
  if(v==='card') special='.article h2{background:#e8f6ef;padding:12px 16px;border-radius:10px}.article blockquote{border:0;background:#eef8f3;border-radius:10px}.article table{border:1px solid #c9e5da}.article .math-display{background:#f0faf5;border-radius:8px}';
  if(v==='minimal') special='.article h1{font-size:28px;font-weight:500;letter-spacing:-.5px}.article h2{font-size:20px;font-weight:600;margin-top:38px}.article blockquote{border:0;padding-left:0;color:#7b8085}.article strong{color:inherit}.article hr{border-color:#eceeef;margin:36px 0}';
  return `.article{box-sizing:border-box;padding:${padding}px;background:${theme.paper};color:${theme.ink};font-family:${f};font-size:${size}px;line-height:${lh};overflow-wrap:anywhere;text-align:left;word-break:normal}
  .article *{box-sizing:border-box}.article h1,.article h2,.article h3,.article h4,.article h5,.article h6{font-family:${hf};color:${a};line-height:1.5;font-weight:700;word-break:break-word;text-indent:0}
  .article h1{font-size:28px;margin:8px 0 28px}.article h2{font-size:21px;margin:30px 0 16px}.article h3{font-size:18px;margin:24px 0 12px}.article h4,.article h5,.article h6{font-size:16px;margin:20px 0 10px}
  .article p{margin:0 0 ${gap}px;text-indent:${(o.indent??theme.id==='classical')?'2em':'0'}}.article li p,.article blockquote p,.article .footnotes p{text-indent:0}.article strong{color:${a};font-weight:700}.article em{font-style:italic}.article a{color:${a};text-decoration:underline;text-underline-offset:3px}
  .article blockquote{margin:24px 0;padding:14px 18px;border-left:3px solid ${a};color:${theme.ink};background:#f5f6f7}.article blockquote p:last-child{margin-bottom:0}
  .article ul,.article ol{padding-left:26px;margin:16px 0 22px}.article li{padding-left:3px;margin:7px 0}.article hr{border:0;border-top:1px solid #dcdfe3;margin:30px 0}
  .article pre{margin:20px 0;padding:16px;background:#202936;color:#e6edf5;font:13px/1.75 Consolas,monospace;border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere}.article code{font-family:Consolas,monospace;font-size:.88em;background:#eef1f4;padding:2px 4px;border-radius:3px}.article pre code{background:transparent;color:inherit;padding:0;font-size:inherit}
  .article .hljs-keyword,.article .hljs-selector-tag{color:#dba9ef}.article .hljs-string,.article .hljs-attr{color:#b6d997}.article .hljs-number,.article .hljs-literal{color:#f2c38b}.article .hljs-comment{color:#8b9cab}.article .hljs-title{color:#8ecdec}
  .article table{border-collapse:collapse;width:100%;font-size:.88em;table-layout:fixed;margin:20px 0}.article th,.article td{border:1px solid #dce1e5;padding:9px 7px;word-break:break-word}.article th{background:#f0f3f6;font-weight:600}.article tr:nth-child(even) td{background:#fafbfc}
  .article figure{margin:24px 0;text-indent:0}.article img{max-width:100%;height:auto;vertical-align:middle}.article figcaption{font-size:12px;line-height:1.7;color:#80858b;text-align:center;margin-top:10px;text-indent:0}.article .image-wrap{display:block;text-indent:0}.article .missing-image{display:block;border:1px dashed #c59069;color:#966438;padding:16px;font-size:13px}
  .article .math-inline{display:inline-block;vertical-align:middle;max-width:100%;text-indent:0}.article .math-display{display:block;overflow-x:auto;text-align:center;padding:14px 4px;margin:20px 0;text-indent:0}.article mjx-container{max-width:100%;display:inline-block;margin:0!important}.article .math-display mjx-container{display:block}.article svg{max-width:100%;height:auto;vertical-align:middle}.article .math-error{color:#a43434;background:#fff0ed;font:13px/1.6 Consolas,monospace;white-space:pre-wrap;padding:8px;cursor:pointer}
  .article .poem{white-space:pre-wrap;line-height:2.3;margin:26px 0;padding:12px 0;text-indent:0}.article .poem[data-align=center]{text-align:center}.article .poem[data-align=left]{text-align:left}.article .footnotes{font-size:12px;color:#707880;margin-top:32px;border-top:1px solid #ddd;padding-top:12px}.article .footnotes p{margin:4px 0}.article .footnote-ref{font-size:11px}
  ${special.replaceAll('ACCENT',a)}
  ${richThemeCSS(theme,a)}
  ${theme.id==='magazine'?`.article{display:flow-root}.article p:has(.magazine-initial){text-indent:0}.article .magazine-initial{margin-left:${o.indent?size*2:0}px}`:''}
  .article .decorative-divider{color:${a}}
  ${o.headingFont?`.article h1,.article h2,.article h3,.article h4,.article h5,.article h6{font-family:${hf}}`:''}
  ${o.paragraphGap!==undefined?`.article p{margin-bottom:${gap}px}`:''}
  ${o.tableStyle==='three-line'?`.article table{border:0;border-top:2px solid ${theme.ink};border-bottom:2px solid ${theme.ink};border-radius:0}.article table th,.article table td{border:0;background:transparent;color:${theme.ink}}.article table th{border-bottom:1px solid ${theme.ink}}.article table tr:nth-child(even) td{background:transparent}`:''}
  ${o.tableStyle==='striped'?`.article table{border:0}.article table th,.article table td{border:0;border-bottom:1px solid #dce1e5}.article table th{background:${a}18;color:${theme.ink}}.article table tr:nth-child(even) td{background:${a}0c}`:''}
  ${o.tableStyle==='grid'?`.article table{border:1px solid #aeb8bd}.article table th,.article table td{border:1px solid #aeb8bd}.article table th{background:#f0f3f6;color:${theme.ink}}`:''}`;
}
