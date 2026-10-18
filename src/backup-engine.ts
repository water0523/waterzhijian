import {zipSync} from 'fflate';
// This entry is compiled into an embedded worker payload, never loaded from a URL.
self.onmessage=(event:MessageEvent<Record<string,Uint8Array>>)=>{try{const bytes=zipSync(event.data,{level:6});self.postMessage({bytes},[bytes.buffer] as any);}catch(e){self.postMessage({error:e instanceof Error?e.message:String(e)});}};
export const workerVersion=1;
