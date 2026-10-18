import {inspectWriting} from './source-analysis';
import type {RenderResult} from './render';
export interface PublishIssue{kind:string;severity:'error'|'warning'|'suggestion';line:number;title:string;detail:string}
export function publishIssues(source:string,result:RenderResult,hasImages:boolean,stickers:boolean):PublishIssue[]{
 const line=(value:string)=>Math.max(1,source.slice(0,Math.max(0,source.indexOf(value))).split('\n').length);
 return [...inspectWriting(source).map(i=>({...i,kind:'writing',severity:i.title.includes('组件')?'warning':'suggestion'} as PublishIssue)),
 ...result.errors.map(e=>({kind:'formula',severity:'error',line:e.line,title:'公式错误',detail:e.message} as PublishIssue)),
 ...result.missing.map(id=>({kind:'image',severity:'error',line:line(id),title:'图片缺失',detail:id} as PublishIssue)),
 ...result.external.map(url=>({kind:'network',severity:'warning',line:line(url),title:'存在网络图片',detail:'离线阅读需先导入本地副本。'} as PublishIssue)),
 ...(hasImages?[{kind:'platform',severity:'warning',line:1,title:'发布平台图片兼容',detail:'本地图片粘贴后可能需要补插，请检查图片是否保留。'} as PublishIssue]:[]),
 ...(stickers?[{kind:'sticker',severity:'warning',line:1,title:'贴纸发布兼容',detail:'自由叠放区域需要合成为图片；透明轮廓可能被平台过滤。'} as PublishIssue]:[])];
}
export const severityLabel={error:'错误',warning:'警告',suggestion:'建议'};
