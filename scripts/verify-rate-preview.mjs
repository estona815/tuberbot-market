import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { chromium, expect } from "@playwright/test";

const output = "test-results/rate-preview";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [], remoteRequests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { if (/^https?:/u.test(request.url())) remoteRequests.push(request.url()); });
    await page.goto(pathToFileURL(path.resolve("dist/tuberbot-rate-studio.html")).href);
    await expect(page.getByRole("heading", { name: "광고비 산정 워크스페이스" })).toBeVisible();
    await page.screenshot({ path: `${output}/${name}-empty.png`, fullPage: true });
    await page.getByLabel("카테고리", { exact: true }).fill("검증용");
    await page.getByLabel("구독자 수 X", { exact: true }).fill("100000");
    await page.getByLabel("계수 a · 원 / 구독자 1명", { exact: true }).fill("2.5");
    await page.getByLabel("절편 b · 원", { exact: true }).fill("100000");
    await page.getByLabel("계수 근거", { exact: true }).fill("합성 실행본 테스트");
    await page.getByRole("button", { name: "계산하기", exact: true }).click();
    await expect(page.getByTestId("estimated-amount")).toHaveText("350,000원");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: `${output}/${name}-result.png`, fullPage: true });
    assert.deepEqual(errors, []);
    assert.deepEqual(remoteRequests, []);
    await page.close();
    console.log(`Standalone ${name}: calculation, layout, zero outbound requests PASS`);
  }
} finally { await browser.close(); }
