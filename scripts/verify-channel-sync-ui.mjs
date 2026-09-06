import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';
import { publicCatalog, emptySyncDocument, CHANNEL_RETENTION_MS } from '../src/domain/channel-snapshot.ts';
import { registeredChannelIds } from '../src/lib/channels/registry.ts';
const live=process.env.PUBLIC_QA_LIVE==='true', origin='https://tuberbot-review.netlify.app';
const out=process.env.QA_OUTPUT||'test-results/channel-sync';
const root=path.resolve('dist/public-review'), ids=registeredChannelIds(), id=ids[0];
await mkdir(out,{recursive:true});
let actual;
if(live){
 const response=await fetch(`${origin}/api/channel-data`,{redirect:'error',signal:AbortSignal.timeout(30000)});
 assert.equal(response.status,200); actual=await response.json();
 assert.equal(actual.source,'YOUTUBE_DATA_API_V3');assert.equal(actual.registeredCount,ids.length);
 assert.notEqual(actual.status,'STORAGE_UNAVAILABLE','The deployed storage adapter must actually work');
 const unknown=await fetch(`${origin}/api/channel-data?id=UC${'x'.repeat(22)}`);assert.equal(unknown.status,404);
 const forced=await fetch(`${origin}/api/channel-data?force=true`);assert.equal(forced.status,404);
 const release=await (await fetch(`${origin}/release.json`,{cache:'no-store'})).json();
 assert.equal(release.revision,process.env.REVIEW_SOURCE_REVISION);assert.equal(release.livePayments,false);assert.equal(release.livePayouts,false);
}
const browser=await chromium.launch(), records=[];
try{
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844],['small-mobile',320,740]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[],posts=[];
  let fixture=publicCatalog({...emptySyncDocument(),lastCompleteAt:new Date().toISOString(),records:[{youtubeId:id,state:'AVAILABLE',observedAt:new Date().toISOString(),data:{title:'API 갱신 테스트 채널',thumbnailUrl:null,subscriberCount:'456000',videoCount:'250',viewCount:'9007199254740995',hiddenSubscriberCount:false}}]},ids,true);
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(req.method()!=='GET'&&req.method()!=='HEAD'){posts.push(req.url());return route.fulfill({status:503,body:'Blocked QA write'});}
   if(live||url.origin!==origin)return route.continue();
   if(url.pathname==='/api/channel-data')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)});
   const filename=path.resolve(root,`.${url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)}`);
   if(!filename.startsWith(root+path.sep))return route.fulfill({status:403});
   try{return route.fulfill({status:200,body:await readFile(filename),contentType:{'.js':'application/javascript','.css':'text/css','.html':'text/html'}[path.extname(filename)]||'application/octet-stream'});}catch{return route.fulfill({status:404});}
  });
  const go=async route=>page.goto(`${origin}/#${route}`);
  const capture=async label=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name}/${label} overflow`);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/${name}-${label}.png`,fullPage:true});};
  await go('/search');await expect(page.getByRole('heading',{name:'브랜드에 맞는 유튜버 찾기'})).toBeVisible();
  if(!live){
   await expect(page.getByRole('link',{name:'API 갱신 테스트 채널',exact:true})).toBeVisible();
   const tile=page.locator('main article').first();await expect(tile).toContainText('456,000');await expect(tile.getByTestId('channel-checked-at')).toContainText('YouTube');
   await capture('updated-directory');await tile.getByRole('link',{name:'채널 자세히',exact:true}).click();
   await expect(page.getByRole('heading',{name:'API 갱신 테스트 채널'})).toBeVisible();
   await expect(page.locator('main')).toContainText('9,007,199,254,740,995');await capture('updated-profile');
   await go('/budget');await expect(page.getByTestId('planning-amount')).toHaveText('290,000원');
   fixture.records[0].data.hiddenSubscriberCount=true;fixture.records[0].data.subscriberCount=null;
   await go('/search');await page.reload();await expect(page.locator('main article').first()).toContainText('비공개·미제공');
   fixture.records[0].observedAt=new Date(Date.now()-CHANNEL_RETENTION_MS-1000).toISOString();
   await page.reload();await expect(page.locator('main article').first()).toContainText('정보 확인 대기');await expect(page.locator('main article').first()).not.toContainText('77,400');
   fixture=publicCatalog(emptySyncDocument(),ids,false);await page.reload();await expect(page.locator('main')).toContainText('자동 갱신 연결 대기');
  }else{await expect(page.locator('main article').first()).toBeVisible();await capture('directory');}
  await go('/data-status');await expect(page.getByRole('heading',{name:'채널 데이터 업데이트'})).toBeVisible();
  await expect(page.getByRole('region',{name:'자동 갱신 상태'})).toContainText('매일 03:10');
  if(!live||!actual.configured)await expect(page.getByRole('heading',{name:'운영 API 키 등록 대기'})).toBeVisible();
  await capture('status');await go('/');await expect(page.getByRole('heading',{name:/유튜버 광고,/})).toBeVisible();
  await expect(page.getByRole('complementary',{name:'빠른 예산 계산'}).getByTestId('planning-amount')).toHaveText('290,000원');
  await capture('home');assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);records.push({name,width,height,passed:true});await page.close();
 }
 await writeFile(`${out}/verified.json`,JSON.stringify({sourceRevision:process.env.REVIEW_SOURCE_REVISION,live,origin,records,publicApi:actual??null,remoteSubmissions:0,realYouTubeDataVerified:Boolean(live&&actual?.configured&&actual?.lastCompleteAt),passed:true,checkedAt:new Date().toISOString()},null,2));
 console.log('Channel-sync UI: timestamps, raw counts, private/unavailable/expired data, preserved budget isolation and responsive layout PASS.');
}finally{await browser.close();}
