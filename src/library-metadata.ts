import type {ArticleTextMetadata} from './render';

type Source={id:string;markdown:string};
type Channel={worker:Worker;close:()=>void};
type Cached={source:string;result?:ArticleTextMetadata;failed?:boolean};
type Job={id:string;source:string;ticket:number};
type Options={
 worker:()=>Channel;
 fallback:(source:string)=>ArticleTextMetadata;
 changed:(id:string,source:string,result:ArticleTextMetadata|undefined)=>void;
 capacity?:number;
 timeoutMS?:number;
};

// A bounded projection of visible rows. It never writes articles or revisions.
export class LibraryMetadataIndex{
 private cache=new Map<string,Cached>();
 private wanted=new Map<string,string>();
 private channel?:Channel;
 private job?:Job;
 private ticket=0;
 private scheduled?:()=>void;
 private timeout=0;
 private idleClose=0;
 private fallbackOnly=false;
 constructor(private options:Options){}
 get(a:Source){const cached=this.cache.get(a.id);if(cached?.source!==a.markdown)return undefined;this.cache.delete(a.id);this.cache.set(a.id,cached);return cached.result;}
 failed(a:Source){const cached=this.cache.get(a.id);return cached?.source===a.markdown&&!!cached.failed;}
 seed(a:Source,result:ArticleTextMetadata){this.wanted.delete(a.id);this.put(a.id,{source:a.markdown,result});}
 retry(a:Source){this.cache.delete(a.id);this.wanted.set(a.id,a.markdown);this.schedule();}
 request(rows:Source[]){
  this.wanted=new Map(rows.map(a=>[a.id,a.markdown]));
  if(!rows.length){this.pause();return;}this.schedule();
 }
 pause(){
  this.wanted.clear();this.scheduled?.();this.scheduled=undefined;
  clearTimeout(this.timeout);this.job=undefined;this.closeWorker();
 }
 private put(id:string,value:Cached){
  this.cache.delete(id);this.cache.set(id,value);
  while(this.cache.size>(this.options.capacity??256))this.cache.delete(this.cache.keys().next().value!);
 }
 private closeWorker(){clearTimeout(this.idleClose);this.channel?.close();this.channel=undefined;}
 private next(){
  for(const [id,source] of this.wanted){const cached=this.cache.get(id);if(cached?.source!==source)return {id,source};this.wanted.delete(id);}
 }
 private schedule(){
  clearTimeout(this.idleClose);
  if(this.job||this.scheduled)return;
  if(!this.next()){if(this.channel)this.idleClose=window.setTimeout(()=>this.closeWorker(),30000);return;}
  const run=()=>{this.scheduled=undefined;this.start();};
  if(typeof requestIdleCallback==='function'){const id=requestIdleCallback(run,{timeout:250});this.scheduled=()=>cancelIdleCallback(id);}
  else {const id=window.setTimeout(run,0);this.scheduled=()=>clearTimeout(id);}
 }
 private start(){
  const next=this.next();if(!next)return;
  const job=this.job={...next,ticket:++this.ticket};
  if(!this.fallbackOnly){
   try{
    if(!this.channel){
     const channel=this.channel=this.options.worker();
     channel.worker.onmessage=e=>{
      if(this.channel!==channel||!this.job||e.data?.ticket!==this.job.ticket)return;
      const result=e.data.result;
      const valid=result&&Number.isSafeInteger(result.words)&&result.words>=0&&(result.heading===null||typeof result.heading==='string');
      this.finish(this.job,valid?{heading:result.heading,words:result.words}:undefined);
     };
     channel.worker.onerror=e=>{e.preventDefault();if(this.channel!==channel)return;clearTimeout(this.timeout);this.closeWorker();this.fallbackOnly=true;this.job=undefined;this.schedule();};
    }
    this.channel.worker.postMessage({ticket:job.ticket,source:job.source});
    this.timeout=window.setTimeout(()=>{if(this.job!==job)return;this.closeWorker();this.finish(job,undefined);},this.options.timeoutMS??10000);
    return;
   }catch{this.closeWorker();this.fallbackOnly=true;}
  }
  // One source per idle task when Workers are blocked. Do not loop over the library.
  try{this.finish(job,this.options.fallback(job.source));}catch{this.finish(job,undefined);}
 }
 private finish(job:Job,result:ArticleTextMetadata|undefined){
  if(this.job!==job)return;clearTimeout(this.timeout);this.job=undefined;
  if(this.wanted.get(job.id)===job.source){
   this.wanted.delete(job.id);
   this.put(job.id,{source:job.source,result,failed:!result});
   this.options.changed(job.id,job.source,result);
  }
  this.schedule();
 }
}
