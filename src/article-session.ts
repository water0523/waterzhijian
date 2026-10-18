import type {Article} from './model';
const fields=['customTitle','markdown','theme','typography','stickers','assetSettings','linkMode','assets'] as const;
export type ArticleCommand=Pick<Article,typeof fields[number]>;
const state=(a:Article):ArticleCommand=>structuredClone(Object.fromEntries(fields.map(k=>[k,a[k]])) as ArticleCommand);
type Cursor={anchor:number;head:number};
type Entry={article:ArticleCommand;cursor?:Cursor};
type ArticleSession={states:Entry[];index:number;at:number;group:string;typed:number};
export class ArticleHistory{
 private sessions=new Map<string,ArticleSession>();restoring=false;
 seed(a:Article){const prior=this.sessions.get(a.id);this.sessions.delete(a.id);this.sessions.set(a.id,prior||{states:[{article:state(a)}],index:0,at:0,group:'',typed:0});while(this.sessions.size>10)this.sessions.delete(this.sessions.keys().next().value!);}
 record(a:Article,group='command',cursor?:Cursor,before?:Cursor){
  if(this.restoring)return;this.seed(a);const s=this.sessions.get(a.id)!,next={article:state(a),cursor:cursor&&{anchor:cursor.anchor,head:cursor.head}};if(JSON.stringify(next.article)===JSON.stringify(s.states[s.index].article))return;if(before)s.states[s.index].cursor={anchor:before.anchor,head:before.head};
  const oldText=s.states[s.index].article.markdown,newText=next.article.markdown,delta=Math.max(1,Math.abs(newText.length-oldText.length)),newline=newText.split('\n').length!==oldText.split('\n').length;if(group==='typing'&&(newline||s.typed+delta>30))s.group='';s.typed=group==='typing'?(s.group===group?s.typed+delta:delta):0;
  s.states.splice(s.index+1);if(group!=='command'&&s.group===group&&(group.startsWith('gesture:')||Date.now()-s.at<750)&&s.index>0)s.states[s.index]=next;else{s.states.push(next);s.index++;}
  while(s.states.length>100||(s.states.length>2&&s.states.reduce((n,e)=>n+e.article.markdown.length*2,0)>16*1024*1024)){s.states.shift();s.index--;}s.at=Date.now();s.group=group;
 }
 cursor(a:Article){const s=this.sessions.get(a.id);return s?.states[s.index].cursor;}
 move(a:Article,direction:number){const s=this.sessions.get(a.id);if(!s||s.index+direction<0||s.index+direction>=s.states.length)return false;s.index+=direction;Object.assign(a,structuredClone(s.states[s.index].article));s.group='';return true;}
}
