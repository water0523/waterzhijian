export interface DiffLine {kind:'same'|'removed'|'added';text:string;oldLine?:number;newLine?:number}
export type DiffRow=DiffLine|{kind:'gap';count:number};
export interface TextDiff {lines:DiffLine[];added:number;removed:number;tooLarge:boolean}
// Patience anchors keep paragraphs in place without a quadratic LCS table.
// Repeated, ambiguous sections fall back to delete/insert, with a work bound.
export function compareText(before:string,after:string):TextDiff{
  if(before===after)return {lines:[],added:0,removed:0,tooLarge:false};
  const a=before.split('\n'),b=after.split('\n');
  if(a.length+b.length>100000)return {lines:[],added:0,removed:0,tooLarge:true};
  const lines:DiffLine[]=[];let work=0;
  const same=(i:number,j:number)=>lines.push({kind:'same',text:a[i],oldLine:i+1,newLine:j+1});
  const region=(startA:number,endA:number,startB:number,endB:number,depth:number)=>{
    while(startA<endA&&startB<endB&&a[startA]===b[startB])same(startA++,startB++);
    let suffix=0;while(startA<endA-suffix&&startB<endB-suffix&&a[endA-1-suffix]===b[endB-1-suffix])suffix++;
    const limitA=endA-suffix,limitB=endB-suffix;
    work+=limitA-startA+limitB-startB;
    const anchors:[number,number][]=[];
    if(depth<20&&work<600000&&startA<limitA&&startB<limitB){
      const uniqueA=new Map<string,number>(),uniqueB=new Map<string,number>();
      for(let i=startA;i<limitA;i++)uniqueA.set(a[i],uniqueA.has(a[i])?-1:i);
      for(let j=startB;j<limitB;j++)uniqueB.set(b[j],uniqueB.has(b[j])?-1:j);
      const pairs:[number,number][]=[];
      for(const [text,i] of uniqueA){const j=uniqueB.get(text);if(i>=0&&j!==undefined&&j>=0&&text.trim())pairs.push([i,j]);}
      pairs.sort((x,y)=>x[0]-y[0]);
      const tails:number[]=[],previous:number[]=[];
      for(let k=0;k<pairs.length;k++){
        let lo=0,hi=tails.length;while(lo<hi){const mid=(lo+hi)>>>1;if(pairs[tails[mid]][1]<pairs[k][1])lo=mid+1;else hi=mid;}
        previous[k]=lo?tails[lo-1]:-1;tails[lo]=k;
      }
      for(let k=tails.at(-1)??-1;k>=0;k=previous[k])anchors.push(pairs[k]);anchors.reverse();
    }
    if(anchors.length){
      let i=startA,j=startB;for(const [nextA,nextB] of anchors){region(i,nextA,j,nextB,depth+1);same(nextA,nextB);i=nextA+1;j=nextB+1;}region(i,limitA,j,limitB,depth+1);
    }else{
      for(let i=startA;i<limitA;i++)lines.push({kind:'removed',text:a[i],oldLine:i+1});
      for(let j=startB;j<limitB;j++)lines.push({kind:'added',text:b[j],newLine:j+1});
    }
    for(let i=0;i<suffix;i++)same(limitA+i,limitB+i);
  };
  region(0,a.length,0,b.length,0);
  return {lines,added:lines.filter(l=>l.kind==='added').length,removed:lines.filter(l=>l.kind==='removed').length,tooLarge:false};
}
export function compactDiff(diff:TextDiff,context=2,limit=600):{rows:DiffRow[];truncated:boolean}{
  const rows:DiffRow[]=[],ranges:[number,number][]=[];
  for(let i=0;i<diff.lines.length;i++)if(diff.lines[i].kind!=='same'){
    const start=Math.max(0,i-context),end=Math.min(diff.lines.length,i+context+1),last=ranges.at(-1);
    if(last&&start<=last[1])last[1]=end;else ranges.push([start,end]);
  }
  let cursor=0,shown=0;
  for(const [start,end] of ranges){
    if(start>cursor)rows.push({kind:'gap',count:start-cursor});
    for(let i=start;i<end;i++){if(shown>=limit)return {rows,truncated:true};rows.push(diff.lines[i]);shown++;}cursor=end;
  }
  if(cursor<diff.lines.length)rows.push({kind:'gap',count:diff.lines.length-cursor});
  return {rows,truncated:false};
}
