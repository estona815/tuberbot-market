import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
const origin = "https://tuberbot-market-review-kwonj0815-2863s-projects.vercel.app";
const out = "test-results/public-deployment";
await mkdir(out, { recursive: true });
let live;
for (let attempt = 0; attempt < 12; attempt++) {
  try {
    const response = await fetch(`${origin}/release.json`, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    const body = await response.text();
    console.log(`Public readiness attempt ${attempt + 1}: HTTP ${response.status}`);
    await writeFile(`${out}/http-response.txt`, `HTTP ${response.status}\n${body.slice(0,30000)}`);
    if (response.ok) { live = JSON.parse(body); break; }
  } catch (error) { console.log(String(error)); }
  if (attempt < 11) await new Promise((resolve) => setTimeout(resolve, 10000));
}
assert.equal(live?.mode, "PUBLIC_REVIEW", "Public deployment must return its release identity without login");
assert.equal(live.livePayments, false); assert.equal(live.livePayouts, false);
const browser = await chromium.launch();
try {
  for (const [name, width, height] of [["desktop",1440,1000],["mobile",390,844]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin); await expect(page.getByRole("heading", { name: /유튜버를 찾고/ })).toBeVisible();
    await page.screenshot({ path: `${out}/${name}-home.png`, fullPage: true });
    await page.goto(`${origin}/workspace`);
    await page.getByRole("button", { name: "가상 캠페인으로 체험", exact: true }).click();
    const app = page.getByTestId("project-workspace"), panel = app.getByRole("region", { name: "현재 단계 작업" });
    await panel.getByRole("button", { name: "제안 보내기", exact: true }).click();
    await panel.getByRole("button", { name: "광고주가 v1 수락", exact: true }).click();
    await app.getByLabel("체험 역할").getByRole("button", { name: "크리에이터", exact: true }).click();
    await panel.getByRole("button", { name: "크리에이터가 v1 수락", exact: true }).click();
    await expect(panel.getByRole("heading", { name: "계약 합의 완료" })).toBeVisible();
    await page.screenshot({ path: `${out}/${name}-contract.png`, fullPage: true });
    await page.reload(); await expect(panel.getByRole("heading", { name: "계약 합의 완료" })).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.goto(`${origin}/rate-studio`);
    await page.getByLabel("카테고리", { exact: true }).fill("검증");
    await page.getByLabel("구독자 수 X", { exact: true }).fill("100000");
    await page.getByLabel("계수 a · 원 / 구독자 1명", { exact: true }).fill("2.5");
    await page.getByLabel("절편 b · 원", { exact: true }).fill("100000");
    await page.getByLabel("계수 근거", { exact: true }).fill("합성 공개 검증");
    await page.getByRole("button", { name: "계산하기", exact: true }).click();
    await expect(page.getByTestId("estimated-amount")).toHaveText("350,000원");
    await page.screenshot({ path: `${out}/${name}-calculator.png`, fullPage: true });
    assert.deepEqual(errors, []); await page.close();
    console.log(`${name} publicly accessible; proposal, both acceptances, persisted contract and calculator PASS`);
  }
  await writeFile(`${out}/verified.json`, JSON.stringify({ origin, live, browser: "Playwright Chromium", viewports: ["1440x1000","390x844"], checkedAt: new Date().toISOString(), passed: true },null,2));
} finally { await browser.close(); }
