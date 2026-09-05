import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const CSV = "category,format,subscribers,priceKrw\n검증용,integration,10000,120000\n검증용,integration,20000,140000\n검증용,integration,30000,160000\n";
async function fillScenario(page: Page) {
  await page.getByLabel("카테고리", { exact: true }).fill("검증용");
  await page.getByLabel("구독자 수 X", { exact: true }).fill("100,000");
  await page.getByLabel("계수 a · 원 / 구독자 1명", { exact: true }).fill("2.5");
  await page.getByLabel("절편 b · 원", { exact: true }).fill("100000");
  await page.getByLabel("계수 근거", { exact: true }).fill("합성 브라우저 검증 자료");
  await page.getByLabel("참고 범위 ± %", { exact: true }).fill("10");
}
const studioAlert = (page: Page) => page.locator("main#main-content").getByRole("alert");

test("calculator starts empty, calculates exact money, clears stale results and exports", async ({ page }, testInfo) => {
  const errors: string[] = [];
  const outbound: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/rate-studio");
  page.on("request", (request) => { if (["fetch", "xhr"].includes(request.resourceType())) outbound.push(request.url()); });
  await expect(page.getByRole("heading", { name: "광고비 산정 워크스페이스" })).toBeVisible();
  await expect(page.getByTestId("estimated-amount")).toHaveCount(0);
  await expect(page.getByLabel("계수 a · 원 / 구독자 1명", { exact: true })).toHaveValue("");
  await page.screenshot({ path: testInfo.outputPath("rate-studio-empty.png"), fullPage: true });
  await page.getByRole("button", { name: "계산하기", exact: true }).click();
  await expect(studioAlert(page)).toBeVisible();
  await fillScenario(page);
  await page.getByRole("button", { name: "계산하기", exact: true }).click();
  await expect(page.getByTestId("estimated-amount")).toHaveText("350,000원");
  await expect(page.getByText("315,000원 ~ 385,000원")).toBeVisible();
  await expect(page.getByTestId("formula")).toContainText("2.5 × 100,000 + (100,000)");
  await expect(page.getByRole("region", { name: "산정 결과" })).toContainText("통계적 신뢰구간");
  await page.screenshot({ path: testInfo.outputPath("rate-studio-result.png"), fullPage: true });
  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "결과 JSON", exact: true }).click();
  const file = await jsonDownload;
  expect(file.suggestedFilename()).toBe("tuberbot-calculation.json");
  const filePath = await file.path();
  expect(filePath).not.toBeNull();
  const snapshot = JSON.parse(await readFile(filePath!, "utf8"));
  expect(snapshot.amountKrw).toBe("350000");
  expect(snapshot.mode).toBe("SIMULATION_NOT_A_QUOTE");
  await page.getByLabel("구독자 수 X", { exact: true }).fill("200000");
  await expect(page.getByTestId("estimated-amount")).toHaveCount(0);
  expect(outbound).toEqual([]);
  expect(errors).toEqual([]);
});

test("rules save, load and JSON re-import require explicit application", async ({ page }) => {
  await page.goto("/rate-studio");
  await fillScenario(page);
  await page.getByRole("button", { name: "현재 계수 저장", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("검증용");
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "계수표 내보내기", exact: true }).click();
  const file = await event;
  const path = await file.path();
  const json = await readFile(path!, "utf8");
  await page.reload();
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByLabel("저장한 계수표 JSON 불러오기", { exact: true }).setInputFiles({ name: "rules.json", mimeType: "application/json", buffer: Buffer.from(json) });
  await expect(page.getByRole("heading", { name: "반영 전 확인 · 1개" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByRole("button", { name: "확인한 계수표에 반영", exact: true }).click();
  await page.getByRole("button", { name: "검증용 롱폼 PPL 불러오기", exact: true }).click();
  await expect(page.getByLabel("계수 a · 원 / 구독자 1명", { exact: true })).toHaveValue("2.5");
  await page.getByRole("button", { name: "검증용 롱폼 PPL 삭제", exact: true }).click();
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("transaction calibration is local, evidence-based, and warns on extrapolation", async ({ page }, testInfo) => {
  await page.goto("/rate-studio");
  await page.getByRole("button", { name: "거래 내역으로 보정", exact: true }).click();
  await page.getByLabel("거래 자료 근거", { exact: true }).fill("합성 자료 · 부가세 별도");
  await page.getByLabel("거래 CSV 불러오기", { exact: true }).setInputFiles({ name: "quotes.csv", mimeType: "text/csv", buffer: Buffer.from(CSV) });
  await expect(page.getByRole("heading", { name: "반영 전 확인 · 1개" })).toBeVisible();
  await expect(page.getByText("a = 2 · b = 100,000원")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("rate-studio-calibration.png"), fullPage: true });
  await page.getByRole("button", { name: "확인한 계수표에 반영", exact: true }).click();
  await page.getByRole("button", { name: "검증용 롱폼 PPL 불러오기", exact: true }).click();
  await page.getByLabel("구독자 수 X", { exact: true }).fill("50000");
  await page.getByRole("button", { name: "계산하기", exact: true }).click();
  await expect(page.getByTestId("estimated-amount")).toHaveText("200,000원");
  await expect(page.getByText(/외삽 결과/u)).toBeVisible();
  await page.getByLabel("계수 a · 원 / 구독자 1명", { exact: true }).fill("3");
  await page.getByRole("button", { name: "계산하기", exact: true }).click();
  await expect(page.getByText(/보정 3건/u)).toHaveCount(0);
});

test("bad files fail atomically, text is escaped and page stays within the viewport", async ({ page }) => {
  await page.goto("/rate-studio");
  await page.getByRole("button", { name: "거래 내역으로 보정", exact: true }).click();
  await page.getByLabel("거래 자료 근거", { exact: true }).fill("검증");
  await page.getByLabel("거래 CSV 불러오기", { exact: true }).setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from(`${CSV}부족,shorts,10,10`) });
  await expect(studioAlert(page)).toContainText("최소 3건");
  await expect(page.getByRole("button", { name: "확인한 계수표에 반영", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "직접 입력", exact: true }).click();
  await fillScenario(page);
  await page.getByLabel("계수 근거", { exact: true }).fill('<img src=x onerror="alert(1)">');
  await page.getByRole("button", { name: "계산하기", exact: true }).click();
  await expect(page.getByRole("region", { name: "산정 결과" }).locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
