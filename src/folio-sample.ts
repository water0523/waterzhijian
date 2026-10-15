import type {Asset} from './model';
import river from '../assets/folio/river.webp';
import handscroll from '../assets/folio/handscroll.webp';
import bamboo from '../assets/folio/bamboo.webp';
import lotus from '../assets/folio/lotus.webp';
export function folioAssets():Asset[]{
  return [[river,'river','寒江独钓','一叶扁舟，停在江水与留白之间。'],[handscroll,'handscroll','潇湘烟雨四景','烟雨、山岚、亭影、芦汀，连成一纸长卷。'],[bamboo,'bamboo','竹影窗棂','竹影与窗棂，留住一室清凉。'],[lotus,'lotus','残荷听雨','荷叶与雨痕，写下秋水的声音。']].map(([data,id,title,caption])=>({id:'folio-demo-'+id+'-v1',name:title+'.webp',mime:'image/webp',data,width:100,align:'center',alt:title+' · 原创水墨示例',caption,source:'纸间 · AI 生成水墨示例（imagegen）'}));
}
export const folioSample=`:::folio-masthead 总第拾捌辑
岁次丙午 · 暮春谷雨 · 初候萍始生
:::

# 山窗听雪录：在岁月的褶皱里，读一纸山水清欢

:::folio-byline
原创示例 / 纸间 · 水墨插图 / AI 生成 · [清欢]{font=kai color=#a2382d}
:::

:::folio-preface 卷首题记
古人把一扇窗，借给了一座山。雨声在书页间落下，竹影在旧墨里舒展；我们读一篇散文、一阕小词、几句题画诗，也给日常留一处可以安静坐下的地方。

—— 暮春示例，写在山窗之前
:::

## 壹 · 江南雨声里的旧宣纸
:::subtitle PROSE · 散文随笔卷

:::folio-prose
江南的春雨，向来是不肯急落的。它总是在青瓦檐角蓄着，蓄成一粒晶莹而微凉的玉珠，待到暮色四合，巷口卖栀子花的吆喝声远了，才顺着石板路的苔痕，悄无声息地漫漶开来。我坐在北窗之下，展读一页旧书，也读见纸背渐渐亮起的春光。

有时合上书页细想，所谓[风雅]{dots}，也在寻常人推窗见山的一声轻叹里。[草木得雨而青，人心得闲而静；只要檐前尚有一滴雨可读，案头尚有一盏茶可温，这人间便仍有值得珍惜的清欢。]{gold}

[一窗竹影，一纸春山。]{role=aside}把心放慢一点，便能听见雨丝在时间深处，替我们写下细小而郑重的句读。
:::

## 贰 · 词笺里的清欢
:::subtitle VERSE · 古典诗词卷

:::folio-ci 浣溪沙 · 山窗听雨
[此阕为原创排版示例，展示词牌、小序与韵脚微标；不作为格律校订范本。]{role=preface}

:::poem center
细雨初收小院[清]{role=rhyme}
竹窗疏影入书[棂]{role=rhyme}
一灯微暖照闲[庭]{role=rhyme}

旧墨未干春尚浅
远山如梦水无声
半窗烟雨半窗晴
:::
:::

:::folio-letter 尺牍 · 寄一位旧友
见字如晤：

春雨连绵，窗前新竹又添一节。今晨重读旧信，忽觉人与人的相遇，也像书页间偶然落下的一片叶子。愿你在忙碌之中，仍有一盏茶的闲暇。

纸间 敬上
:::

## 叁 · 雪夜旧文与朱砂评点
:::subtitle CLASSICS · 文言笺注卷

:::folio-classical 《湖心亭看雪》节选 · 明 张岱
崇祯五年十二月，余住西湖。大雪三日，湖中人鸟声俱绝。[朱批：以“绝”字收住声音，留白自有寒意。]{role=note}

是日更定矣[^geng]，余拏一小舟，拥毳衣炉火，独往湖心亭看雪。[朱批：一“独”字，先写出此行的心境。]{role=note}

雾凇沆砀，天与云与山与水，上下一白。[朱批：层叠的“与”字，连起了天地间无尽的白。]{role=note}

:::folio-gloss 典故笺注与字词考据
**更定：**这里用于演示词语考据的排版；正式刊发时请按采用的注本核对解释与出处。

**拏：**古籍异体字的显示取决于本机字体，遇到缺字时可换用宋体或其他字体。

**阅读提示：**可点击标题收起；内容较长时上下滚动。复制或导出会展开全部笺注。

**来源说明：**此处为排版功能说明，原文节选与批语分开，避免把现代批语误作古籍原文。
:::
:::

## 肆 · 阶梯与留白的呼吸
:::subtitle MODERN FREE VERSE · 现代新诗卷

:::folio-modern 《在谷雨的瓷器里打坐》
[原创新诗示例 · 阶梯缩进与行号标尺]{role=preface}

:::poem left
把一整场江南的春雨，装进
    宋代汝窑那道尚未冷却的冰裂纹里。
      ——叮的一声，
时间便在青釉深处结了霜。

我们谈论远山、竹影与失传的古琴谱，
  却对窗外呼啸而过的世纪保持沉默。
    你看，一片茶叶在沸水里缓缓舒展——
      它用粉身碎骨的浮沉，
        替我们还原了整座春山的呼吸。

不必追问明日的风吹向哪座渡口，
    当灯芯剪落最后一粒红烬，
      **留白处，自有万水千山。**
:::
:::

## 伍 · 山水入画与书页装裱
:::subtitle PAINTINGS · 水墨题画卷

:::folio-hanging 寒江独钓 · 立轴
![寒江独钓](asset:folio-demo-river-v1)

[一叶舟，半江雪。山色不语，静待归人。]{role=painting}
:::

:::folio-handscroll 潇湘烟雨 · 手卷四景
![潇湘烟雨长卷](asset:folio-demo-handscroll-v1)

> **一 · 烟雨**
>
> 雨从纸外来，山在墨中醒。

> **二 · 山岚**
>
> 远山一笔，留住片刻微茫。

> **三 · 亭影**
>
> 风过空亭，茶香尚温。

> **四 · 芦汀**
>
> 一水芦花，都是归路。
:::

:::folio-album 竹影与残荷 · 对开册页
:::gallery grid2 folio-album-example
![竹影窗棂](asset:folio-demo-bamboo-v1)
![残荷听雨](asset:folio-demo-lotus-v1)
:::
:::

:::folio-colophon 山窗听雪录 · 本辑牌记
示例撰文 / 纸间　·　图像 / AI 生成水墨示例

诗文示例与编排信息均可在 Markdown 中修改。古籍节选请标明采用版本；插图可替换为自己的作品，并在素材中填写图注与来源。

原始图片保留在源码包；本地预览可横向展卷或收起笺注，复制及导出采用完整的横排兼容内容。
:::

[^geng]: 脚注与行间朱批互不混淆，定义写在所有容器结束之后。
`;
