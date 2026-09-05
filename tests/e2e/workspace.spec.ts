import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
const app = (page: Page) => page.getByTestId("project-workspace");
const current = (page: Page) => app(page).getByRole("region", { name: "현재 단계 작업" });
async function role(page: Page, who: "광고주" | "크리에이터") { await app(page).getByLabel("체험 역할").getByRole("button", { name: who, exact: true }).click(); }
async function begin(page: Page) {
  await page.goto("/workspace");
  await page.getByRole("button", { name: "가상 캠페인으로 체험", exact: true }).click();
  await expect(current(page).getByLabel("캠페인명", { exact: true })).toHaveValue("가상 브랜드 신제품 캠페인");
  await current(page).getByRole("button", { name: "제안 보내기", exact: true }).click();
  await expect(current(page).getByRole("heading", { name: "조건 v1 · 광고주 제안" })).toBeVisible();
}
async function agree(page: Page) {
  await role(page,"크리에이터");
  await current(page).getByText("조건을 바꿔 역제안하기", { exact: true }).click();
  await current(page).getByLabel("제안 금액 · 원", { exact: true }).fill("1100000");
  await current(page).getByRole("button", { name: "역제안 보내기", exact: true }).click();
  await expect(current(page).getByRole("heading", { name: "조건 v2 · 크리에이터 제안" })).toBeVisible();
  await current(page).getByRole("button", { name: "크리에이터가 v2 수락", exact: true }).click();
  await role(page,"광고주");
  await current(page).getByRole("button", { name: "광고주가 v2 수락", exact: true }).click();
  await expect(current(page).getByRole("heading", { name: "계약 합의 완료" })).toBeVisible();
}
test("entered collaboration survives reload and completes all steps without real payments", async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await begin(page); await agree(page);
  const contract = app(page).getByRole("complementary", { name: "계약 스냅샷" });
  await expect(contract).toContainText("1,100,000원");
  await expect(contract).toContainText("132,000원");
  await contract.getByText("내용 해시 SHA-256", { exact: true }).click();
  const hash = await contract.locator("code").textContent(); expect(hash).toMatch(/^[a-f0-9]{64}$/u);
  const downloadEvent = page.waitForEvent("download");
  await contract.getByRole("button", { name: "계약 검토본 받기" }).click();
  const download = await downloadEvent; const text = await readFile((await download.path())!, "utf8");
  expect(text).toContain(hash!); expect(text).toContain("실제 계약 체결 증명이 아닙니다");
  await page.reload(); await expect(current(page).getByRole("heading", { name: "계약 합의 완료" })).toBeVisible();
  await current(page).getByLabel("모의 결제 수단").selectOption("NAVER_PAY");
  await current(page).getByRole("button", { name: "실제 청구 없이 결제 단계 확인" }).click();
  await role(page,"크리에이터");
  await current(page).getByLabel("제출 설명", { exact: true }).fill("광고 표시를 포함한 첫 검토본");
  await current(page).getByRole("button", { name: "검수 요청", exact: true }).click();
  await role(page,"광고주");
  await current(page).getByText("수정 요청 · 0/1회 사용", { exact: true }).click();
  await current(page).getByLabel("수정 요청 사항").fill("광고 표시 위치 조정");
  await current(page).getByRole("button", { name: "수정 요청 보내기", exact: true }).click();
  await role(page,"크리에이터");
  await current(page).getByLabel("제출 설명", { exact: true }).fill("광고 표시 수정 완료");
  await current(page).getByRole("button", { name: "검수 요청", exact: true }).click();
  await role(page,"광고주");
  await expect(current(page).getByRole("button", { name: "최종 승인", exact: true })).toBeDisabled();
  await current(page).getByLabel("제작물과 광고 표시를 확인했습니다.").check();
  await current(page).getByRole("button", { name: "최종 승인", exact: true }).click();
  await role(page,"크리에이터");
  await current(page).getByLabel("게시한 YouTube URL", { exact: true }).fill("https://youtu.be/abcdefghijk");
  await current(page).getByRole("button", { name: "게시 링크 기록", exact: true }).click();
  await role(page,"광고주");
  await current(page).getByRole("button", { name: "구매 확인 · 정산 준비", exact: true }).click();
  await expect(current(page).getByRole("heading", { name: "정산 준비까지 기록했습니다." })).toBeVisible();
  await expect(current(page)).toContainText("실제 지급 비활성화");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("workspace-settlement.png"), fullPage: true });
  expect(errors).toEqual([]);
});
test("work files restore only after confirmation and disputes lock the workflow", async ({ page }, info) => {
  await begin(page); await agree(page);
  const event = page.waitForEvent("download");
  await app(page).getByRole("button", { name: "작업 파일 받기", exact: true }).click();
  const data = await readFile((await (await event).path())!, "utf8");
  await app(page).getByRole("button", { name: "이 브라우저의 작업 삭제", exact: true }).click();
  await app(page).getByRole("button", { name: "삭제 확인", exact: true }).click();
  await expect(page.getByRole("heading", { name: "첫 캠페인부터 시작하세요." })).toBeVisible();
  await app(page).getByLabel("작업 파일 가져오기").setInputFiles({ name: "work.json", mimeType: "application/json", buffer: Buffer.from(data) });
  await expect(page.getByRole("heading", { name: "1개 작업을 확인했습니다." })).toBeVisible();
  await app(page).getByRole("button", { name: "확인 후 교체", exact: true }).click();
  await expect(current(page).getByRole("heading", { name: "계약 합의 완료" })).toBeVisible();
  await app(page).getByText("분쟁 사유를 남기고 진행 보류", { exact: true }).click();
  await app(page).getByLabel("분쟁 사유", { exact: true }).fill("사용권 범위를 다시 확인해야 합니다.");
  await app(page).getByRole("button", { name: "분쟁 보류 기록", exact: true }).click();
  await expect(app(page)).toContainText("이 체험 화면에서는 보류를 해제하지 않습니다.");
  await expect(current(page).getByRole("button", { name: "실제 청구 없이 결제 단계 확인" })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("workspace-dispute.png"), fullPage: true });
});
test("public launch and account pages disclose unconfigured dependencies and protect write APIs", async ({ page, request }, info) => {
  for (const route of ["/", "/workspace", "/launch", "/account", "/workspace/connected"]) {
    await page.goto(route); await expect(page.locator("main#main-content")).not.toBeEmpty();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (["/","/workspace","/launch"].includes(route)) await page.screenshot({ path: info.outputPath(`${route === "/" ? "home" : route.slice(1)}-review.png`), fullPage: true });
  }
  await expect(page.getByText("운영 연결 후 사용할 수 있습니다.", { exact: true })).toBeVisible();
  const release = await request.get("/api/release-status"); const status = await release.json();
  expect(status.livePayments).toBe(false); expect(status.livePayouts).toBe(false);
  expect(status.identityConfigured).toBe(false);
  expect((await request.post("/api/projects", { data: { creatorUserId: "00000000-0000-4000-8000-000000000001" } })).status()).toBe(503);
  expect((await request.get("/api/channels/lookup?channel=@test")).status()).toBe(503);
});
