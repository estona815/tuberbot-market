import { generateKeyPairSync,randomBytes,privateDecrypt,createDecipheriv,constants } from 'node:crypto';
import { readFile,writeFile,mkdir,mkdtemp,cp,rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
const site='da26c257-9139-4643-a573-9b5294cd90a3';
const run=process.env.GITHUB_RUN_ID,source=process.env.REVIEW_SOURCE_REVISION,tmp=process.env.RUNNER_TEMP;
if(!/^\d+$/.test(run||'')||!/^[a-f0-9]{40}$/.test(source||'')||!tmp)throw new Error('Runner identity required');
const privatePath=path.join(tmp,`netlify-private-${run}.pem`),publicPath=path.join(tmp,`netlify-public-${run}.json`);
if(process.argv[2]==='prepare') {
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const info={runId:run,sourceRevision:source,siteId:site,nonce:randomBytes(24).toString('hex'),publicKey};
 await writeFile(privatePath,privateKey,{mode:0o600});await writeFile(publicPath,JSON.stringify(info));
 await mkdir('deploy-public-key',{recursive:true});await writeFile(`deploy-public-key/${run}.json`,JSON.stringify(info,null,2));
 console.log(`Prepared ephemeral deployment public key for run ${run}. Private key remains runner-only.`);
} else if(process.argv[2]==='deploy') {
 const info=JSON.parse(await readFile(publicPath,'utf8'));
 let envelope;
 for(let n=0;n<90;n++) {
  const response=await fetch(`https://api.github.com/repos/estona815/tuberbot-market/contents/.ops/netlify/${run}.json?ref=ops/netlify-handoff`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
  if(response.ok){const file=await response.json();const text=Buffer.from(file.content.replace(/\s/g,''),'base64').toString('utf8');if(text.length>20000)throw new Error('Invalid envelope size');envelope=JSON.parse(text);break;}
  if(response.status!==404)throw new Error(`Envelope lookup failed: ${response.status}`);
  if(n%6===0)console.log('Waiting for a run-bound encrypted deployment grant.');
  await new Promise(resolve=>setTimeout(resolve,10000));
 }
 if(!envelope)throw new Error('No encrypted deployment grant arrived; no deployment was attempted.');
 if(envelope.runId!==run||envelope.nonce!==info.nonce||envelope.sourceRevision!==source||envelope.siteId!==site)throw new Error('Deployment grant binding mismatch');
 const aes=privateDecrypt({key:await readFile(privatePath),padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(envelope.wrappedKey,'base64'));
 const decipher=createDecipheriv('aes-256-gcm',aes,Buffer.from(envelope.iv,'base64'));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
 const decrypted=JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]).toString('utf8'));
 const proxy=decrypted.proxyPath;
 if(typeof proxy!=='string'||!/^https:\/\/netlify-mcp\.netlify\.app\/proxy\/[A-Za-z0-9_.-]+$/.test(proxy))throw new Error('Unsupported deployment grant');
 console.log(`::add-mask::${proxy}`);
 const target=await mkdtemp(path.join(tmp,'tuberbot-public-'));
 try {
  await cp(path.resolve('dist/public-review'),target,{recursive:true});
  const release={release:'customer-acquisition-v3',revision:source,mode:'BUDGET_AND_INQUIRY',leadProvider:'NETLIFY_FORMS',livePayments:false,livePayouts:false};
  await writeFile(path.join(target,'release.json'),JSON.stringify(release));
  // Scoped credential is passed directly to the official CLI; no shell, source file or build artifact contains it.
  const result=await promisify(execFile)('npx',['-y','@netlify/mcp@latest','--site-id',site,'--proxy-path',proxy],{cwd:target,timeout:600000,maxBuffer:5000000,env:{...process.env,CI:'true'}});
  const output=`${result.stdout}\n${result.stderr}`;
  const urls=[...new Set(output.match(/https:\/\/[a-z0-9.-]+\.netlify\.app(?:\/[a-zA-Z0-9_./-]*)?/g)||[])].filter(url=>!url.includes('netlify-mcp'));
  await writeFile('netlify-deployment-result.json',JSON.stringify({siteId:site,sourceRevision:source,commandExitedSuccessfully:true,publicUrls:urls,at:new Date().toISOString()},null,2));
  console.log('Official Netlify deployment command completed. Verify the public URL and form records separately.');
 } catch(error) {
  // Never echo child-process arguments or raw CLI output: they may contain the scoped proxy credential.
  await writeFile('netlify-deployment-result.json',JSON.stringify({siteId:site,sourceRevision:source,commandExitedSuccessfully:false,code:typeof error.code==='number'?error.code:null,timedOut:!!error.killed},null,2));
  throw new Error('Official deployment command failed; inspect the Netlify project status through the connected provider.');
 } finally {aes.fill(0);await rm(privatePath,{force:true});await rm(target,{recursive:true,force:true});}
} else throw new Error('Expected prepare or deploy');
