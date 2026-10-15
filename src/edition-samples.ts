import type {Asset} from './model';
import harbor from '../assets/edition/harbor.webp';
import servers from '../assets/edition/servers.webp';
import workbench from '../assets/edition/workbench.webp';
import {gewuAssets,gewuSample} from './gewu-sample';
export function editionAssets():Asset[]{
 const c=document.createElement('canvas');c.width=1200;c.height=760;const x=c.getContext('2d')!,sky=x.createLinearGradient(0,0,0,760);sky.addColorStop(0,'#263b54');sky.addColorStop(.55,'#e7b083');sky.addColorStop(1,'#e6c494');x.fillStyle=sky;x.fillRect(0,0,1200,760);x.fillStyle='#f8d796';x.beginPath();x.arc(320,300,105,0,Math.PI*2);x.fill();x.fillStyle='#365b64';x.fillRect(0,480,1200,280);x.fillStyle='#233d44';x.beginPath();x.moveTo(650,760);x.lineTo(780,470);x.lineTo(1200,500);x.lineTo(1200,760);x.fill();x.fillStyle='#eee7cc';x.beginPath();x.moveTo(830,545);x.lineTo(865,240);x.lineTo(925,240);x.lineTo(960,545);x.fill();x.fillStyle='#b75a45';x.fillRect(852,305,83,28);x.fillRect(845,402,98,28);x.fillStyle='#293f46';x.fillRect(860,210,70,48);x.beginPath();x.moveTo(845,210);x.lineTo(895,170);x.lineTo(945,210);x.fill();x.fillStyle='#ffe7a6';x.fillRect(872,223,46,19);x.fillStyle='#ffe8a329';x.beginPath();x.moveTo(895,230);x.lineTo(290,150);x.lineTo(290,300);x.closePath();x.fill();x.strokeStyle='#e1d0b377';x.lineWidth=3;for(let i=0;i<7;i++){x.beginPath();x.moveTo(40+i*23,540+i*29);x.lineTo(520+i*38,540+i*29);x.stroke();}
 const built:Asset={id:'edition-lighthouse-v1',name:'日落灯塔.png',mime:'image/png',data:c.toDataURL(),width:100,align:'center',alt:'原创日落灯塔矢量风插图',caption:'在日落之前，给归途留一盏灯。',source:'纸间 · 原创 Canvas 插画'};
 return[built,...[[harbor,'harbor','港口','▲ 演示图一 · 蓝调时分的港口'],[servers,'servers','机房','▲ 演示图二 · 研究机房'],[workbench,'workbench','工作台','▲ 演示图三 · 传感器工作台']].map(([data,id,name,caption])=>({id:'edition-'+id+'-v1',name:name+'.webp',mime:'image/webp',data,width:100,align:'center' as const,alt:name+' · AI 演示图',caption,source:'AI 生成排版演示图，非真实新闻现场（imagegen）'})),...gewuAssets()];
}
export const digestSample=String.raw`:::digest-masthead 拾光漫读
2026 年 · 排版示例辑 / 总第 001 辑

YOUTH DIGEST · 温暖日常的精神手账
:::

:::digest-category ✦ 人物 · 世相
P. 28 — 33 · 原创示例
:::

# 把生活调成慢速档：在日常里，留一盏灯

:::digest-byline
文 / 纸间 · 原创排版示例 · 荐稿 / 你的名字
:::

:::digest-note 卷首手记 · EDITOR’S NOTE
我们总想着快一点，快一点走完一段路，快一点得到一个答案。可有些风景，要等脚步慢下来，才会从车窗外走进心里。

—— 写给认真生活的你
:::

秋天的小城，到了傍晚便慢下来。旧书店的灯亮着，店主把一张小椅子搬到门口，等路过的人坐一会儿。[一杯茶、一页书，都是把日常重新读一遍的办法。]{marker}

他说：“[不必把每一分钟都填满，有些留白，也是生活的一部分。]{wave color=#d64535}”

:::digest-polaroid
![日落灯塔](asset:edition-lighthouse-v1)
:::

## 在小故事里，看见彼此
:::subtitle SMALL STORIES · 日常微光

:::digest-stories 微故事三折 · 向右翻一页
:::digest-story 故事一 · 书页里的车票
一张旧车票从书里落下来。她想起那次没有目的地的短途旅行，窗外的田野很绿，身旁的人睡得很安稳。
:::

:::digest-story 故事二 · 留给晚归者的灯
楼道里的灯总比别处晚熄。邻居说，想让最后回家的人也能看清台阶。原来温柔，也可以是一件很小的事。
:::

:::digest-story 故事三 · 没有寄出的信
他把写给十年后的信放进抽屉。多年以后再读，才发现那些没完成的愿望，也曾陪他认真走过很长一段路。
:::
:::

:::digest-quote 文摘金句 · 原创示例
生命里有许多值得慢慢经过的地方。把一个普通的下午过得认真，也是一种向前。

—— 摘自本示例 · 第 32 页
:::

:::digest-epiphany 文摘漫评 · 火柴盒点睛
所谓成长，也许就是学会把注意力交还给眼前的人和事。一个温柔的比喻，可以写成这样的式子：

$$L=\int_0^T a(t)\,\mathrm{d}t+C$$

这里 $a(t)$ 比喻日常的专注，$C$ 比喻偶然的欢喜；它只是文学表达，不是科学定律。
:::

:::digest-footer 补白 · 读者微语
**今日留白：**记下一件不需要赶时间的小事。

**写给读者：**正文、页码、署名、图注都能自行替换；本模板为独立风格设计，与任何刊物无官方关系。装饰条码不代表正式刊号。
:::
`;
export const pressSample=String.raw`:::press-masthead COVER STORY · 封面特稿
READ · 排版演示 / 非真实报道
:::

# 算力走向海边：一篇深度特稿的阅读现场

:::press-deck
当技术走进日常，我们如何把复杂的议题讲清楚？用提要建立全局，用数据呈现差异，再让现场细节和人物声音把故事接起来。
:::

:::press-byline
示例撰文 / 纸间 · 插图 / AI 生成 · 编辑 / 你的名字

发自 虚构研究港 · 2026 年排版演示
:::

:::press-brief 30-SECOND EXECUTIVE BRIEF · 核心提要
1. **从问题出发：**这是一篇展示新闻排版的虚构示例，图片、场景和数据不作为现实证据。
2. **用数据说清差异：**四项指标与条形图来自下方可编辑的 Markdown 表格。
3. **让阅读有层次：**时间轴、访谈和档案卡，把背景与主线分开。
:::

凌近傍晚，研究港的灯陆续亮起。船边的一张工作台上，几根电缆还没有收好。技术故事的开头，有时不是宏大的数字，而是一个仍在等待回答的问题。

:::press-photo
![研究港](asset:edition-harbor-v1)
:::

## 把问题，放回现场
:::subtitle SECTION 01 · OBSERVATION & EVIDENCE

我们可以写下观察，也应当清楚区分观察、推测与结论。下面的引文是原创排版演示，不代表真实受访者的发言。

:::press-pullquote
“一篇好的调查，不只给出答案，也让读者看见答案从哪里来。”

—— 虚构访谈 · 排版示例
:::

:::press-data DATA JOURNALISM · 演示数据看板
| 演示指标 | 数值 |
| --- | --- |
| 采样时长 | 24 h |
| 观测点位 | 12 |
| 已复核记录 | 86% |
| 待核问题 | 4 |

| 方案 | 演示得分 |
| --- | --- |
| 方案 A | 82 |
| 方案 B | 65 |
| 方案 C | 49 |

数据来源：人为构造的排版演示数据，无现实统计含义。改第二张表的数值即可更新图形；无效数值会保留普通表格。
:::

:::press-photos 现场图集 · 左右查看
:::gallery grid3 press-demo-scenes
![港口](asset:edition-harbor-v1)
![研究机房](asset:edition-servers-v1)
![工作台](asset:edition-workbench-v1)
:::
:::

:::press-timeline CHRONOLOGY · 研究记录示例
:::press-event 阶段 01 · 提出问题
明确要观察的对象，写下假设和需要补充的证据。
:::
:::press-event 阶段 02 · 比较方案
把不同方案放在同一尺度下，说明比较条件与局限。
:::
:::press-keyevent 阶段 03 · 复核关键证据
将关键记录交叉核对，再决定哪些结论可以写入正文。
:::
:::

## 听见问题背后的人
:::subtitle SECTION 02 · QUESTIONS & CONTEXT

:::press-interview HARDTALK INTERVIEW · 现场交锋实录
:::press-q 示例记者
读者怎样判断，一项看起来很漂亮的数据是否可靠？
:::
:::press-a 虚构研究者
先看数据的来源、测量条件和样本范围，再看有没有说明误差或不确定性。这里的回答仅用来演示访谈版式。
:::
:::

:::press-dossier 名词深读档案 · 能效指标示例
能效指标要说明分子、分母与边界。下面只演示公式与符号混排：

$$\eta=\frac{E_{\mathrm{useful}}}{E_{\mathrm{total}}}$$

其中 $E_{\mathrm{useful}}$ 为有效能量，$E_{\mathrm{total}}$ 为总能量。正式报道应按具体定义和资料核对。
:::
`;
export const editionSamples:Record<string,string>={digest:digestSample,press:pressSample,gewu:gewuSample};
