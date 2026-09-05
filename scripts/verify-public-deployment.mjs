import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const origin='https://tuberbot-review.vercel.app';
const expected='791dab0938ed4318c1f69f1509896208e619f50e';
const out='test-results/public-deployment';await mkdir(out,{recursive:true});
let live;
for(let attempt=0;attempt<12;attempt++){
 try {
  const response=await fetch(`${origin}/release.json`,{redirect:'manual',signal:AbortSignal.timeout(15000),cache:'no-store'});
  const body=await response.text();await writeFile(`${out}/http-response.txt`,`HTTP ${response.status}\n${body.slice(0,10000)}`);
  if(response.ok){const candidate=JSON.parse(body);if(candidate.revision===expected&&candidate.readyForHandoff){live=candidate;break;}}
  console.log(`Public release attempt ${attempt+1}: HTTP ${response.status}`);
 }catch(error){console.log(String(error));}
 if(attempt<11)await new Promise(resolve=>setTimeout(resolve,10000));
}
assert.equal(live?.mode,'PUBLIC_REVIEW','Exact reviewed release must be publicly accessible without credentials');
assert.equal(live.livePayments,false);assert.equal(live.livePayouts,false);
const entry=await fetch(origin,{redirect:'error'});assert.equal(entry.status,200);
const html=await entry.text();
for(const match of html.matchAll(/integrity="(sha384-[^"]+)"\s+(?:href|src)="([^"]+)"/g)){
 const response=await fetch(match[2],{redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);
 const integrity=`sha384-${createHash('sha384').update(Buffer.from(await response.arrayBuffer())).digest('base64')}`;
 assert.equal(integrity,match[1]);
}
const browser=await chromium.launch();
try{
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',request=>{if(request.method()!=='GET'&&request.method()!=='HEAD')writes.push({url:request.url(),method:request.method()});});
  const goto=async(route)=>{await page.goto(`${origin}/#${route}`);};
  await goto('/');await expect(page.getByRole('heading',{name:/유튜버를 찾고/})).toBeVisible({timeout:20000});
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/${name}-home.png`,fullPage:true});
  await goto('/search');await page.getByLabel('보존된 유튜버 검색').fill('');
  await expect(page.getByText('현재 견적 미확인').first()).toBeVisible();
  await page.locator('table a').first().click();await expect(page.getByRole('heading',{name:'보관 자료 · 실시간 조회 아님'})).toBeVisible();
  await goto('/workspace');await page.getByRole('button',{name:'가상 캠페인으로 체험',exact:true}).click();
  const app=page.getByTestId('project-workspace'),panel=app.getByRole('region',{name:'현재 단계 작업'});
  const role=async(name)=>app.getByLabel('체험 역할').getByRole('button',{name,exact:true}).click();
  await panel.getByRole('button',{name:'제안 보내기',exact:true}).click();
  await role('크리에이터');await panel.getByText('조건을 바꿔 역제안하기',{exact:true}).click();
  await panel.getByLabel('제안 금액 · 원',{exact:true}).fill('1100000');
  await panel.getByRole('button',{name:'역제안 보내기',exact:true}).click();
  await panel.getByRole('button',{name:'크리에이터가 v2 수락',exact:true}).click();
  await role('광고주');await panel.getByRole('button',{name:'광고주가 v2 수락',exact:true}).click();
  await expect(panel.getByRole('heading',{name:'계약 합의 완료'})).toBeVisible();
  await expect(app.getByRole('complementary',{name:'계약 스냅샷'})).toContainText('132,000원');
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/${name}-contract.png`,fullPage:true});
  await panel.getByRole('button',{name:'실제 청구 없이 결제 단계 확인'}).click();
  await role('크리에이터');await panel.getByLabel('제출 설명',{exact:true}).fill('공개 접속에서 확인한 모의 검수본');
  await panel.getByRole('button',{name:'검수 요청',exact:true}).click();
  await role('광고주');await panel.getByLabel('제작물과 광고 표시를 확인했습니다.').check();
  await panel.getByRole('button',{name:'최종 승인',exact:true}).click();
  await role('크리에이터');await panel.getByLabel('게시한 YouTube URL',{exact:true}).fill('https://youtu.be/abcdefghijk');
  await panel.getByRole('button',{name:'게시 링크 기록',exact:true}).click();
  await role('광고주');await panel.getByRole('button',{name:'구매 확인 · 정산 준비',exact:true}).click();
  await expect(panel.getByRole('heading',{name:'정산 준비까지 기록했습니다.'})).toBeVisible();
  await page.reload();await expect(panel.getByRole('heading',{name:'정산 준비까지 기록했습니다.'})).toBeVisible();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/${name}-settlement.png`,fullPage:true});
  await goto('/rate-studio');
  for(const [label,value] of [['카테고리','검증'],['구독자 수 X','100000'],['계수 a · 원 / 구독자 1명','2.5'],['절편 b · 원','100000'],['계수 근거','합성 공개 검증']])await page.getByLabel(label,{exact:true}).fill(value);
  await page.getByRole('button',{name:'계산하기',exact:true}).click();await expect(page.getByTestId('estimated-amount')).toHaveText('350,000원');
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/${name}-calculator.png`,fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await page.close();
  console.log(`${name}: anonymous public access, counteroffer, dual acceptance, contract, review, publication, settlement block, persistence, calculator PASS; no remote writes`);
 }
 await writeFile(`${out}/verified.json`,JSON.stringify({origin,live,browser:'Playwright Chromium',viewports:['1440x1000','390x844'],checkedAt:new Date().toISOString(),passed:true},null,2));
}finally{await browser.close();}
