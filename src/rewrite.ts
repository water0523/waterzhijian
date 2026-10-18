import {escapeHTML as esc} from './model';
import {compareText,compactDiff} from './revision-diff';
import {Connection,Provider,defaults,readConnections,saveConnections,credential,keepCredential,forgetCredentials,endpointFor,generateRewrite,testConnection,rewriteMessages,requestCompatible} from './rewrite-provider';
export {rewriteMessages};
let active:AbortController|undefined;
export const cancelRewrite=()=>{active?.abort();active=undefined;};
export function rewriteContext(source:string,from:number,to:number){
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<=from||to>source.length)throw new Error('请先选中需要改写的文字。');
 const selection=source.slice(from,to);if(Array.from(selection).length>10000)throw new Error('一次最多改写 10000 字，请缩小选区。');
 return{selection,before:Array.from(source.slice(0,from)).slice(-250).join(''),after:Array.from(source.slice(to)).slice(0,250).join('')};
}
export async function requestRewrite(key:string,model:string,messages:ReturnType<typeof rewriteMessages>,signal:AbortSignal){return requestCompatible({...defaults.cloud,model},key,messages,signal);}
type Host={open:(title:string,html:string,eyebrow?:string)=>void;notify:(s:string,error?:boolean)=>void;close:()=>void;unchanged:()=>boolean;apply:(text:string)=>void};
export function showRewrite(host:Host,source:string,from:number,to:number){
 let context:ReturnType<typeof rewriteContext>;try{context=rewriteContext(source,from,to);}catch(e){host.notify((e as Error).message,true);return;}
 const saved=readConnections();let provider=saved.provider,busy=false;
 host.open('AI · 选区改写',`<p class="modal-subtitle">默认使用本地 Qwen，也可选择其他本地模型或云端 API。仅在点击生成时发送选中文字及前后合计最多 500 字上下文；先比较，再应用。</p>
 <details class="rewrite-settings" open><summary>模型与连接设置</summary>
 <div class="rewrite-connection-grid"><label>使用方式<select id="rewrite-provider"><option value="qwen-local">本地 QwenLocal · 默认</option><option value="local-api">其他本地模型 · 兼容 API</option><option value="cloud">云端 API · DeepSeek / 自定义</option></select></label>
 <label>服务地址<input id="rewrite-endpoint" type="url" spellcheck="false" autocomplete="off"></label>
 <label id="rewrite-model-label">模型名称<input id="rewrite-model" spellcheck="false" autocomplete="off"></label>
 <label>输出上限（tokens）<input id="rewrite-tokens" type="number" min="64" max="16384" step="64"></label></div>
 <div id="rewrite-key-fields"><label>API Key<input id="rewrite-key" type="password" autocomplete="off" spellcheck="false" placeholder="仅发给上面填写的服务地址"></label>
 <label class="switch-row">记住在本机浏览器（明文，不随文章备份）<input id="rewrite-remember" type="checkbox"></label></div>
 <div class="rewrite-connection-actions"><button id="rewrite-test" class="button outline">测试连接</button><button id="rewrite-default" class="text-button">恢复该方式默认值</button><button id="rewrite-forget" class="text-button">清除所有已存密钥</button></div>
 <p id="rewrite-connection-help" class="help"></p><p class="help">连接偏好仅保存在当前浏览器。不会自动改用云端；API 密钥按完整接口地址分别保存，不进入文章、导出或备份。</p></details>
 <label>改写要求<textarea id="rewrite-instruction" rows="2" maxlength="1000">让表达清楚、自然，保留原意、事实和 Markdown 格式。</textarea></label>
 <div class="rewrite-columns"><label>原选区<textarea id="rewrite-original" readonly rows="8">${esc(context.selection)}</textarea></label><label>改写结果（可继续编辑）<textarea id="rewrite-result" rows="8" placeholder="生成后在这里比较和修改"></textarea></label></div>
 <details><summary>本次发送的上下文 · ${Array.from(context.before+context.after).length} 字</summary><pre class="rewrite-context">${esc(context.before)}\n〔选中文字〕\n${esc(context.after)}</pre></details>
 <div id="rewrite-diff" class="rewrite-diff" aria-label="选区改写差异"></div><p id="rewrite-status" class="help" role="status">尚未发送请求。</p>
 <div class="rewrite-actions"><button id="rewrite-run" class="button outline">生成改写</button><button id="rewrite-stop" class="button outline" disabled>取消请求</button><button id="rewrite-copy" class="button outline" disabled>复制结果</button><button id="rewrite-apply" class="button primary" disabled>应用到原选区</button></div><p class="help">应用前保留恢复点，应用后可 Ctrl + Z 撤销。不会自动覆盖原文。</p>`,'LOCAL / API / REVIEW');
 const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById('rewrite-'+id) as T;
 const key=$<HTMLInputElement>('key'),remember=$<HTMLInputElement>('remember'),endpoint=$<HTMLInputElement>('endpoint'),model=$<HTMLInputElement>('model'),tokens=$<HTMLInputElement>('tokens'),select=$<HTMLSelectElement>('provider'),result=$<HTMLTextAreaElement>('result'),status=$('status'),apply=$<HTMLButtonElement>('apply'),run=$<HTMLButtonElement>('run'),stop=$<HTMLButtonElement>('stop'),copy=$<HTMLButtonElement>('copy'),test=$<HTMLButtonElement>('test');
 const diffElement=$('diff'),settings=key.closest('details')!,instruction=$<HTMLTextAreaElement>('instruction');
 const connection=():Connection=>({provider,endpoint:endpoint.value.trim(),model:model.value.trim(),maxTokens:Number(tokens.value)});
 const save=()=>{saved.provider=provider;saved.connections[provider]=connection();saveConnections(saved);};
 const loadKey=()=>{try{const v=credential(connection());key.value=v.key;remember.checked=v.remember;}catch{key.value='';remember.checked=false;}};
 const display=()=>{
  const c=saved.connections[provider];select.value=provider;endpoint.value=c.endpoint;model.value=c.model;tokens.value=String(c.maxTokens);tokens.max=provider==='qwen-local'?'4096':'16384';
  $('key-fields').hidden=provider==='qwen-local';$('forget').hidden=provider==='qwen-local';model.readOnly=provider==='qwen-local';loadKey();
  $('connection-help').textContent=provider==='qwen-local'?'本机专用连接，不需要 API Key。先启动 QwenLocal；首次使用需安装使用包 local-model 文件夹中的连接页，无需重启模型。4B 模型建议每次不超过 4000 字，复杂长文请分段。':provider==='local-api'?'可连接 Ollama、LM Studio 等提供 OpenAI 兼容接口的本地服务。填写本机 /v1 地址和已安装的准确模型名；没有鉴权时可留空密钥。服务需要允许编辑器的浏览器来源。':'默认 DeepSeek，也可填写其他 HTTPS OpenAI 兼容接口的根地址、/v1 地址或完整 /chat/completions 地址。测试连接只读取模型列表，不提交正文。';
 };
 select.onchange=()=>{provider=select.value as Provider;display();save();status.textContent='连接方式已切换；尚未发送正文。';};
 endpoint.onchange=()=>{save();loadKey();};model.onchange=tokens.onchange=save;
 $('default').onclick=()=>{saved.connections[provider]={...defaults[provider]};display();save();};
 $('forget').onclick=()=>{try{forgetCredentials();key.value='';remember.checked=false;status.textContent='所有已存密钥已清除。';}catch(e){status.textContent=(e as Error).message;}};
 display();
 const structure=(text:string)=>({formulas:(text.match(/\$\$[\s\S]*?\$\$|(?<!\$)\$[^\n$]+\$(?!\$)/g)||[]).join('\n'),images:(text.match(/!\[[^\]]*\]\([^)]+\)/g)||[]).join('\n'),links:(text.match(/(?<!!)\[[^\]]*\]\([^)]+\)/g)||[]).join('\n'),components:(text.match(/^:::[^\n]*/gm)||[]).join('\n'),numbers:(text.match(/\d+(?:\.\d+)?/g)||[]).join(',')});
 const risks=()=>{const a=structure(context.selection),b=structure(result.value);return Object.keys(a).filter(k=>a[k as keyof typeof a]!==b[k as keyof typeof b]).map(k=>({formulas:'公式',images:'图片引用',links:'链接',components:'组件标记',numbers:'数字'}[k]));};
 const update=()=>{apply.disabled=copy.disabled=busy||!result.value.trim();const diff=compactDiff(compareText(context.selection,result.value));diffElement.innerHTML=(result.value&&risks().length?'<p class=notice>结构变化需核对：'+risks().join('、')+'</p>':'')+(result.value?diff.rows.filter(row=>row.kind!=='same').map(row=>row.kind==='gap'?'':`<div class="diff-line diff-${row.kind}"><code>${esc(row.text)}</code></div>`).join(''):'');};
 const setBusy=(v:boolean)=>{busy=v;run.disabled=test.disabled=v;stop.disabled=!v;result.readOnly=v;settings.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement>('input,select,button').forEach(n=>n.disabled=v);update();};
 result.oninput=update;
 const perform=async(checkOnly:boolean)=>{
  if(!checkOnly&&!host.unchanged()){status.textContent='原稿已经变化，请关闭后重新选择文字。';return;}
  let c:Connection;try{c=connection();endpointFor(c);save();if(c.provider!=='qwen-local')keepCredential(c,key.value.trim(),remember.checked);}catch(e){status.textContent=(e as Error).message;return;}
  cancelRewrite();active=new AbortController();const controller=active,timeout=setTimeout(()=>controller.abort(),checkOnly?20000:c.provider==='qwen-local'?600000:90000);setBusy(true);
  if(!checkOnly){result.value='';update();}status.textContent=checkOnly?'正在测试连接，不发送正文…':'正在生成，原文尚未修改…';
  try{
   const text=checkOnly?await testConnection(c,key.value.trim(),controller.signal):await generateRewrite(c,key.value.trim(),context,instruction.value,controller.signal,s=>{if(active===controller&&status.isConnected&&!controller.signal.aborted)status.textContent=s;});
   if(!result.isConnected||controller.signal.aborted||active!==controller)return;
   if(checkOnly)status.textContent=text;else{result.value=text;settings.open=false;status.textContent='已生成，请比较结果后应用。';result.scrollIntoView({block:'nearest'});}
  }catch(e){if(status.isConnected)status.textContent=controller.signal.aborted?'请求已取消或超时，原文未修改。':e instanceof TypeError?'无法连接所选服务。请检查地址、服务是否启动，以及浏览器来源权限；原文未修改。':(e as Error).message;}
  finally{clearTimeout(timeout);if(active===controller)active=undefined;setBusy(false);}
 };
 run.onclick=()=>void perform(false);test.onclick=()=>void perform(true);stop.onclick=()=>cancelRewrite();
 copy.onclick=async()=>{try{await navigator.clipboard.writeText(result.value);status.textContent='结果已复制。';}catch{result.select();status.textContent='请按 Ctrl + C 复制结果。';}};
 apply.onclick=()=>{if(!host.unchanged()){status.textContent='原稿已经变化，不能覆盖旧选区。请复制结果或重新选择。';return;}if(!result.value.trim()||busy)return;if(risks().length&&!window.confirm('公式、图片、链接、组件或数字发生变化：'+risks().join('、')+'。已核对并应用？'))return;host.apply(result.value);host.close();host.notify('已应用到原选区，可 Ctrl + Z 撤销。');};
}
