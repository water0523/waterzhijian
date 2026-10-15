import {uid,type Asset} from './model';
export const journalSample=String.raw`# 信息为什么也有物理的重量

:::abstract
如果把一杯热水和一杯冷水混合，它们终将变成温水。一个思想实验却追问：如果能够逐个辨认分子的运动，能否让热量逆着通常的方向流动？从这个问题出发，我们沿着**热、无序与信息**之间的线索，读懂一比特信息的物理代价。

- **▸ 核心追问 01：**微观运动与宏观不可逆之间，隔着什么？
- **▸ 核心追问 02：**为什么“擦除记忆”也会与热发生联系？
:::

## 不可逆的时间之箭与微观精灵
:::subtitle THE ARROW OF TIME & MAXWELL'S DEMON

把宏观现象与微观状态联系起来，热力学熵提供了一种清楚的描述语言。正文采用现代无衬线字体，让概念、数字与推理自然衔接。

:::equation
$$
S=k_B\ln\Omega\qquad\Longrightarrow\qquad\Delta S_{\mathrm{universe}}\geq0
$$

**符号释义：**$S$ 表示熵；代码样式的常数 \`k_B ≈ 1.38×10⁻²³ J/K\` 表示玻尔兹曼常数；$\Omega$ 表示微观状态数。
:::

> 设想一个被隔板分成两部分的容器，中间有一扇很轻的小门。思想实验中的观察者辨认分子的运动，并选择打开或关闭这扇门。
>
> —— 据麦克斯韦妖思想实验改写，用于展示科学史引文样式

![麦克斯韦妖思想实验示意图](JOURNAL_FIGURE)

## 一比特信息的能量代价
:::subtitle INFORMATION & THE PHYSICAL WORLD

正文中的**关键结论**使用淡金色标记。标题采用人文衬线体，引文则采用楷体回退链。三种声音各有位置，整篇仍然保持安静的阅读节奏。

:::theorem 核心定律 · 兰道尔原理
在相应的热力学条件下，逻辑不可逆地擦除一比特信息，与向环境排放至少 $k_BT\ln2$ 的热量下限相联系。应用结论时，需要区分过程、条件与测量对象。
:::

### 从一个可计算的模型开始

:::derivation 数学物理推导专栏 · 理想气体单分子等温膨胀
**第一步（状态关系）：**在理想模型中，单个分子的气体与温度为 $T$ 的热浴接触，满足 $PV=k_BT$。

**第二步（等温膨胀功）：**比较体积从 $V/2$ 到 $V$ 的可逆等温膨胀，写出机械功：

$$
W_{\mathrm{ext}}=\int_{V/2}^{V}P\,dV
=\int_{V/2}^{V}\frac{k_BT}{V}\,dV
=k_BT\ln2
$$

**第三步（读懂条件）：**这里的等式来自指定的理想过程，不意味着任意装置都能达到这一数值。写作时把假设放在公式附近，可以减少误解。

**第四步（回到问题）：**把物理状态、信息记录与完整循环分别说明，读者才能判断能量如何交换。
:::

## 把不同视角放在一起
:::subtitle FROM THERMODYNAMICS TO INFORMATION

| 观察视角 | 关键词 | 示例关系 | 关注点 |
| --- | --- | --- | --- |
| 经典热力学 | 状态与过程 | $dS\geq\delta Q/T$ | 宏观过程的方向与限制 |
| 统计物理 | 微观状态 | $S=k_B\ln\Omega$ | 用微观状态理解宏观规律 |
| 信息热力学 | 记录与擦除 | $Q\geq k_BT\ln2$ | 逻辑操作与物理过程的联系 |

:::takeaways
1. **先看问题，再看公式：**公式卡把表达式与符号解释放在一起。
2. **区分证据与条件：**定律卡提炼结论，推导专栏保留过程。
3. **保留可追溯的资料：**图号、图注、来源与参考文献帮助读者继续查证。[^note]
:::

:::references
[1] Maxwell, J. C. (1871). *Theory of Heat*.

[2] Szilard, L. (1929). Über die Entropieverminderung in einem thermodynamischen System bei Eingriffen intelligenter Wesen.

[3] Landauer, R. (1961). Irreversibility and Heat Generation in the Computing Process.
:::

[^note]: 本文是排版与写法演示。正式科普稿应核对原始资料、术语与结论的适用条件。
`.replaceAll('\\`','`');

// Gallery previews need no external or missing illustration asset.
export const journalPreviewSample=journalSample.replace(/!\[[^\n]*\]\(JOURNAL_FIGURE\)\n/,'');
export function journalFigure():Asset{
  const canvas=document.createElement('canvas');canvas.width=960;canvas.height=460;const c=canvas.getContext('2d')!;
  c.fillStyle='#f8f9fb';c.fillRect(0,0,960,460);
  for(const [x,color,label,sub] of [[30,'#e8f2ff','A 腔 · 分子运动示意','蓝色区域'],[490,'#fff0f0','B 腔 · 分子运动示意','红色区域']] as const){c.fillStyle=color;c.strokeStyle=x===30?'#93bce8':'#e6a2a6';c.lineWidth=3;c.beginPath();c.roundRect(x,20,440,350,16);c.fill();c.stroke();c.fillStyle=x===30?'#254c8a':'#9c323c';c.font='bold 22px "Microsoft YaHei",sans-serif';c.fillText(label,x+22,61);c.font='16px "Microsoft YaHei",sans-serif';c.fillText(sub,x+22,88);}
  c.strokeStyle='#657185';c.lineWidth=6;c.beginPath();c.moveTo(480,0);c.lineTo(480,150);c.moveTo(480,247);c.lineTo(480,385);c.stroke();
  const dots=[[130,150,1],[220,290,1],[350,225,1],[630,155,-1],[800,260,-1],[660,315,-1]];
  for(const [x,y,direction] of dots){c.strokeStyle=direction>0?'#2f6edb':'#d4343b';c.fillStyle=c.strokeStyle;c.lineWidth=3;c.beginPath();c.moveTo(x,y);c.lineTo(x-direction*38,y-24);c.stroke();c.beginPath();c.arc(x,y,14,0,Math.PI*2);c.fill();}
  c.strokeStyle='#d08a22';c.lineWidth=7;c.beginPath();c.moveTo(465,155);c.lineTo(498,242);c.stroke();c.strokeStyle='#d4343b';c.lineWidth=4;c.beginPath();c.moveTo(395,200);c.lineTo(558,200);c.stroke();c.fillStyle='#d4343b';c.beginPath();c.moveTo(570,200);c.lineTo(550,190);c.lineTo(550,210);c.fill();
  c.fillStyle='#e5eaf0';c.beginPath();c.roundRect(30,396,900,42,7);c.fill();c.fillStyle='#465467';c.font='17px "Microsoft YaHei",sans-serif';c.textAlign='center';c.fillText('思想实验示意 · 通过小门与分子运动，提出关于热与信息的问题',480,423);
  return {id:uid(),name:'信息与热-示意图.png',mime:'image/png',data:canvas.toDataURL('image/png'),width:100,align:'center',alt:'两个腔室、分子和中间小门的示意图',caption:'麦克斯韦妖思想实验。图中仅示意腔室、分子与小门的位置，完整结论需要结合正文条件阅读。',figureLabel:'图 1',source:'纸间内置示意图 · Canvas 绘制'};
}
