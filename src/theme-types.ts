import type {Typography} from './model';

export const themeGroups=['科普','文学','通用','试卷'] as const;
export const elementNames=['h1','h2','h3','quote','caption','table','list','code','formula','poem','divider'] as const;
export type ElementName=typeof elementNames[number];
export interface ElementStyle {
  font?:string; size?:number; weight?:number; italic?:boolean; lineHeight?:number;
  letterSpacing?:number; color?:string; background?:string; align?:'left'|'center'|'right'|'justify';
  marginTop?:number; marginBottom?:number; padding?:number; radius?:number;
  borderWidth?:number; borderColor?:string; borderStyle?:'solid'|'dashed'|'dotted'|'double';
  borderSide?:'all'|'top'|'bottom'|'left'|'right'; shadow?:'none'|'soft'|'offset';
}
export interface ThemeDefinition {
  id:string; name:string; group:typeof themeGroups[number]; description:string; base:string;
  palette:{accent:string;paper:string;ink:string};
  fonts?:{body?:string;heading?:string;quote?:string;caption?:string;code?:string;poem?:string};
  typography?:Typography;
  elements?:Partial<Record<ElementName,ElementStyle>>;
  ornaments?:{label?:string;mark?:string;numbered?:boolean;quoteLabel?:string;codeLabel?:string};
}
export interface ThemeFile {format:'zhijian-theme';version:1;theme:ThemeDefinition}
export interface ThemeLibraryFile {format:'zhijian-theme-library';version:1;themes:ThemeDefinition[];hidden:string[]}
export interface Theme {
  id:string;name:string;group:string;description:string;accent:string;paper:string;ink:string;
  font:string;variant:string;headingFont?:string;quoteFont?:string;captionFont?:string;codeFont?:string;poemFont?:string;
  defaults?:Typography; baseId?:string; definition?:ThemeDefinition;
}
