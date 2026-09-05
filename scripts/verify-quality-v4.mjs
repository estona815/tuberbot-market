import { readFile,mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium,expect } from '@playwright/test';
const origin=process.env.PUBLIC_QA_ORIGIN||'https://tuberbot-review.netlify.app';
const live=process.env.PUBLIC_QA_LIVE==='true',root=path.resolve('dist/public-review'),out=process.env.QA_OUTPUT||'test-results/quality-v4';
await mkdir(out,{recursive:true});
const browser=await chromium.launch();
const records=[];
try {
 for(const [name,width,height] of [['desktop',1440,1000],['tablet',820,1180],['mobile',390,844],['small-mobile',320,740]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[],posts=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(request.method()==='POST'){posts.push(url.href);return route.fulfill({status:503,body:'Blocked QA submission'});}
   if(live||url.origin!==origin)return route.continue();
   const pathname=decodeURIComponent(url.pathname),filename=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
   if(!filename.startsWith(root+path.sep))return route.fulfill({status:403});
   try{const contentType={'.html':'text/html;charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json'}[path.extname(filename)]||'application/octet-stream';return route.fulfill({status:200,contentType,body:await readFile(filename)});}catch{return route.fulfill({status:404});}
  });
  const go=async route=>page.goto(`${origin}/#${route}`);
  const capture=async label=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name}/${label} overflow`);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/${name}-${label}.png`,fullPage:true});};
  await go('/');await expect(page.getByRole('heading',{name:/유튜버 광고,/})).toBeVisible();
  const hero=page.getByRole('complementary',{name:'빠른 예산 계산'});
  await expect(hero.getByTestId('planning-amount')).toHaveText('290,000원');
  assert.equal(await hero.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(20, 36, 60)');
  await hero.getByLabel('콘텐츠 형식',{exact:true}).selectOption('branded');await expect(hero.getByTestId('planning-amount')).toHaveText('1,290,000원');
  await hero.getByLabel('콘텐츠 형식',{exact:true}).selectOption('shorts');await capture('home');
  await go('/search');await page.getByRole('button',{name:'thin 씬님 관심 채널 저장',exact:true}).click();
  const saved=page.getByRole('button',{name:'저장한 채널 1',exact:true});await expect(saved).toBeVisible();await saved.click();await expect(page.locator('main article')).toHaveCount(1);
  await page.reload();await expect(page.getByRole('button',{name:'저장한 채널 1',exact:true})).toBeVisible();await page.getByRole('button',{name:'저장한 채널 1',exact:true}).click();await expect(page.locator('main article')).toHaveCount(1);await capture('saved');
  await page.getByRole('link',{name:'문의에 담기',exact:true}).click();
  await expect(page.getByRole('complementary',{name:'문의에 담긴 기획안'})).toContainText('thin 씬님');
  await page.getByRole('link',{name:'예산 조건 다시 설정',exact:true}).click();
  const formats=page.getByLabel('콘텐츠 형식',{exact:true});await formats.getByRole('button',{name:'롱폼 PPL',exact:true}).click();
  await expect(page.getByTestId('planning-amount')).toHaveText('590,000원');
  if(width<=720){const bar=page.getByRole('complementary',{name:'모바일 예산 요약'});await expect(bar).toBeVisible();await expect(bar).toContainText('590,000원');}
  await page.getByLabel('희망 채널 규모 · 명',{exact:true}).fill('9999999');await expect(page.getByTestId('planning-amount')).toHaveCount(0);await expect(page.getByRole('complementary',{name:'모바일 예산 요약'})).toHaveCount(0);
  await page.getByLabel('희망 채널 규모 · 명',{exact:true}).fill('50000');await capture('budget');
  await page.getByRole('link',{name:'이 조건으로 광고 문의',exact:true}).click();await expect(page.getByRole('complementary',{name:'문의에 담긴 기획안'})).toContainText('thin 씬님');await expect(page.getByTestId('planning-amount')).toHaveText('590,000원');await capture('inquiry');
  await page.getByRole('button',{name:'광고 문의 보내기',exact:true}).click();await expect(page.getByTestId('inquiry-page').getByRole('alert')).toBeVisible();assert.equal(posts.length,0);
  if(width<760){await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();await expect(page.getByRole('navigation',{name:'모바일 메뉴'})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('navigation',{name:'모바일 메뉴'})).toHaveCount(0);await expect(page.getByRole('button',{name:'메뉴 열기',exact:true})).toBeFocused();}
  await page.emulateMedia({reducedMotion:'reduce'});await go('/');const motion=await page.getByRole('complementary',{name:'빠른 예산 계산'}).evaluate(el=>getComputedStyle(el.querySelector('a')).transitionDuration);assert.equal(motion,'0s');
  assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);records.push({name,width,height,passed:true});await page.close();console.log(`${name}: presentation, bookmark persistence, context preservation, mobile live budget, invalid-input clearing, Escape focus and reduced motion PASS`);
 }
 await writeFile(`${out}/verified.json`,JSON.stringify({sourceRevision:process.env.REVIEW_SOURCE_REVISION,origin,live,records,remoteSubmissions:0,passed:true,checkedAt:new Date().toISOString()},null,2));
}finally{await browser.close();}
