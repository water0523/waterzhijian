export interface Typography {
  font?: string; headingFont?: string; size?: number; lineHeight?: number;
  paragraphGap?: number; padding?: number; accent?: string; indent?: boolean;
  tableStyle?: 'theme' | 'three-line' | 'striped' | 'grid';
}
export interface Asset {
  id: string; name: string; mime: string; data: string;
  width: number; align: 'left' | 'center' | 'right'; alt: string; caption: string;
  figureLabel?:string; source?:string;
}
export interface Sticker { id:string; assetId:string; line:number; x:number; offsetY:number; width:number; rotation:number; layout?:'free'|'wrap-left'|'wrap-right' }
export interface Revision { at: number; title: string; titleMode?:'auto'|'manual'; markdown: string; theme: string; typography: Typography; assets: string[]; stickers?:Sticker[] }
export interface Article {
  version: 1; id: string; title: string; markdown: string; theme: string;
  typography: Typography; assets: string[]; created: number; updated: number;
  deleted: boolean; revisions: Revision[]; stickers?:Sticker[]; folder?:string;
  titleMode?:'auto'|'manual';
}
export const uid = () => crypto.randomUUID();
export const freshArticle = (title = '未命名文章', markdown = ''): Article => ({
  version: 1, id: uid(), title, titleMode:'auto', markdown, theme: 'rational', typography: {},
  assets: [], created: Date.now(), updated: Date.now(), deleted: false, revisions: []
});
export function escapeHTML(s: string): string { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
export const fontStacks: Record<string, string> = {
  sans: '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif',
  serif: '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", SimSun, serif',
  kai: 'KaiTi, STKaiti, "Kaiti SC", serif',
  mono: 'Consolas, "Cascadia Code", monospace',
  hei: 'SimHei, "Heiti SC", "Microsoft YaHei", sans-serif',
  fang: 'FangSong, STFangsong, "Songti SC", SimSun, serif',
  times: '"Times New Roman", "Noto Serif CJK SC", SimSun, serif',
  georgia: 'Georgia, "Noto Serif CJK SC", "Songti SC", SimSun, serif',
  arial: 'Arial, "Microsoft YaHei", "PingFang SC", sans-serif'
};
export const fontNames: Record<string, string> = {sans:'微软雅黑 / 苹方',serif:'思源宋体 / 宋体',kai:'楷体',hei:'黑体',fang:'仿宋',times:'Times New Roman · 宋体回退',georgia:'Georgia · 宋体回退',arial:'Arial · 中文黑体回退',mono:'Consolas · 等宽'};
