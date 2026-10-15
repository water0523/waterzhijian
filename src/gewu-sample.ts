import type {Asset} from './model';
export function gewuAssets():Asset[]{
 return ['wind','sky'].map((kind,index)=>{const c=document.createElement('canvas');c.width=1100;c.height=680;const x=c.getContext('2d')!;x.fillStyle='#faf7f1';x.fillRect(0,0,1100,680);x.strokeStyle='#d4c48e';x.strokeRect(20,20,1060,640);const arrow=(a:number,b:number,c:number,d:number,color:string)=>{x.strokeStyle=color;x.fillStyle=color;x.lineWidth=6;x.beginPath();x.moveTo(a,b);x.lineTo(c,d);x.stroke();const angle=Math.atan2(d-b,c-a);x.beginPath();x.moveTo(c,d);x.lineTo(c-20*Math.cos(angle-.4),d-20*Math.sin(angle-.4));x.lineTo(c-20*Math.cos(angle+.4),d-20*Math.sin(angle+.4));x.fill();};
  if(kind==='wind'){x.fillStyle='#e7dfd0';x.beginPath();x.moveTo(20,470);x.quadraticCurveTo(200,300,430,470);x.lineTo(1080,470);x.lineTo(1080,660);x.lineTo(20,660);x.fill();x.fillStyle='#6d879e';x.fillRect(390,470,450,190);x.fillStyle='#e8d6c6';x.fillRect(95,210,280,165);x.fillStyle='#e2e9ed';x.fillRect(725,210,280,165);x.font='30px "Microsoft YaHei",sans-serif';x.fillStyle='#9e2e30';x.fillText('较高气压',145,303);x.fillStyle='#315479';x.fillText('较低气压',775,303);arrow(395,290,695,290,'#9e2e30');x.font='25px "Microsoft YaHei",sans-serif';x.fillStyle='#67615b';x.fillText('仅表示气压梯度力的方向',365,415);x.font='23px SimSun,serif';x.fillText('概念示意 · 不对应具体地点与实测条件',315,610);}
  else{x.strokeStyle='#bba46f';x.lineWidth=4;x.beginPath();x.ellipse(550,335,370,190,0,0,Math.PI*2);x.stroke();x.strokeStyle='#315479';x.beginPath();x.ellipse(550,335,370,105,-.45,0,Math.PI*2);x.stroke();x.fillStyle='#9e2e30';x.beginPath();x.arc(550,335,16,0,Math.PI*2);x.fill();arrow(550,335,435,130,'#315479');x.font='28px SimSun,serif';x.fillStyle='#29261f';x.fillText('从不同坐标理解同一片天空',360,90);x.font='24px "Microsoft YaHei",sans-serif';x.fillStyle='#67615b';x.fillText('坐标与投影示意 · 非实测天象',365,610);}
  return{id:'gewu-'+kind+'-v1',name:(index?'天球坐标':'气压梯度')+'示意.png',mime:'image/png',data:c.toDataURL(),width:100,align:'center',alt:index?'天球坐标概念图':'气压梯度力概念图',caption:index?'▲ 图二 · 坐标与投影示意，非实测天象。':'▲ 图一 · 气压梯度力方向的概念示意，不代表完整风场。',source:'纸间 · 原生 Canvas 绘制，可替换为自己的插图'} as Asset;
 });
}
export const gewuSample=String.raw`:::gewu-masthead ◆ 格物文史 · 专题长文
文理共读 · 原创排版演示
:::

:::gewu-tags
[古典文学]{role=date}　[自然观察]{role=date}　[力学模型]{role=term}
:::

# 江风与书页：从一段古典文字，读懂观察的力量

:::gewu-byline
撰文 / 纸间 · 图示 / 原生绘制 · VOL. 042 · 排版演示
:::

:::gewu-preface 【卷首导读】
古典诗文常写风、水与星辰。文学先带来感受，科学模型则帮助我们追问条件、区分变量、核对证据。把两种阅读放在一起，不是替诗句贴上一个公式，而是让观察变得更细致。
:::

## 清风徐来：在感受之外，提出可以检验的问题
:::subtitle OBSERVATION & PHYSICAL MODELS

读到[宋代 · 文本节选]{role=date}中的“清风徐来，水波不兴”，我们先看见江面的宁静。若进一步讨论风与水面，就需要说明地点、时刻和观测尺度。[不能只凭一句描写，反推出唯一的气象条件。]{redline bold}

### ◆ 史料实录：先读原文，再做解释

:::gewu-quote 史料实录 · 苏轼《前赤壁赋》节选
“清风徐来，水波不兴。举酒属客，诵明月之诗，歌窈窕之章。”

—— 北宋 · 苏轼《前赤壁赋》
:::

从文学语境走向科学讨论，需要把[观察]{role=term}与[推断]{role=term}分开。原文提供了体验与意象；测量、模型和边界条件，则决定一种物理解释能走多远。

:::gewu-equation 物理模型推导 · 气压梯度力（式 1）
$$\vec{a}_p=-\frac{1}{\rho}\nabla p$$

:::gewu-symbols 符号释义
$\vec{a}_p$ 表示单位质量空气在气压梯度力作用下的加速度；$\rho$ 表示空气密度；$p$ 表示气压；$\nabla p$ 是气压的空间梯度。

负号说明这个力指向气压降低的方向。完整的风场还需要考虑其他作用，不能只用这一项还原某一天的江风。
:::
:::

:::gewu-figure
![气压梯度力示意](asset:gewu-wind-v1)
:::

:::gewu-knowledge ◆ 知新匣 · 模型、条件与解释
一个模型可以帮助我们整理问题，也有自己的适用范围：

- **先说明对象：**研究一团空气、一片水面，还是某个观测点？
- **再说明条件：**模型保留什么，忽略什么，尺度如何选择？
- **最后回到证据：**哪些结论来自测量，哪些仍是待验证的假设？

物理术语、数字和公式可以排得清楚，但排版不能替代事实核验。
:::

## 月出东山：诗文、坐标与观看的位置
:::subtitle POETRY & FRAMES OF REFERENCE

同一片天空，可以被写成诗句，也可以被描述为坐标。两种语言各有所长：诗文保存观看的心境，坐标让我们明确“从哪里看”。

:::gewu-poetry 〔宋 · 苏轼《前赤壁赋》节选〕
:::poem center
少焉，月出于东山之上，
徘徊于斗牛之间。
白露横江，水光接天。
:::

:::gewu-analysis 【文史共读】
阅读时可以先辨认意象与文体，再查注本中的字词和背景。若要讨论具体天象，需另有可靠的日期、地点、历法换算与星历资料；本示例不提供未经核验的天空位置。
:::
:::

:::gewu-figure
:::gallery grid2 gewu-concept-pair
![气压梯度](asset:gewu-wind-v1)
![天球坐标](asset:gewu-sky-v1)
:::
:::

:::gewu-aside ✦ 格物边注
术语用等宽字体帮助辨认，数学符号仍由公式引擎渲染。例如 $\Omega$、$\rho$ 与 $\Delta T$ 是数学符号，不能把未渲染的命令直接当成正文。
:::

## 古今交响：让文本、模型与证据相互照见
:::subtitle TEXTS, MODELS & VERIFICATION

:::gewu-timeline 跨学科阅读的三步
:::gewu-event 文本时代 · 北宋
**苏轼的江上文字**

先读篇章、修辞与语境，保留原文和出处，分清原文与现代编者的解释。
:::
:::gewu-event-gold 模型视角 · 今日阅读
**把问题转成变量**

明确讨论对象与假设，把定性描写和可测量的量对应起来，保留不确定性。
:::
:::gewu-event-blue 资料复核 · 继续探索
**让解释回到证据**

查阅可靠注本、测量记录与研究资料；没有证据的地方，就把问题留作问题。
:::
:::

### ◆ 定量对照：先明确需要什么证据

| 原文意象 | 可观察对象 | 模型变量 | 需要核验 |
| --- | --- | --- | --- |
| 清风徐来 | 近地风场 | 风速、风向、气压 | 时间、地点与测量条件 |
| 水波不兴 | 水面起伏 | 波高、流速、观测尺度 | 观测范围与误差 |
| 月出东山 | 视位置 | 时间、坐标、地平线 | 历法、地点与可靠星历 |

:::gewu-caption
▲ 表一 · 跨学科阅读的问题清单。此表不是对古代某次事件的数值还原。
:::

:::gewu-colophon 格物文史 · 寻绎字里行间的科学律令
撰文 / 纸间 · 制图 / 原生示意图 · 审校 / 你的名字

本篇为排版演示。古籍节选与现代说明分开标示；正文、公式、图注、来源均可编辑，图片仅承担插图本身。
:::
`;
