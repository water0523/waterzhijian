# Format rewrite prompts implementation plan

**Goal:** 在同步滚动左边提供主题排版提示词，复制给外部 AI 后仅添加已支持的格式，不改原文。

**Architecture:** `src/format-prompts.ts` 根据主题的内置基础类型生成本地提示词；标签名单复用实际解析器的目录。`src/format-rewrite.ts` 提供主题选择、只读预览、复制提示词 / 提示词连同原文及手动复制回退，不发送网络请求或修改 Article。

**Tech Stack:** TypeScript、现有 dialog、Clipboard API、Markdown 渲染器、Playwright 电脑浏览器。

1. 在 `src/format-prompts.ts` 定义六套专用主题与普通主题回退、通用原文保留协议、完整语法及保守使用原则；排除已取消的竖排诗词。
2. 在 `src/format-rewrite.ts` 显示当前主题对应的提示词，允许选择其他专用主题，提供两种复制；复制失败选择文本并如实提示。附带原文时用不会与原文碰撞的边界。
3. 在 `index.template.html` 的同步滚动按钮前添加「格式改写」，`src/app.ts` 绑定，`src/studio.css` 适配桌面日夜布局。选择提示词不切换正式主题。
4. 新建 `tests/format-prompts.mjs` 核对六套和自定义继承规则；将语法示例交给真正渲染器验证容器、公式、嵌套、图片语法，并检查标签名单不漂移。
5. 新建 `tests/format-rewrite.mjs`，Chrome / Edge 检查按钮位置、当前主题、切换、实际剪贴板、附带原文逐字保留、失败回退、浏览不改稿不联网、键盘及 1280 / 1024 电脑布局。
6. 完成类型检查、构建与必要回归，更新说明、源码包及校验值，保留本地提交。

不调用真实 AI；提示词要求 AI 静默逐字核对，不能将语法验证说成已验证任意外部模型输出。
