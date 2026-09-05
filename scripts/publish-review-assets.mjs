import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const repo='estona815/tuberbot-market',branch='review-assets-20260905';
const token=process.env.GH_TOKEN,source=process.env.REVIEW_SOURCE_REVISION;
if(!token||!/^[a-f0-9]{40}$/.test(source||''))throw new Error('Publishing authorization and exact source required');
const root=path.resolve('dist/public-review');
async function api(route,method='GET',body){
 const response=await fetch(`https://api.github.com/repos/${repo}/${route}`,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 if(response.status===404&&method==='GET')return null;
 if(!response.ok)throw new Error(`Asset publication failed at ${route}: HTTP ${response.status}`);
 return response.json();
}
await writeFile(path.join(root,'release.json'),JSON.stringify({revision:source,mode:'PUBLIC_REVIEW',livePayments:false,livePayouts:false,externalConnections:false}));
async function files(dir){const found=[];for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())found.push(...await files(file));else found.push(file);}return found;}
const items=await files(root),tree=[],manifest=[];
for(const file of items){
 const bytes=await readFile(file),relative=path.relative(root,file).split(path.sep).join('/');
 if(bytes.length>5000000)throw new Error('Unexpected asset size');
 if(!/\.(html|js|css|json)$/.test(relative))throw new Error('Only public bundle assets may be published');
 const blob=await api('git/blobs','POST',{content:bytes.toString('base64'),encoding:'base64'});
 tree.push({path:relative,mode:'100644',type:'blob',sha:blob.sha});
 manifest.push({path:relative,bytes:bytes.length,integrity:`sha384-${createHash('sha384').update(bytes).digest('base64')}`});
}
const previous=await api(`git/ref/heads/${branch}`);
const createdTree=await api('git/trees','POST',{tree});
const commit=await api('git/commits','POST',{message:`Public review assets from ${source}`,tree:createdTree.sha,parents:previous?[previous.object.sha]:[]});
if(previous)await api(`git/refs/heads/${branch}`,'PATCH',{sha:commit.sha,force:false});
else await api('git/refs','POST',{ref:`refs/heads/${branch}`,sha:commit.sha});
const publication={sourceRevision:source,assetRevision:commit.sha,base:`https://cdn.jsdelivr.net/gh/${repo}@${commit.sha}/`,files:manifest};
await writeFile('review-publication.json',JSON.stringify(publication,null,2));
console.log(JSON.stringify(publication,null,2));
