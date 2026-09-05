import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
const root=path.resolve('dist/public-review');
const server=createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const filename=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
    if(!filename.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
    const bytes=await readFile(filename);
    const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
    res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream'});res.end(bytes);
  } catch {res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(3199,'127.0.0.1',resolve));
const out='test-results/static-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch();
try {
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
  const page=await browser.newPage({viewport:{width,height}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const goto=async(route)=>{await page.goto(`http://127.0.0.1:3199/#${route}`);};
  await goto('/');await expect(page.getByRole('heading',{name:/유튜버를 찾고/})).toBeVisible();
  await page.screenshot({path:`${out}/${name}-home.png`,fullPage:true});
  await goto('/search');await expect(page.getByRole('heading',{name:'기존 유튜버 아카이브'})).toBeVisible();
  await expect(page.getByText('현재 견적 미확인').first()).toBeVisible();
  await page.locator('table a').first().click();await expect(page.getByRole('heading',{name:'보관 자료 · 실시간 조회 아님'})).toBeVisible();
  await goto('/market');await expect(page.locator('main h1')).toBeVisible();
  await goto('/legal/terms');await expect(page.locator('main')).not.toContainText('공개 검토 범위에 없습니다');
  await goto('/workspace');await page.getByRole('button',{name:'가상 캠페인으로 체험',exact:true}).click();
  const app=page.getByTestId('project-workspace'),panel=app.getByRole('region',{name:'현재 단계 작업'});
  const role=async(name)=>app.getByLabel('체험 역할').getByRole('button',{name,exact:true}).click();
  await panel.getByRole('button',{name:'제안 보내기',exact:true}).click();
  await panel.getByRole('button',{name:'광고주가 v1 수락',exact:true}).click();
  await role('크리에이터');await panel.getByRole('button',{name:'크리에이터가 v1 수락',exact:true}).click();
  await expect(panel.getByRole('heading',{name:'계약 합의 완료'})).toBeVisible();
  await role('광고주');await panel.getByRole('button',{name:'실제 청구 없이 결제 단계 확인'}).click();
  await role('크리에이터');await panel.getByLabel('제출 설명',{exact:true}).fill('정적 공개판 제작물 검증');
  await panel.getByRole('button',{name:'검수 요청',exact:true}).click();
  await role('광고주');await panel.getByLabel('제작물과 광고 표시를 확인했습니다.').check();
  await panel.getByRole('button',{name:'최종 승인',exact:true}).click();
  await role('크리에이터');await panel.getByLabel('게시한 YouTube URL',{exact:true}).fill('https://youtu.be/abcdefghijk');
  await panel.getByRole('button',{name:'게시 링크 기록',exact:true}).click();
  await role('광고주');await panel.getByRole('button',{name:'구매 확인 · 정산 준비',exact:true}).click();
  await expect(panel.getByRole('heading',{name:'정산 준비까지 기록했습니다.'})).toBeVisible();
  await page.reload();await expect(panel.getByRole('heading',{name:'정산 준비까지 기록했습니다.'})).toBeVisible();
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/${name}-workspace.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await goto('/rate-studio');
  for(const [label,value] of [['카테고리','검증'],['구독자 수 X','100000'],['계수 a · 원 / 구독자 1명','2.5'],['절편 b · 원','100000'],['계수 근거','합성 공개판 테스트']])await page.getByLabel(label,{exact:true}).fill(value);
  await page.getByRole('button',{name:'계산하기',exact:true}).click();await expect(page.getByTestId('estimated-amount')).toHaveText('350,000원');
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/${name}-rate.png`,fullPage:true});
  assert.deepEqual(errors,[]);await page.close();console.log(`${name}: static full collaboration, archive, calculator and reload PASS`);
 }
 await writeFile(`${out}/verified.json`,JSON.stringify({passed:true,mode:'PUBLIC_REVIEW',viewports:['1440x1000','390x844'],at:new Date().toISOString()}));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
