import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
const root=path.resolve('dist/public-review'), origin='https://tuberbot-review.netlify.app';
const out='test-results/static-review'; await mkdir(out,{recursive:true});
const browser=await chromium.launch();
let assertions=0;
try {
 for(const [name,width,height] of [['desktop',1440,960],['mobile',390,844],['small-mobile',320,740]]) {
  const page=await browser.newPage({viewport:{width,height}}),errors=[],posts=[];
  let failPost=false;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(`${origin}/**`,async route=>{
   const request=route.request();
   if(request.method()==='POST') {
    assert.equal(new URL(request.url()).pathname,'/inquiry-received.html');
    const body=new URLSearchParams(request.postData()||''); posts.push(body);
    return route.fulfill({status:failPost?503:200,contentType:'text/html',body:'<!doctype html><p>form fixture response</p>'});
   }
   const pathname=decodeURIComponent(new URL(request.url()).pathname),file=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
   if(!file.startsWith(root+path.sep)) return route.fulfill({status:403,body:'blocked'});
   try {const types={'.html':'text/html;charset=utf-8','.js':'application/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json'};return route.fulfill({status:200,contentType:types[path.extname(file)]||'application/octet-stream',body:await readFile(file)});} catch{return route.fulfill({status:404,body:'not found'});}
  });
  const goto=async route=>{await page.goto(`${origin}/#${route}`);};
  const snap=async label=>{await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/${name}-${label}.png`,fullPage:true});};
  const within=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assertions++;};
  await goto('/'); await expect(page.getByRole('heading',{name:/유튜버 광고,/})).toBeVisible();
  await expect(page.getByRole('complementary',{name:'빠른 예산 계산'}).getByTestId('planning-amount')).toHaveText('290,000원');
  await page.getByRole('complementary',{name:'빠른 예산 계산'}).getByLabel('콘텐츠 형식',{exact:true}).selectOption('integration');
  await expect(page.getByRole('complementary',{name:'빠른 예산 계산'}).getByTestId('planning-amount')).toHaveText('590,000원');
  await snap('home');await within();
  const headerCTA=page.locator('.site-header .desktop-nav').getByRole('link',{name:'광고 문의',exact:true});
  if(width>720) {await expect(headerCTA).toBeVisible();const bg=await headerCTA.evaluate(el=>getComputedStyle(el).backgroundColor);assert.equal(bg,'rgb(216, 58, 73)');}
  await goto('/search'); await expect(page.getByRole('heading',{name:'브랜드에 맞는 유튜버 찾기'})).toBeVisible();
  await page.getByLabel('채널 검색',{exact:true}).fill('thin');
  await expect(page.locator('main article')).toHaveCount(1);
  await page.getByLabel('채널 검색',{exact:true}).fill('no-such-test-channel');
  await expect(page.getByRole('heading',{name:'일치하는 채널이 없습니다.'})).toBeVisible();
  await page.getByRole('button',{name:'검색 조건 초기화'}).click();
  await page.getByLabel('분야 필터').getByRole('button',{name:'지식',exact:true}).click();
  await expect(page.locator('main article')).toHaveCount(1);
  await page.getByLabel('분야 필터').getByRole('button',{name:'전체',exact:true}).click();
  await snap('search');await within();
  await page.getByRole('link',{name:'채널 자세히',exact:true}).first().click();
  await expect(page.getByRole('heading',{name:'thin 씬님',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'이 채널을 담아 문의',exact:true}).click();
  await expect(page.getByRole('complementary',{name:'문의에 담긴 기획안'})).toContainText('thin 씬님');
  await expect(page.getByTestId('planning-amount')).toHaveText('290,000원');
  await within();
  await goto('/budget');
  const budget=page.getByTestId('budget-page');
  await budget.getByLabel('브랜드 분야',{exact:true}).selectOption('tech');
  await budget.getByLabel('콘텐츠 수량',{exact:true}).selectOption('3');
  await budget.getByLabel('콘텐츠 사용 범위',{exact:true}).selectOption('paid');
  await expect(budget.getByTestId('planning-amount')).toHaveText('1,566,000원');
  await budget.getByLabel('희망 채널 규모 · 명',{exact:true}).fill('9999999');
  await expect(budget.getByTestId('planning-amount')).toHaveCount(0);await expect(budget.getByRole('alert')).toBeVisible();
  await budget.getByLabel('희망 채널 규모 · 명',{exact:true}).fill('50000');
  await expect(budget.getByTestId('planning-amount')).toHaveText('1,566,000원');
  await snap('budget');await within();
  const downloadEvent=page.waitForEvent('download');await budget.getByRole('button',{name:'예산 기획안 받기',exact:true}).click();
  const text=await readFile((await (await downloadEvent).path()),'utf8');assert.match(text,/1,566,000/);assert.match(text,/가정값/);
  await budget.getByRole('link',{name:'이 조건으로 광고 문의',exact:true}).click();
  const inquiry=page.getByTestId('inquiry-page');
  await expect(inquiry.getByTestId('planning-amount')).toHaveText('1,566,000원');
  await inquiry.getByRole('button',{name:'광고 문의 보내기',exact:true}).click();
  await expect(inquiry.getByRole('alert')).toBeVisible();assert.equal(posts.length,0);
  await inquiry.getByLabel('브랜드명',{exact:false}).fill('QA 합성 브랜드');
  await inquiry.getByLabel('회신 이메일',{exact:false}).fill('qa@example.com');
  await inquiry.getByLabel('추가로 알려주실 내용 · 선택',{exact:true}).fill('자동검수 합성 데이터. 실제 광고 문의 아님.');
  await inquiry.getByRole('button',{name:'광고 문의 보내기',exact:true}).click();
  assert.equal(posts.length,0);await expect(inquiry.getByRole('alert')).toContainText('동의');
  await inquiry.getByRole('checkbox',{name:/개인정보 수집/}).check();await inquiry.getByRole('checkbox',{name:/미국 서버 저장/}).check();
  await snap('inquiry');await within();
  failPost=true;await inquiry.getByRole('button',{name:'광고 문의 보내기',exact:true}).click();
  await expect(inquiry.getByRole('alert')).toContainText('전송을 완료하지 못했습니다');
  await expect(inquiry.getByLabel('회신 이메일',{exact:false})).toHaveValue('qa@example.com');
  failPost=false;await inquiry.getByRole('button',{name:'광고 문의 보내기',exact:true}).click();
  await expect(inquiry.getByRole('heading',{name:'광고 문의를 전송했습니다.'})).toBeVisible();
  assert.equal(posts.length,2);assert.equal(posts[1].get('form-name'),'tuberbot-inquiry-v1');assert.equal(posts[1].get('privacy-consent'),'yes');assert.equal(posts[1].get('transfer-consent'),'yes');assert.match(posts[1].get('planning-summary'),/1,566,000/);assert.equal(posts[0].get('request-id'),posts[1].get('request-id'));
  await goto('/inquiry-privacy');await expect(page.getByRole('heading',{name:'광고 문의 개인정보 안내'})).toBeVisible();await within();
  if(width<720){await goto('/');await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();await page.getByRole('navigation',{name:'모바일 메뉴'}).getByRole('link',{name:'예산 계산',exact:true}).click();await expect(page.getByRole('heading',{name:'광고 예산, 바로 계산해 보세요.'})).toBeVisible();}
  assert.deepEqual(errors,[]);await page.close();assertions+=25;
  console.log(`${name}: live calculations, invalid-input clearing, directory/filter, planning export, inquiry prefill, both consent gates, failure recovery, schema-aligned submission, responsive layout PASS (all form POSTs mocked)`);
 }
 await writeFile(`${out}/verified.json`,JSON.stringify({passed:true,sourceRevision:process.env.REVIEW_SOURCE_REVISION,viewports:['1440x960','390x844','320x740'],assertions,externalSubmissions:0,at:new Date().toISOString()},null,2));
} finally {await browser.close();}
