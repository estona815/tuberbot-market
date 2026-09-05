import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
const origin='https://tuberbot-review.netlify.app', expected=process.env.REVIEW_SOURCE_REVISION;
const out='test-results/acquisition-public';await mkdir(out,{recursive:true});
let release;
for(let n=0;n<90;n++){
 try{const res=await fetch(`${origin}/release.json?check=${Date.now()}`,{redirect:'manual',signal:AbortSignal.timeout(15000)});if(res.ok){const value=await res.json();if(value.revision===expected){release=value;break;}}}catch{}
 if(n%6===0)console.log('Waiting for the exact reviewed public deployment.');
 await new Promise(resolve=>setTimeout(resolve,10000));
}
assert.equal(release?.mode,'BUDGET_AND_INQUIRY');assert.equal(release.livePayments,false);assert.equal(release.livePayouts,false);
const browser=await chromium.launch();let sent=null;
try{
 for(const [name,width,height] of [['desktop',1440,960],['mobile',390,844],['small-mobile',320,740]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[],posts=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.method()==='POST')posts.push(request.url());});
  const go=async route=>{await page.goto(`${origin}/#${route}`);};
  const snap=async label=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/${name}-${label}.png`,fullPage:true});};
  await go('/');await expect(page.getByRole('heading',{name:/유튜버 광고,/})).toBeVisible();
  const hero=page.getByRole('complementary',{name:'빠른 예산 계산'});
  await expect(hero.getByTestId('planning-amount')).toHaveText('290,000원');
  await hero.getByLabel('콘텐츠 형식',{exact:true}).selectOption('branded');await expect(hero.getByTestId('planning-amount')).toHaveText('1,290,000원');
  await hero.getByLabel('콘텐츠 형식',{exact:true}).selectOption('shorts');await snap('home');
  await go('/search');await page.getByLabel('채널 검색',{exact:true}).fill('thin');await expect(page.locator('main article')).toHaveCount(1);await snap('directory');
  await page.getByRole('link',{name:'문의에 담기',exact:true}).click();await expect(page.getByRole('complementary',{name:'문의에 담긴 기획안'})).toContainText('thin 씬님');
  await go('/budget?category=tech&format=shorts&size=50000&quantity=3&usage=paid');
  await expect(page.getByTestId('planning-amount')).toHaveText('1,566,000원');await snap('budget');
  await page.getByRole('link',{name:'이 조건으로 광고 문의',exact:true}).click();
  const form=page.getByTestId('inquiry-page');await expect(form.getByTestId('planning-amount')).toHaveText('1,566,000원');
  await form.getByRole('button',{name:'광고 문의 보내기',exact:true}).click();await expect(form.getByRole('alert')).toBeVisible();assert.equal(posts.length,0);
  if(name==='desktop'){
   const marker=`TUBERBOT_QA_${process.env.GITHUB_RUN_ID}`;
   await form.getByLabel('브랜드명',{exact:true}).fill(marker);
   await expect(form.getByRole('alert')).toHaveCount(0);
   await form.getByLabel('회신 이메일',{exact:true}).fill('kwonj0815+qa@gmail.com');
   await form.getByLabel('추가로 알려주실 내용 · 선택',{exact:true}).fill('개발자 자동검수용 합성 문의입니다. 실제 고객·광고 집행 요청이 아닙니다. 접수 확인 후 삭제 예정입니다.');
   await form.getByRole('checkbox',{name:/개인정보 수집/}).check();await form.getByRole('checkbox',{name:/미국 서버 저장/}).check();
   await expect(form.getByRole('alert')).toHaveCount(0);await snap('inquiry');
   const responsePromise=page.waitForResponse(response=>new URL(response.url()).pathname==='/inquiry-received.html'&&response.request().method()==='POST');
   await form.getByRole('button',{name:'광고 문의 보내기',exact:true}).click();const response=await responsePromise;assert.equal(response.ok(),true);
   await expect(form.getByRole('heading',{name:'광고 문의를 전송했습니다.'})).toBeVisible();assert.equal(posts.length,1);
   const data=new URLSearchParams(response.request().postData()||'');sent={brand:marker,requestId:data.get('request-id'),status:response.status(),submittedAt:new Date().toISOString()};
   await snap('sent');
  }else{
   await form.getByLabel('브랜드명',{exact:true}).fill('모바일 검수 · 전송 안 함');await expect(form.getByRole('alert')).toHaveCount(0);await snap('inquiry');assert.equal(posts.length,0);
   await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();await page.getByRole('navigation',{name:'모바일 메뉴'}).getByRole('link',{name:'예산 계산',exact:true}).click();await expect(page.getByRole('heading',{name:'광고 예산, 바로 계산해 보세요.'})).toBeVisible();
  }
  assert.deepEqual(errors,[]);await page.close();console.log(`${name}: anonymous public browsing, calculations, inquiry context, validation, responsiveness PASS`);
 }
 await writeFile(`${out}/verified.json`,JSON.stringify({origin,sourceRevision:expected,release,viewports:['1440x960','390x844','320x740'],uiPassed:true,syntheticSubmission:sent,backendReceiptMustBeCheckedSeparately:true,at:new Date().toISOString()},null,2));
}finally{await browser.close();}
