import { z } from "zod";

/** Planning assumptions selected for this product, NOT observed creator prices or API-derived metrics. */
export const BUDGET_MODEL = "planning-2026-09-v1";
export const CATEGORY_LABELS = { lifestyle: "라이프스타일", food: "음식·리빙", beauty: "뷰티·패션", tech: "IT·앱", education: "교육·지식", travel: "여행·아웃도어" } as const;
export const FORMAT_LABELS = { shorts: "쇼츠", integration: "롱폼 PPL", branded: "브랜디드 영상" } as const;
export const USAGE_LABELS = { channel: "채널 게시만", organic: "브랜드 채널 재사용", paid: "유료 광고 소재 사용" } as const;
export const budgetSchema = z.strictObject({
  category: z.enum(["lifestyle", "food", "beauty", "tech", "education", "travel"]),
  format: z.enum(["shorts", "integration", "branded"]),
  subscribers: z.number().int().min(0).max(1_000_000),
  quantity: z.number().int().min(1).max(10),
  usage: z.enum(["channel", "organic", "paid"]),
});
export type BudgetInput = z.infer<typeof budgetSchema>;
export const DEFAULT_BUDGET: BudgetInput = { category: "lifestyle", format: "shorts", subscribers: 50000, quantity: 1, usage: "channel" };
export const PLAN_BASES = { shorts: { a: 2n, b: 190000n }, integration: { a: 4n, b: 390000n }, branded: { a: 8n, b: 890000n } } as const;
const categoryBps = { lifestyle: 10000n, food: 10000n, beauty: 11000n, tech: 12000n, education: 10000n, travel: 11500n } as const;
const usageBps = { channel: 10000n, organic: 12000n, paid: 15000n } as const;
const rounded = (value: bigint, divisor: bigint) => (value + divisor / 2n) / divisor;
export function campaignBudget(raw: unknown) {
  const input = budgetSchema.parse(raw), base = PLAN_BASES[input.format];
  const unit = rounded((base.a * BigInt(input.subscribers) + base.b) * categoryBps[input.category] * usageBps[input.usage], 100_000_000n);
  const amount = unit * BigInt(input.quantity);
  return {
    model: BUDGET_MODEL, input, currency: "KRW" as const,
    amountKrw: amount.toString(), vatKrw: rounded(amount,10n).toString(), totalWithVatKrw: (amount + rounded(amount,10n)).toString(),
    lowerKrw: rounded(amount * 80n,100n).toString(), upperKrw: rounded(amount * 120n,100n).toString(),
    baseA: base.a.toString(), baseB: base.b.toString(), categoryFactor: Number(categoryBps[input.category]) / 10000, usageFactor: Number(usageBps[input.usage]) / 10000,
    label: "자체 기준 예상 예산", disclaimer: "초기 기획을 위한 가정값입니다. 특정 채널의 판매가·섭외 가능 여부·성과를 뜻하지 않습니다.",
  };
}
export type BudgetResult = ReturnType<typeof campaignBudget>;
export function budgetFromQuery(params: URLSearchParams): BudgetInput {
  const number = (name: string, fallback: number) => { const raw = params.get(name); return raw !== null && /^\d{1,7}$/u.test(raw) ? Number(raw) : fallback; };
  const candidate = budgetSchema.safeParse({ category: params.get("category") ?? DEFAULT_BUDGET.category, format: params.get("format") ?? DEFAULT_BUDGET.format, subscribers: number("size", DEFAULT_BUDGET.subscribers), quantity: number("quantity",1), usage: params.get("usage") ?? "channel" });
  return candidate.success ? candidate.data : { ...DEFAULT_BUDGET };
}
export function budgetQuery(input: BudgetInput): string {
  const safe = budgetSchema.parse(input);
  return new URLSearchParams({ category: safe.category, format: safe.format, size: String(safe.subscribers), quantity: String(safe.quantity), usage: safe.usage }).toString();
}
export function budgetText(result: BudgetResult, channelName?: string): string {
  return ["튜버봇 캠페인 예산 기획안", `산정 기준: ${BUDGET_MODEL}`, "", `분야: ${CATEGORY_LABELS[result.input.category]}`, `형식: ${FORMAT_LABELS[result.input.format]} ${result.input.quantity}편`, `희망 채널 규모(직접 지정): ${result.input.subscribers.toLocaleString("ko-KR")}명`, `사용 범위: ${USAGE_LABELS[result.input.usage]}`, ...(channelName ? [`관심 채널: ${channelName} (제휴·섭외 확정 아님)`] : []), "", `자체 기준 예상 예산: ${BigInt(result.amountKrw).toLocaleString("ko-KR")}원 (부가세 별도)`, `부가세 포함: ${BigInt(result.totalWithVatKrw).toLocaleString("ko-KR")}원`, `기획 여유범위 ±20%: ${BigInt(result.lowerKrw).toLocaleString("ko-KR")}~${BigInt(result.upperKrw).toLocaleString("ko-KR")}원`, "범위는 임의로 정한 여유율이며 통계적 예측구간이 아닙니다.", result.disclaimer, "제작 일정·수정 횟수·제품 배송·사용권 기간은 문의 내용에 추가하세요."].join("\n");
}
export const inquirySchema = z.strictObject({
  brand: z.string().trim().min(1,"브랜드명을 입력하세요.").max(80),
  email: z.string().trim().email("회신받을 이메일을 확인하세요.").max(254),
  goal: z.enum(["awareness","sales","app","other"]),
  message: z.string().trim().max(1200),
  privacyConsent: z.literal(true, { error: "문의 처리 동의가 필요합니다." }),
  transferConsent: z.literal(true, { error: "해외 저장 안내 동의가 필요합니다." }),
});
export const LEAD_HOST = "tuberbot-review.netlify.app";
export const LEAD_FORM = "tuberbot-inquiry-v1";
export const PRIVACY_VERSION = "inquiry-2026-09-05-v1";
