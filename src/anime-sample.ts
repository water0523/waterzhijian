import type {Asset} from './model';
import type {AnimeKind} from './anime-blocks';
// Rasterize the local vector scene only on demand. Imported images and backups
// use the same supported PNG path as every other built-in illustration.
let illustration:string|undefined;
export function animeAssets():Asset[]{
 if(!illustration){
  const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=840;
  const x=canvas.getContext('2d')!;x.scale(2,2);const gradient=x.createLinearGradient(0,0,0,420);
  for(const [stop,color]of [[0,'#2c1b4d'],[.4,'#6e4594'],[.75,'#ff6b9d'],[1,'#ffd180']] as const)gradient.addColorStop(stop,color);
  x.fillStyle=gradient;x.fillRect(0,0,800,420);
  const circle=(cx:number,cy:number,r:number,color:string)=>{x.fillStyle=color;x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);x.fill();};
  for(const [cx,cy,r]of [[120,65,2],[240,40,2],[480,55,3],[660,80,2],[710,42,3]])circle(cx,cy,r,'#fff');
  x.lineWidth=8;x.strokeStyle='#b6e8ff';x.globalAlpha=.7;x.stroke(new Path2D('M160 70Q380 150 690 250'));x.globalAlpha=1;x.lineWidth=4;x.strokeStyle='#ffb8d9';x.stroke(new Path2D('M160 70Q360 185 620 275'));circle(160,70,8,'#fff');
  x.fillStyle='#ff9ebb';x.globalAlpha=.55;x.fill(new Path2D('M0 320Q90 270 180 305Q270 255 390 300Q510 245 630 295Q720 265 800 310V420H0Z'));x.globalAlpha=1;
  x.fillStyle='#3a2352';x.fill(new Path2D('M0 350Q130 305 260 340Q410 295 540 340Q680 300 800 345V420H0Z'));
  x.fillStyle='#1e1136';x.fill(new Path2D('m580 345 8-80h8l8 80'));circle(592,260,7,'#ffe082');circle(220,340,22,'#1e1136');x.fill(new Path2D('m203 325 5-17 10 14m4 0 10-14 5 17'));
  illustration=canvas.toDataURL('image/png');
 }
 return [{id:'anime-twilight-v1',name:'黄昏与猫.png',mime:'image/png',data:illustration,width:100,align:'center',alt:'粉紫暮色中的彗星、灯塔与猫咪剪影',caption:'黄昏与猫 · 主题插画示例'}];
}
export const animeComponentExamples:Record<AnimeKind,[string,string,string]>={
 banner:['关注引导','虚线糖果边框与圆角题签',':::anime-banner 星萌手记\n把一点好奇心，留给今天的天空。\n:::'],
 meta:['署名信息','轻量居中的作者与来源',':::anime-meta\n文 / 星萌手记 · 排版示例\n:::'],
 tags:['标签胶囊','行内代码变成轻盈小标签',':::anime-tags\n`动漫随笔` `光与颜色` `观察日常`\n:::'],
 quote:['胶带引文','暖黄便利贴与楷体摘录',':::anime-quote 观察手札\n傍晚不是白昼的句号，而是另一种颜色的开场。\n:::'],
 chat:['角色小剧场','左右气泡可嵌套、可改角色名',':::anime-chat 课后小剧场\n:::anime-left 小樱\n为什么我画的晚霞，总少一点空气感？\n:::\n:::anime-right 阿哲\n先看看亮部和暗部的冷暖关系吧。\n:::\n:::'],
 left:['左侧气泡','适合原有对话中的一位角色',':::anime-left 小樱\n把今天的晚霞，放进明天的速写本。\n:::'],
 right:['右侧气泡','缩进和柔色底的回应',':::anime-right 阿哲\n也把观察到的问题写在旁边。\n:::'],
 figure:['拍立得画框','原图、替代文字与图注保持完整',':::anime-figure\n![黄昏与猫](asset:anime-twilight-v1)\n:::'],
 panels:['分镜手记','顺序阅读，适合公众号粘贴',':::anime-panels 一天的两种颜色\n:::anime-panel 白昼\n阳光透过树叶，在桌面留下细碎光斑。\n:::\n:::anime-panel 黄昏\n晚风把云边的颜色，慢慢吹进窗里。\n:::\n:::'],
 panel:['分镜卡片','图片或原有段落均可使用',':::anime-panel 黄昏\n晚风把云边的颜色，慢慢吹进窗里。\n:::'],
 equation:['公式手札','离线数学公式与释义便签',String.raw`:::anime-equation 散射与波长
$$I \propto \frac{1}{\lambda^4}$$
:::anime-note
$I$ 表示散射光强，$\lambda$ 表示光的波长。
:::
:::`],
 note:['轻量便签','解释、图注、公式释义与补充',':::anime-note\n这是一段补充说明，可以放在公式手札里，也可以单独使用。\n:::'],
 profile:['设定档案','百分比表格自动添加静态属性条',':::anime-profile 今日观察档案\n| 项目 | 完成度 |\n| --- | --- |\n| 观察天空 | 90% |\n| 记录色彩 | 65% |\n:::'],
 spoiler:['彩蛋手记','始终展开，复制后保留全部内容',':::anime-spoiler 藏在页边的彩蛋\n给天空留一个空白页，下一次观察再来填写。\n:::'],
 footer:['互动尾卡','居中收束、署名或原有文末短句',':::anime-footer 下次见\n愿你每次抬头，都能遇到一点新鲜的颜色。\n:::']
};
export const animeComponentSample=Object.values(animeComponentExamples).map(x=>x[2]).join('\n\n');
export const animeSample=String.raw`:::anime-banner 星萌手记
把一点好奇心，留给今天的天空。
:::

# 黄昏里的小小魔法：把天空写进手记

:::anime-meta
文 / 星萌手记 · 原创排版示例
:::

:::anime-tags
¤动漫随笔¤ ¤光与颜色¤ ¤观察日常¤
:::

## 当颜色遇见好奇心

放学后的天空，像被轻轻揉开的水彩。**值得记住的瞬间**不一定宏大：一盏亮起的窗灯，一道粉紫色的云边，或是路口那只抬头的猫。

试着把[画面里的细节]{marker=#ffd6e5}记下来，再留一句自己的问题。*“今天的云，为什么有两种颜色？”* 这样的轻声自问，也能成为下一页的开场。~~这次一定画得完美~~，不如先认真看一眼。

:::anime-quote 观察手札
傍晚不是白昼的句号，而是另一种颜色的开场。
:::

:::anime-figure
![黄昏与猫](asset:anime-twilight-v1)
:::

### 给同一片天空画两格分镜

:::anime-panels 一天的两种颜色
:::anime-panel 白昼
阳光透过树叶，在桌面留下细碎光斑。
:::
:::anime-panel 黄昏
晚风把云边的颜色，慢慢吹进窗里。
:::
:::

## 把一个问题放进公式手札

当微粒尺度远小于波长时，可用瑞利散射的波长关系理解一个现象：短波光更容易被散射。行内写下 $d\ll\lambda$，再把关系放在独立卡片中。

:::anime-equation 散射与波长
$$I \propto \frac{1}{\lambda^4}$$

:::anime-note
$I$ 表示散射光强，$\lambda$ 表示光的波长。这里只比较波长依赖，不把示意关系当成完整的大气模型。
:::
:::

| 观察时刻 | 手记里的颜色 | 想记录的细节 |
| --- | --- | --- |
| 白昼 | 清浅的蓝 | 窗边树影 |
| 黄昏 | 粉紫与金橙 | 云层边缘 |

## 小剧场与今日档案

:::anime-chat 课后小剧场
:::anime-left 小樱
为什么我画的晚霞，总少一点空气感？
:::
:::anime-right 阿哲
先看看亮部和暗部的冷暖关系吧。也把观察到的问题写在旁边。
:::
:::

:::anime-profile 今日观察档案
| 项目 | 完成度 |
| --- | --- |
| 观察天空 | 90% |
| 记录色彩 | 65% |
:::

下面的代码只作排版示例，参数可以随观察记录调整。

~~~python
def wavelength_ratio(short_nm, long_nm):
    return (long_nm / short_nm) ** 4

print(wavelength_ratio(450, 680))
~~~

:::anime-spoiler 藏在页边的彩蛋
给天空留一个空白页，下一次观察再来填写。这个区域保持展开，复制和导出时不会漏掉内容。[^note]
:::

---

:::anime-footer 下次见
愿你每次抬头，都能遇到一点新鲜的颜色。
:::

[^note]: 示例文字、人物与百分比只用于展示排版，可直接替换成你的文章。
`.replaceAll('¤','`');
