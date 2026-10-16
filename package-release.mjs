import {readFile,writeFile,readdir} from 'node:fs/promises';
import {zipSync,unzipSync} from 'fflate';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const files={};
const add=async name=>files['非水·成章/'+name]=new Uint8Array(await readFile(name));
for(const name of ['README.md','开发说明.md','CHANGELOG.md','RELEASE-v1.0.md','RELEASE-v1.0.1.md','使用说明.md','验收报告.md','主题升级说明.md','本轮更新说明.md','待续功能.md','主题格式规范-v1.md','主题示例/杉影札记.纸间主题.json','plans/product-polish.md','plans/journal-themes.md','plans/literary-folio.md','plans/digest-news-templates.md','期刊主题使用说明.md','package.json','package-lock.json','tsconfig.json','index.template.html','build.mjs','package-release.mjs','.gitignore'])await add(name);
for(const name of await readdir('src'))await add('src/'+name);
for(const name of ['山窗听雪使用说明.md','plans/literary-science-theme.md'])await add(name);
await add('新增模板与组件使用说明.md');
await add('plans/inline-style-picker.md');
await add('plans/hover-menus.md');
await add('plans/catalog-workspace.md');
await add('plans/selection-export-polish.md');
for(const name of ['docs/plans/2026-10-16-format-rewrite.md','主题格式改写提示词.md','tests/format-prompts.mjs','tests/format-rewrite.mjs','test-results/format-prompts.json','test-results/format-prompts-fixtures.json','test-results/format-rewrite-chrome.json','test-results/format-rewrite-msedge.json','dist/格式改写预览.png'])await add(name);
await add('tests/selection-export.mjs');
for(const channel of ['chrome','msedge'])await add('test-results/selection-export-'+channel+'.json');
await add('dist/导出选项预览.png');
await add('tests/catalog-workspace.mjs');
for(const channel of ['chrome','msedge'])await add('test-results/catalog-workspace-'+channel+'.json');
for(const name of ['工作区预览.png','收藏排序预览.png'])await add('dist/'+name);

await add('tests/hover-menus.mjs');
for(const channel of ['chrome','msedge'])await add('test-results/hover-menus-'+channel+'.json');
for(const name of ['inline-dropdowns.mjs','picker-helpers.mjs'])await add('tests/'+name);
await add('tests/toolbar-dropdowns.mjs');
for(const channel of ['chrome','msedge'])await add('test-results/toolbar-dropdowns-'+channel+'.json');
for(const channel of ['chrome','msedge'])await add('test-results/inline-dropdowns-'+channel+'.json');
await add('test-results/inline-dropdown-marker-chrome.png');
for(const name of ['edition-themes.mjs','component-workflow.mjs','rewrite.mjs','theme-browsing.mjs'])await add('tests/'+name);
for(const name of ['edition-themes-chrome.json','edition-themes-msedge.json','component-workflow-chrome.json','component-workflow-msedge.json','rewrite-chrome.json','rewrite-msedge.json','theme-browsing-chrome.json','theme-browsing-msedge.json'])await add('test-results/'+name);
await add('dist/三套新主题预览.png');
async function addTree(dir){for(const item of await readdir(dir,{withFileTypes:true})){const name=dir+'/'+item.name;if(item.isDirectory())await addTree(name);else await add(name);}}
await addTree('assets');
for(const name of ['folio-themes.mjs','folio-workflow.mjs'])await add('tests/'+name);
for(const name of ['folio-themes-chrome.json','folio-themes-msedge.json','folio-workflow-chrome.json','folio-workflow-msedge.json'])await add('test-results/'+name);
for(const name of ['verify.mjs','stickers.mjs','documents.mjs','themes.mjs','preview-editing.mjs','inline-styles.mjs','publishing-extras.mjs','interaction-upgrade.mjs','theme-gallery-images.mjs','image-output.mjs','strong-heading.mjs','theme-library.mjs','theme-schema.mjs','theme-typography.mjs','element-settings.mjs','theme-accessibility.mjs','storage-reliability.mjs','writing-core.mjs','writing-workflow.mjs','theme-review.mjs','theme-output.mjs','popover-layout.mjs','journal-themes.mjs'])await add('tests/'+name);
for(const name of ['report.json','stickers-report.json','documents-report.json','themes-report.json','themes-msedge-report.json','preview-editing-chrome.json','preview-editing-msedge.json','inline-styles-chrome.json','inline-styles-msedge.json','publishing-extras-chrome.json','publishing-extras-msedge.json','interaction-upgrade-chrome.json','interaction-upgrade-msedge.json','theme-gallery-images-chrome.json','theme-gallery-images-msedge.json','image-output-chrome.json','image-output-msedge.json','strong-heading-chrome.json','strong-heading-msedge.json'])await add('test-results/'+name);
for(const name of ['theme-library-chrome.json','theme-library-msedge.json','theme-schema.json','theme-typography-chrome.json','theme-typography-msedge.json'])await add('test-results/'+name);
for(const name of ['element-settings-chrome.json','element-settings-msedge.json','theme-accessibility-chrome.json','theme-accessibility-msedge.json'])await add('test-results/'+name);
for(const name of ['storage-reliability-chrome.json','storage-reliability-msedge.json','writing-core.json','writing-workflow-chrome.json','writing-workflow-msedge.json'])await add('test-results/'+name);
for(const name of ['theme-output-chrome.json','theme-output-msedge.json','popover-layout-chrome.json','popover-layout-msedge.json','review-chrome/report.json','review-msedge/report.json'])await add('test-results/'+name);
for(const name of ['journal-themes-chrome.json','journal-themes-msedge.json'])await add('test-results/'+name);
for(const name of ['popover-short-chrome.png','popover-compact-chrome.png','theme-output-blueprint-chrome.png'])await add('test-results/'+name);
for(const name of ['纸间-离线公众号排版器.html','THIRD_PARTY_NOTICES.txt','主题风格预览.png','科普主题库预览.png','青春读本预览.png','期刊主题预览.png','山窗听雪预览.png'])await add('dist/'+name);
for(const name of ['dist/非水·成章-离线公众号排版器.html','docs/plans/2026-10-16-brand-blue-headings.md','tests/heading-numbers.mjs','tests/identity-layout.mjs','test-results/heading-numbers.json','test-results/identity-layout-chrome.json','test-results/identity-layout-msedge.json','test-results/dropcap-measurements-chrome.json','test-results/dropcap-measurements-msedge.json','dist/非水成章-日间预览.png','dist/非水成章-夜间预览.png'])await add(name);
for(const name of ['docs/plans/2026-10-16-fullscreen.md','tests/fullscreen.mjs','test-results/fullscreen-chrome.json','test-results/fullscreen-msedge.json'])await add(name);
for(const name of ['assets/brand-logo.jpg','assets/brand-logo.md'])await add(name);
for(const name of ['docs/plans/2026-10-16-workbench-refinement.md','tests/workbench-refinement.mjs','tests/latex-completion.mjs'])await add(name);
for(const channel of ['chrome','msedge']){
  await add('test-results/workbench-refinement-'+channel+'.json');
  await add('test-results/latex-completion-'+channel+'.json');
}
await add('test-results/latex-completion-day-chrome.png');
await add('test-results/latex-completion-night-chrome.png');
for(const channel of ['chrome','msedge'])await add('test-results/header-links-'+channel+'.json');
for(const appearance of ['day','night'])await add('test-results/header-links-'+appearance+'-chrome.png');
for(const name of ['docs/plans/2026-10-16-startup-performance.md','tests/startup-performance.mjs'])await add(name);
await add('tests/startup-modules.mjs');
for(const channel of ['chrome','msedge']){
  await add('test-results/startup-performance-'+channel+'.json');
  await add('test-results/startup-sidebar-'+channel+'.png');
  await add('test-results/startup-modules-'+channel+'.json');
}
for(const name of ['docs/plans/2026-10-16-math-selection-styles.md','tests/math-selection-styles.mjs'])await add(name);
for(const channel of ['chrome','msedge']){
  await add('test-results/math-selection-styles-'+channel+'.json');
  for(const mode of ['day','night'])await add('test-results/math-selection-'+mode+'-'+channel+'.png');
}
for(const name of ['docs/plans/2026-10-16-multiblock-font.md','tests/multiblock-font.mjs'])await add(name);
for(const channel of ['chrome','msedge']){
  await add('test-results/multiblock-font-'+channel+'.json');
  for(const mode of ['day','night'])await add('test-results/multiblock-font-'+mode+'-'+channel+'.png');
}
for(const name of ['docs/plans/2026-10-16-multiblock-styles.md','tests/multiblock-styles.mjs'])await add(name);
for(const channel of ['chrome','msedge']){
  await add('test-results/multiblock-styles-'+channel+'.json');
  for(const mode of ['day','night'])await add('test-results/multiblock-styles-'+mode+'-'+channel+'.png');
}
const data=zipSync(files,{level:9});const verified=unzipSync(data);
for(const name of Object.keys(files))assert.deepEqual(verified[name],files[name]);
await writeFile('dist/非水·成章-源码与使用说明.zip',data);
await writeFile('dist/纸间-源码与使用说明.zip',data);
const html=await readFile('dist/纸间-离线公众号排版器.html');
const htmlHash=createHash('sha256').update(html).digest('hex'),zipHash=createHash('sha256').update(data).digest('hex');
await writeFile('dist/SHA256.txt',[[htmlHash,'非水·成章-离线公众号排版器.html'],[zipHash,'非水·成章-源码与使用说明.zip'],[htmlHash,'纸间-离线公众号排版器.html'],[zipHash,'纸间-源码与使用说明.zip']].map(([hash,name])=>hash+'  '+name+'\n').join(''));
console.log(`Packaged ${Object.keys(files).length} files, verified ZIP contents (${(data.length/1024/1024).toFixed(2)} MB)`);
