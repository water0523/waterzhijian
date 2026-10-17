import {examSubjects} from './exam-themes';
const block=(kind:string,title:string,body:string)=>`:::exam-${kind}${title?' '+title:''}\n${body}\n:::`;
const question=(title:string,body='')=>block('question',title,body);
const options=(columns:number,...items:string[])=>block('options',String(columns),items.map((text,i)=>'- '+String.fromCharCode(65+i)+'. '+text).join('\n'));
const lines=(count=3)=>block('answer',String(count),'');
const math=(tex:string)=>'$$\n'+tex+'\n$$';
const key=(answers:string,analysis:string)=>':::exam-pagebreak\n\n'+block('key','参考答案',answers)+'\n\n'+block('analysis','解析',analysis);
function intro(id:string){const s=examSubjects.find(s=>s.id===id)!;return block('meta','','普通高等学校招生考试 · 仿真练习')+'\n\n# '+(s.name==='生物'?'生物学':s.name)+'\n\n'+block('meta','',`湖南高考版式 · 原创题型节选\n\n全卷参考：考试时间 ${s.minutes} 分钟，满分 ${s.score} 分。`)+'\n\n'+block('info','','姓名：____________　准考证号：________________________')+'\n\n'+block('notice','注意事项','1. 答题前，请填写姓名和准考证号。\n2. 选择题选出答案后，请将答案填写在相应位置；非选择题请写出必要过程。\n3. 本文为题型与排版示例，题量和分值不构成完整正式试卷。')+'\n\n';}
const join=(...parts:string[])=>parts.join('\n\n');
export const examSamples:Record<string,string>={
 'exam-chinese':intro('exam-chinese')+join(
  '## 一、现代文阅读（题型示例）',
  '阅读下面的文字，完成 1—2 题。',
  block('passage','让一座小馆成为公共空间','周末的社区图书馆，最先亮起的是靠窗的一排台灯。有人来借书，有人带着孩子读绘本，还有老人把自己的老照片放进了地方记忆专柜。管理员发现，读者停留的时间长了，对馆里的事情也更上心了。\n\n一次修缮前，图书馆邀请读者一起讨论。年轻人希望增加插座，老人提出保留安静的阅读区，孩子们则画出了心中的书架。改造没有追求醒目的装饰，而是让这些具体的需要各得其所。\n\n公共空间的价值，并不只在于容纳多少人，更在于不同的人能否在这里获得尊重。当一座小馆愿意听见细小的声音，它也就成为了社区共同生活的一部分。'),
  question('1．下列对材料相关内容的理解，正确的一项是（3 分）',options(1,'图书馆只应承担借阅图书的功能。','读者参与讨论，使修缮更贴近实际需要。','醒目的装饰是公共空间价值的决定因素。','延长开放时间是材料提出的唯一改进办法。')),
  question('2．材料第二段列举不同读者的建议，有什么作用？请简要分析。（4 分）',lines(3)),
  '## 二、古代诗文阅读（题型示例）',
  block('passage','阅读下面的文言语段，完成第 3 题。','山不在高，有仙则名。水不在深，有龙则灵。斯是陋室，惟吾德馨。苔痕上阶绿，草色入帘青。\n\n——刘禹锡《陋室铭》节选'),
  question('3．把“斯是陋室，惟吾德馨”翻译成现代汉语。（4 分）',lines(2)),
  block('passage','山居秋暝（王维）',':::poem center\n空山新雨后，天气晚来秋。\n明月松间照，清泉石上流。\n竹喧归浣女，莲动下渔舟。\n随意春芳歇，王孙自可留。\n:::'),
  question('4．“明月松间照，清泉石上流”描绘了怎样的画面？请从动静结合的角度赏析。（6 分）',lines(4)),
  '## 三、语言文字运用（题型示例）',
  question('5．下面的句子有语病，请在不改变原意的前提下修改。（3 分）','通过同学们共同努力，使校园的阅读氛围更加浓厚。\n\n'+lines(2)),
  '## 四、写作（题型示例）',
  question('6．阅读下面的材料，根据要求写作。（60 分）','有人认为，便利让我们更快抵达远方；也有人提醒，偶尔放慢脚步，才能看清身边的生活。\n\n以上材料引发了你怎样的联想与思考？请结合生活经验写一篇文章。选准角度，确定立意，明确文体，自拟标题；不要套作，不得抄袭，不得泄露个人信息；不少于 800 字。\n\n'+lines(6)),
  key("1．B。\n\n2．列举不同群体的需要，说明改造应倾听使用者。\n\n3．这是简陋的屋子，只是我的品德美好。\n\n4．以动衬静，表现山居秋夜的清幽。\n\n5．删去“通过”或“使”，并补充必要的结构助词。\n\n6．作文按切题、论证、结构与表达综合评价。",'1．B。\n\n2．具体呈现不同群体的需要，说明公共空间的改造应倾听使用者、尊重差异。\n\n3．这是简陋的屋子，只是我的品德美好（就不感到简陋了）。\n\n4．月光穿过松林，清泉流过山石；月与松构成安静背景，泉流带来动态，表现山居秋夜的清幽。\n\n5．示例：通过同学们的共同努力，校园的阅读氛围更加浓厚。\n\n6．作文可围绕效率与体验、技术与生活等展开，重在具体经验与充分论证；本示例不提供唯一立意。')
 ),
 'exam-math':intro('exam-math')+join(
  '## 一、单项选择题（题型示例）',
  question('1．已知集合 $A=\\{-1,0,1,2\\}$，$B=\\{x\\mid x^2\\leq1\\}$，则 $A\\cap B=$（5 分）',options(2,'$\\{0\\}$','$\\{0,1\\}$','$\\{-1,0,1\\}$','$\\{-1,0,1,2\\}$')),
  question('2．函数 $f(x)=x^2-2x$ 的最小值为（5 分）',options(4,'$-2$','$-1$','$0$','$1$')),
  '## 二、多项选择题（题型示例）',
  question('3．已知等差数列 $\\{a_n\\}$ 满足 $a_1=2$，$a_2=5$，则下列结论正确的有（6 分）',options(2,'公差 $d=3$。','$a_4=11$。','前 3 项和 $S_3=12$。','$a_{10}=29$。')),
  '## 三、填空题（题型示例）',
  question("4．已知函数 $f(x)=x^3$，则 $f^{\\prime}(1)=$ ____________。（5 分）"),
  question('5．已知向量 $\\vec a=(1,2)$，$\\vec b=(2,-1)$，则两向量的夹角为 ____________。（5 分）'),
  '## 四、解答题（题型示例）',
  question('6．已知关于 $x$ 的方程 $x^2-2ax+a^2-1=0$，其中 $a\\in\\mathbb R$。（12 分）','（1）求方程的两个实数根；\n\n（2）若两个根都在区间 $(0,4)$ 内，求 $a$ 的取值范围。\n\n'+lines(5)),
  question('7．一个盒子中有 3 个红球和 2 个蓝球，除颜色外完全相同。从中随机取出 2 个球。（12 分）','（1）求取出的两个球颜色相同的概率；\n\n（2）记取出的红球个数为 $X$，求 $X$ 的分布列及数学期望。\n\n'+lines(5)),
  key("1．C。 2．B。 3．ABD。 4．3。 5．90°。\n\n6．（1）a−1、a+1；（2）1<a<3。\n\n7．（1）2/5；（2）X 取 0、1、2 的概率分别为 1/10、3/5、3/10，期望为 6/5。","1．C。\n\n2．B；$f(x)=(x-1)^2-1$。\n\n3．ABD；$a_n=3n-1$，$S_3=15$。\n\n4．$3$；$f^{\\prime}(x)=3x^2$。\n\n5．$90^\\circ$；$\\vec a\\cdot\\vec b=0$。\n\n6．（1）$x_1=a-1$，$x_2=a+1$；（2）$1<a<3$。\n\n7．（1）$\\dfrac{\\binom32+\\binom22}{\\binom52}=\\dfrac25$。\n\n（2）$P(X=0)=\\dfrac1{10}$，$P(X=1)=\\dfrac35$，$P(X=2)=\\dfrac3{10}$，$E(X)=\\dfrac65$。")
 ),
 'exam-physics':intro('exam-physics')+join(
  '## 一、单项选择题（题型示例）',
  question('1．物体做匀速圆周运动时，下列说法正确的是（4 分）',options(1,'速度保持不变。','动能保持不变。','加速度为零。','合外力为零。')),
  question('2．一理想变压器原、副线圈匝数比为 $5:1$，原线圈接 $220\\,\\mathrm V$ 交流电，则副线圈电压为（4 分）',options(4,'$22\\,\\mathrm V$','$44\\,\\mathrm V$','$110\\,\\mathrm V$','$1100\\,\\mathrm V$')),
  '## 二、多项选择题（题型示例）',
  question('3．小球从离地 $20\\,\\mathrm m$ 高处以 $10\\,\\mathrm{m/s}$ 的初速度水平抛出。不计空气阻力，取 $g=10\\,\\mathrm{m/s^2}$，下列说法正确的有（5 分）',options(2,'落地时间为 $2\\,\\mathrm s$。','水平射程为 $20\\,\\mathrm m$。','落地时竖直速度大小为 $20\\,\\mathrm{m/s}$。','运动过程中加速度逐渐增大。')),
  '## 三、非选择题（题型示例）',
  question('4．某小组研究小车由静止开始的直线运动，得到下列模拟数据。（8 分）','| $t/\\mathrm s$ | 0.10 | 0.20 | 0.30 | 0.40 |\n| --- | --- | --- | --- | --- |\n| $x/\\mathrm m$ | 0.010 | 0.040 | 0.090 | 0.160 |\n\n（1）判断 $x$ 与 $t^2$ 的关系；\n\n（2）若小车做匀加速直线运动，求其加速度。\n\n'+lines(4)),
  question('5．质量为 $2.0\\,\\mathrm{kg}$ 的物块静止于水平面上，物块与水平面间的动摩擦因数为 $0.20$。用 $10\\,\\mathrm N$ 的水平恒力拉动物块，取 $g=10\\,\\mathrm{m/s^2}$。（12 分）','求：（1）物块的加速度；（2）$2.0\\,\\mathrm s$ 内的位移。\n\n'+lines(5)),
  question('6．一个 50 匝线圈中，每匝的磁通量在 $0.010\\,\\mathrm s$ 内均匀减少 $2.0\\times10^{-4}\\,\\mathrm{Wb}$。求感应电动势大小。（6 分）',math(String.raw`E=N\left|\frac{\Delta\Phi}{\Delta t}\right|`)+ '\n\n'+lines(3)),
  key("1．B。 2．B。 3．ABC。\n\n4．（1）位移正比于时间的平方；（2）2.0 m/s²。\n\n5．（1）3.0 m/s²；（2）6.0 m。\n\n6．1.0 V。",'1．B。\n\n2．B；$U_2=220/5=44\\,\\mathrm V$。\n\n3．ABC。\n\n4．（1）$x\\propto t^2$；（2）由 $x=\\tfrac12at^2$ 得 $a=2.0\\,\\mathrm{m/s^2}$。\n\n5．摩擦力 $f=\\mu mg=4.0\\,\\mathrm N$；$a=(F-f)/m=3.0\\,\\mathrm{m/s^2}$；$x=\\tfrac12at^2=6.0\\,\\mathrm m$。\n\n6．$E=1.0\\,\\mathrm V$。')
 ),
 'exam-geography':intro('exam-geography')+join(
  '## 一、选择题（材料组题示例）',
  block('passage','阅读材料，完成 1—3 题。','某地理学习小组以湖南一处位于 $28^\\circ\\mathrm N$ 附近的河谷村落为研究对象，整理出下列用于练习的模拟资料。村落以水田农业为主，西侧为山地，河流自西向东流过。\n\n| 月份 | 1 月 | 4 月 | 7 月 | 10 月 |\n| --- | --- | --- | --- | --- |\n| 月均温 / ℃ | 5 | 18 | 28 | 19 |\n| 月降水量 / mm | 50 | 140 | 160 | 70 |'),
  question('1．该地的主要气候类型为（3 分）',options(2,'温带海洋性气候','亚热带季风气候','热带沙漠气候','地中海气候')),
  question('2．若不考虑水库调节等因素，该河流最可能出现较大流量的季节为（3 分）',options(4,'冬季','夏季','秋季','全年相同')),
  question('3．夏至日，该村落正午太阳高度最接近（3 分）',options(4,'$28^\\circ$','$62^\\circ$','$85.5^\\circ$','$90^\\circ$')),
  '## 二、非选择题（题型示例）',
  question('4．阅读材料，完成下列要求。（12 分）','近年，该村在坡地开展果园经营。部分坡地在强降水后出现表土流失；村民计划采用等高种植、保留草带和设置排水沟等措施。\n\n（1）分析坡地表土流失可能加剧的自然和人为原因。\n\n（2）说明等高种植与保留草带对减轻水土流失的作用。\n\n'+lines(5)),
  question('5．阅读材料，完成下列要求。（12 分）','村落准备在河流下游原有荒滩建设小型湿地，不占用耕地，并保留自然河道。建设目标为改善水质、增加生境和提供自然教育场所。\n\n（1）说明湿地改善河流水质的主要途径。\n\n（2）从生态保护与公共使用的角度，提出两项管理建议。\n\n'+lines(5)),
  question('6．某同学计划比较村落水田与山地果园的土壤含水状况，请提出两项应控制的观测条件。（6 分）',lines(3)),
  key("1．B。 2．B。 3．C。\n\n4．强降水、坡度与地表植被状况等共同作用；等高种植和草带可减缓径流、拦截泥沙。\n\n5．沉降、植物吸收及微生物转化等；设置缓冲区、控制活动范围、开展监测与教育。\n\n6．相近天气与相同时段、相同取样深度和测定方法等。",'1．B。\n\n2．B。\n\n3．C；$H\\approx90^\\circ-|28^\\circ-23.5^\\circ|=85.5^\\circ$。\n\n4．强降水、坡度较大可增强径流侵蚀；植被破坏、不合理耕作会增加裸露地表。等高种植减缓坡面径流，草带拦截泥沙、固持土壤。\n\n5．通过沉降、植物吸收及微生物转化等改善水质；可设置生态缓冲区、控制游人活动范围、定期监测水质并开展生态教育。\n\n6．示例：在相近天气和同一时段观测；采用相同取样深度与测定方法。')
 ),
 'exam-english':intro('exam-english')+join(
  '## 第一部分　听力（文字情境示例）',
  '本示例以文字对话展示听力题型，不包含音频。',
  block('passage','',"W: Shall we meet at the library at nine on Sunday?\n\nM: The building opens at nine, but the volunteer team meets at half past nine.\n\nW: All right. I will be there on time."),
  question('1. When will the speakers meet?（1.5 分）',options(2,'At 9:00.','At 9:30.','At 10:00.')),
  '## 第二部分　阅读（题型示例）',
  '阅读下列短文，从每题所给的 A、B、C、D 四个选项中选出最佳选项。',
  block('passage','A · Saturday Book Care',"Our community library is looking for volunteers aged sixteen and over. Every Saturday from ten to twelve, a small team checks returned books and repairs damaged covers. You do not need previous experience. A librarian will provide a short training session before your first task.\n\nThe project started when student readers noticed that several favourite books could no longer be borrowed. Instead of buying new copies immediately, they asked whether the old ones could be repaired. Their idea has now become a regular activity. Volunteers say that careful work has helped them understand how shared resources can last longer.\n\nIf you would like to join, email the library with your name and the dates when you are available."),
  question('2. What is the main purpose of the activity?（2.5 分）',options(1,'To sell old books.','To care for shared library books.','To train professional writers.','To build a new library.')),
  question('3. What will new volunteers receive before their first task?（2.5 分）',options(2,'A free book.','A paid position.','A short training session.','A writing award.')),
  '## 第三部分　语言运用（题型示例）',
  question('4. Choose the best word to complete the sentence.（1 分）','She practised every day. ____________, she could explain her ideas clearly.\n\n'+options(2,'Finally','However','Instead','Otherwise')),
  question('5. Fill in each blank with one suitable word or the correct form of the word in brackets.（3 分）','The school garden, ____________ was built by students, has become a quiet place to read. Several ____________ (volunteer) look after it each week.'),
  '## 第四部分　写作（题型示例）',
  question('6. 应用文写作（15 分）',"假定你是李华，校英文报拟开展“爱护共享图书”主题活动。请给英国朋友 Alex 写一封邮件，邀请他参加。内容包括：\n\n（1）活动时间和地点；（2）主要内容；（3）邀请及期待。\n\n注意：写作词数应为 80 个左右。\n\nDear Alex,\n\n"+lines(5)+"\n\nYours,\n\nLi Hua"),
  question('7. 读后续写（题型片段，25 分）',"阅读下面的材料，根据内容和所给段落开头语续写两段。\n\nOn my first day as a library volunteer, I found a small note inside a damaged book. It said, “This story helped me through a difficult week. Please pass it on.” I did not know who had written it, but I decided to repair the cover as carefully as I could. When I finished, an elderly reader came to the desk and asked whether the book was ready.\n\n注意：完整续写词数应为 150 个左右；以下留白仅示范排版。\n\nThe reader smiled when I handed over the book.\n\n"+lines(3)+"\n\nA week later, I found another note on the volunteer desk.\n\n"+lines(3)),
  key("1\\. B. 2. B. 3. C. 4. A.\n\n5\\. which; volunteers.\n\n6\\. An email with the required activity details and an invitation.\n\n7\\. A continuation consistent with the repaired book and the notes.","1\\. B.\n\n2\\. B.\n\n3\\. C.\n\n4\\. A.\n\n5\\. which; volunteers.\n\n6\\. Cover the activity details, include a clear invitation, and use an appropriate email format.\n\n7\\. Keep the continuation consistent with the repaired book, the reader, and the notes. The story may develop around care for books and kindness between readers; no single ending is required.")
 ),
 'exam-biology':intro('exam-biology')+join(
  '## 一、单项选择题（题型示例）',
  question('1．下列结构中，原核细胞与真核细胞都具有的是（2 分）',options(4,'核膜','核糖体','叶绿体','线粒体')),
  question('2．用 $^{14}\\mathrm C$ 标记的二氧化碳研究植物光合作用，所追踪的主要是（2 分）',options(2,'水中氧的去向','碳元素进入有机物的过程','叶绿素中镁的来源','光能的波长变化')),
  '## 二、不定项选择题（题型示例）',
  question('3．在其他条件适宜时，可能影响植物净光合速率的因素有（4 分）',options(2,'光照强度','温度','二氧化碳浓度','是否在叶绿体基质中发生水的光解')),
  '## 三、非选择题（题型示例）',
  question('4．某小组研究温度对淀粉酶活性的影响，得到下列用于练习的模拟数据。各组酶液和淀粉溶液的初始浓度、体积及反应时间相同。（12 分）','| 温度 / ℃ | 0 | 25 | 37 | 80 |\n| --- | --- | --- | --- | --- |\n| 相对反应速率 | 0.1 | 0.7 | 1.0 | 0.0 |\n\n（1）指出本实验的自变量和因变量。\n\n（2）能否据此认定该淀粉酶的最适温度恰好为 37 ℃？说明理由。\n\n（3）为什么要保持各组初始浓度和体积相同？\n\n'+lines(5)),
  question('5．豌豆的黄色与绿色分别由 $A$、$a$ 控制，圆粒与皱粒分别由 $B$、$b$ 控制。两对基因独立遗传，完全显性，后代正常存活。两株基因型均为 $AaBb$ 的豌豆杂交。（12 分）','求子代中：（1）绿色皱粒的概率；（2）黄色圆粒的概率；（3）基因型为 $Aabb$ 的概率。\n\n'+lines(5)),
  question('6．在相同光照和温度下，某植物单位时间光合作用固定的二氧化碳量为 12 个相对单位，呼吸作用释放的二氧化碳量为 4 个相对单位。（6 分）','（1）该植物的净二氧化碳吸收量是多少？\n\n（2）若要比较两种植物的净光合速率，还应控制哪些条件？举两例。\n\n'+lines(3)),
  key("1．B。 2．B。 3．ABC。\n\n4．温度、相对反应速率；不能认定最适温度恰为 37 ℃；控制无关变量。\n\n5．（1）1/16；（2）9/16；（3）1/8。\n\n6．（1）8 个相对单位；（2）控制二氧化碳浓度、水分供应、叶面积或测定时长等。",'1．B。\n\n2．B。\n\n3．ABC；水的光解发生在类囊体薄膜上，D 的表述不正确。\n\n4．（1）自变量是温度，因变量是相对反应速率；（2）不能，只能说明所测试温度中 37 ℃ 的反应速率最高，应在其附近设置更密的温度梯度；（3）控制无关变量，使温度以外的条件一致。\n\n5．（1）$\\dfrac1{16}$；（2）$\\dfrac9{16}$；（3）$\\dfrac18$。\n\n6．（1）$12-4=8$ 个相对单位；（2）示例：二氧化碳浓度、水分供应、测定叶面积或测定时长等。')
 )
};
export const examComponentExamples=[
 ['meta','卷头信息','考试名称、时间与分值',block('meta','','普通高等学校招生考试 · 仿真练习\n\n考试时间 120 分钟，满分 150 分。')],
 ['info','考生信息','姓名、准考证号填写栏',block('info','','姓名：____________　准考证号：________________________')],
 ['notice','注意事项','试卷开头的作答说明',block('notice','注意事项','1. 请填写姓名和准考证号。\n2. 非选择题请写出必要过程。')],
 ['passage','阅读材料','材料标题与连续段落',block('passage','阅读下面的材料','清晨，图书馆打开了门。不同年龄的读者走进同一个空间，也带来了各自的阅读需要。')],
 ['question','题目','保留题号、分值与正文',question('1．已知 $f(x)=x^2-2x$，求其最小值。（5 分）',lines(2))],
 ['options','选项 · 两列','支持 1 / 2 / 4 列',options(2,'$-2$','$-1$','$0$','$1$')],
 ['answer','答题留白','1—12 行可调整',lines(3)],
 ['key','参考答案 · 宋体','可单独放在试卷末尾',block('key','参考答案','1．$-1$。')],
 ['analysis','解析 · 楷体','英文仍为 Times New Roman',block('analysis','解析','将 $f(x)=x^2-2x$ 配方，得 $f(x)=(x-1)^2-1$，因此当 $x=1$ 时取得最小值 $-1$。')]
] as const;
export const examComponentSample=examComponentExamples.map(c=>c[3]).join('\n\n');
