import {articleTextMetadata} from './render';
// Only source analysis runs here. Rendering, DOM and optional engines stay unused.
self.onmessage=(event:MessageEvent<{ticket:number;source:string}>)=>{
 const {ticket,source}=event.data;
 try{self.postMessage({ticket,result:articleTextMetadata(source)});}
 catch{self.postMessage({ticket,error:true});}
};
export const workerVersion=1;
