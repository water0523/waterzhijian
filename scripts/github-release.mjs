import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Credentials remain in memory and are sent only to GitHub's official APIs.
const owner='water0523',repo='waterzhijian',base=`https://api.github.com/repos/${owner}/${repo}`;
const command=process.argv[2]||'inspect';
const credentials=execFileSync('git',['credential','fill'],{input:`protocol=https\nhost=github.com\nusername=${owner}\n\n`,encoding:'utf8',env:{...process.env,GCM_INTERACTIVE:'never',GIT_TERMINAL_PROMPT:'0'}});
const token=credentials.split(/\r?\n/).find(line=>line.startsWith('password='))?.slice(9);
if(!token)throw new Error('GitHub credential unavailable');
const headers={Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'};
async function api(url,method='GET',body){
 const response=await fetch(url,{method,headers:body===undefined?headers:{...headers,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>null);
 if(!response.ok&&response.status!==404)throw new Error(`${method} ${url}: ${response.status} ${data?.message||response.statusText}`);
 return {status:response.status,data};
}
const user=(await api('https://api.github.com/user')).data;
if(user.login!==owner)throw new Error('Authenticated GitHub account does not match release owner');
if(command==='inspect'){
 const existing=await api(base);console.log(JSON.stringify({owner:user.login,id:user.id,repository:existing.status===404?null:{name:existing.data.full_name,private:existing.data.private,defaultBranch:existing.data.default_branch}}));
 if(existing.status!==404){const files=await api(base+'/contents');console.log(JSON.stringify({files:Array.isArray(files.data)?files.data.map(f=>f.name):[]}));}
}else if(command==='create'){
 if((await api(base)).status!==404)throw new Error('Repository already exists; refusing to replace it');
 const result=await api('https://api.github.com/user/repos','POST',{name:repo,description:'纸间 v1.0 · Markdown 公众号与知乎排版器：36 套主题、数学公式、图片环绕、离线写作与文档导出',private:false,auto_init:false,has_issues:true});console.log(JSON.stringify({repository:result.data.html_url}));
}else if(command==='pages'){
 const existing=await api(base+'/pages');
 const config={source:{branch:'main',path:'/docs'},build_type:'legacy'};
 const result=await api(base+'/pages',existing.status===404?'POST':'PUT',config);
 await api(base,'PATCH',{homepage:`https://${owner}.github.io/${repo}/`});
 console.log(JSON.stringify({status:result.status,site:result.data?.html_url||`https://${owner}.github.io/${repo}/`}));
}else if(command==='status'){
 const page=await api(base+'/pages'),build=await api(base+'/pages/builds/latest');
 console.log(JSON.stringify({site:page.data?.html_url,status:page.data?.status,build:build.data?.status,error:build.data?.error,commit:build.data?.commit}));
}else if(command==='release'){
 const notes=await readFile('RELEASE-v1.0.md','utf8');
 let release=await api(base+'/releases/tags/v1.0');
 if(release.status===404)release=await api(base+'/releases','POST',{tag_name:'v1.0',target_commitish:'main',name:'纸间 v1.0 · 首个正式版本',body:notes,draft:false,prerelease:false});
 const upload=release.data.upload_url.split('{')[0];
 if(new URL(upload).hostname!=='uploads.github.com')throw new Error('Unexpected release upload host');
 for(const [file,name,type] of [['dist/纸间-离线公众号排版器.html','waterzhijian-v1.0.html','text/html'],['dist/纸间-源码与使用说明.zip','waterzhijian-v1.0-source.zip','application/zip'],['dist/SHA256.txt','SHA256.txt','text/plain']]){
  if(release.data.assets.some(asset=>asset.name===name))continue;
  let bytes=await readFile(file);
  if(name==='SHA256.txt')bytes=Buffer.from((await Promise.all([['dist/纸间-离线公众号排版器.html','waterzhijian-v1.0.html'],['dist/纸间-源码与使用说明.zip','waterzhijian-v1.0-source.zip']].map(async([path,name])=>createHash('sha256').update(await readFile(path)).digest('hex')+'  '+name))).join('\n')+'\n');
  const response=await fetch(upload+'?name='+encodeURIComponent(name),{method:'POST',headers:{...headers,'Content-Type':type},body:bytes});
  if(!response.ok)throw new Error('Release asset upload failed: '+response.status);
 }
 console.log(JSON.stringify({release:release.data.html_url}));
}else throw new Error('Unknown operation');
