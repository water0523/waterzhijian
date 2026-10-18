import {inspectWriting} from './source-analysis';
import type {RenderResult} from './render';
export interface PublishIssue{code?:string;source?:string;level?:'blocker'|'warning'|'suggestion';kind:string;severity:'error'|'warning'|'suggestion';line:number;title:string;detail:string}
export function publishIssues(source:string,result:RenderResult,hasImages:boolean,stickers:boolean):PublishIssue[]{
 const line=(value:string)=>Math.max(1,source.slice(0,Math.max(0,source.indexOf(value))).split('\n').length);
 const items:PublishIssue[]=[...inspectWriting(source).map(i=>({...i,kind:'writing',severity:i.title.includes('组件')?'error':i.title.includes('脚注')?'warning':'suggestion'} as PublishIssue)),
 ...result.errors.map(e=>({kind:'formula',severity:'error',line:e.line,title:'公式错误',detail:e.message} as PublishIssue)),
 ...result.missing.map(id=>({kind:'image',severity:'error',line:line(id),title:'图片缺失',detail:id} as PublishIssue)),
 ...result.external.map(url=>({kind:'network',severity:'warning',line:line(url),title:'存在网络图片',detail:'离线阅读需先导入本地副本。'} as PublishIssue)),
 ...(stickers?[{kind:'sticker',severity:'warning',line:1,title:'贴纸发布兼容',detail:'自由叠放区域需要合成为图片；透明轮廓可能被平台过滤。'} as PublishIssue]:[])];
 const seen=new Set<string>();return items.map(i=>({...i,code:i.kind+':'+i.title,source:i.kind==='formula'?'math':i.kind==='image'||i.kind==='network'?'asset':'markdown',level:(i.severity==='error'?'blocker':i.severity) as PublishIssue['level']})).filter(i=>{const key=[i.code,i.line,i.source,i.detail].join('|');if(seen.has(key))return false;seen.add(key);return true;});
}
export const severityLabel={error:'错误',warning:'警告',suggestion:'建议'};
