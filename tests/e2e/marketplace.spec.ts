import { expect, test } from "@playwright/test";

test("public preview search and local save interactions work", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto("/market");
  await expect(page.getByRole("heading", { name: "광고 상품 구성 미리보기" })).toBeVisible();
  await page.getByPlaceholder("채널명, 카테고리, 광고 형식을 검색하세요").fill("테크");
  await expect(page.getByRole("link", { name: "롱폼 통합 광고" })).toBeVisible();
  await expect(page.getByRole("link", { name: "15초 Shorts 제품 소개" })).toHaveCount(0);
  const save = page.locator('button[aria-label^="롱폼 통합 광고"]');
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await expect(save).toHaveAttribute("aria-label", /찜 취소$/);
  expect(consoleErrors).toEqual([]);
});

test("authenticated order workspace records an approval and a message", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "stateful sandbox flow runs once");
  const orderNumber = `TBM-20260802-E2E-R${testInfo.retry}`;
  const returnTo = `/orders/${orderNumber}`;
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  await expect(page.getByLabel("이메일")).toHaveCount(0);
  await page.getByRole("button", { name: "광고주 로컬 데모" }).click();
  await expect(page).toHaveURL(new RegExp(`${returnTo}$`, "u"));

  await expect(page.getByRole("heading", { name: "주문 작업방" })).toBeVisible();
  await page.getByRole("button", { name: "최종 승인" }).click();
  await expect(page.getByText("주문 기록에 안전하게 반영했습니다.")).toBeVisible();
  await expect(page.locator(".order-titlebar")).not.toContainText("초안 검수 중");
  await page.getByLabel("주문 기록에 남을 메시지").fill("게시 전 광고 표시 문구를 다시 확인해 주세요.");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByText("게시 전 광고 표시 문구를 다시 확인해 주세요.")).toBeVisible();
});

test("public and local-only route inventory follows the preview access policy", async ({ request }) => {
  const publicRoutes = ["/", "/market", "/creators", "/creators/haru-store", "/packages/pkg_shorts_intro", "/campaigns", "/campaigns/cmp_lifestyle_launch", "/categories/lifestyle", "/how-it-works", "/safety", "/pricing", "/for-creators", "/for-advertisers", "/for-agencies", "/help", "/legal/terms", "/legal/marketplace", "/legal/privacy", "/legal/refunds", "/legal/prohibited-content", "/legal/reviews", "/legal/safe-payment"];
  const localOnlyRoutes = ["/login", "/signup", "/onboarding", "/onboarding/creator", "/onboarding/advertiser", "/verification/channel", "/verification/seller", "/verification/business", "/dashboard", "/dashboard/creator/packages", "/dashboard/advertiser/campaigns", "/dashboard/agency", "/orders/TBM-20260802-001", "/orders/TBM-20260802-001/contract", "/orders/TBM-20260802-001/deliverables", "/orders/TBM-20260802-001/payment", "/orders/TBM-20260802-001/dispute", "/messages", "/licenses", "/reviews", "/notifications", "/settings/security", "/admin/reconciliation", "/admin/audit"];
  for (const route of [...publicRoutes, ...localOnlyRoutes]) {
    const response = await request.get(route);
    expect(response.status(), `${route} should not be missing`).toBeLessThan(400);
  }
  for (const route of ["/dashboard", "/orders/TBM-20260802-001", "/admin/audit"]) {
    const response = await request.get(route);
    expect(await response.text()).toContain("noindex");
  }

  const admin = await request.get("/admin");
  expect(admin.status()).toBe(404);
  expect(await admin.text()).not.toContain("시스템 상태");
});

test("health endpoint fails closed for live payment", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = await response.json();
  expect(body.payment.mode).toBe("SANDBOX");
  expect(body.payment.livePayment).toBe("BLOCKED_EXTERNAL");
  expect(body.payment.safePaymentPublicBadge).toBe("DISABLED");
  expect(body.checks.liveActivationBlockers.length).toBeGreaterThan(0);
});

test("390px layout has no horizontal page overflow and mobile menu works", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only layout assertion");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /유튜브 광고/ })).toBeVisible();
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await expect(page.getByRole("navigation", { name: "모바일 메뉴" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/market");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
