# Mermaid 四象限图 Implementation Plan

**Goal:** 在离线编辑器中直接阅读截图里的 Mermaid `quadrantChart` 和居中粗体图注，并随文章复制、导出。

**Architecture:** 使用 Markdown 围栏分流，只解析截图使用的标题、轴名、象限名、数据点。用 Canvas 输出内嵌高清 PNG，复用现有发布流程。单独识别严格限定的居中图注，保持原有 HTML 安全边界。

**Tech Stack:** TypeScript、Markdown-it、Canvas、Playwright。

- 实现与验证 → 在 `src/quadrant-chart.ts` 实现解析和绘制。用原截图的长中文标题、四个长象限名及八个拥挤的数据点验证。无法解析的四象限图保留源码并给出准确行号。其他语言的围栏照常渲染。
- 接入 → 在 `src/render.ts` 识别图表及图注，发布检查区分图表与公式问题。在 `src/slash-insert.ts` 提供四象限图模板，通过 `/quadrant` 和命令面板插入。Word 中图注可编辑并居中。
- 浏览器检查 → 在离线 HTML 验证移动画幅、HTML、剪贴板、Word 内嵌 PNG、原始 Markdown、无效数据修正与其他原始 HTML 行为。保留已有未提交改动，不将整库发布作为本次交付条件。
