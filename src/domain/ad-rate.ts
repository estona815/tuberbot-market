/** Local planning mathematics only. Never an approved marketplace rate or payment amount. */
export const RATE_SCHEMA_VERSION = 1;
export const RATE_SCALE = 1_000_000n;
export const MAX_IMPORT_BYTES = 131_072;
export const FORMATS = ["integration", "dedicated", "shorts", "other"] as const;
export type AdFormat = (typeof FORMATS)[number];
export const FORMAT_LABELS: Record<AdFormat, string> = {
  integration: "롱폼 PPL", dedicated: "브랜디드 영상", shorts: "쇼츠", other: "기타",
};
const MAX_SUBSCRIBERS = 1_000_000_000n;
const MAX_KRW = 1_000_000_000_000n;
const MAX_RULES = 50;

export interface Calibration {
  sampleCount: number;
  subscriberMin: string;
  subscriberMax: string;
  trainingMaeKrw: string;
}
export interface RateRule {
  category: string;
  format: AdFormat;
  a: string;
  bKrw: string;
  source: string;
  updatedAt: string;
  calibration?: Calibration;
}
export interface RateEstimate {
  schemaVersion: 1;
  mode: "SIMULATION_NOT_A_QUOTE";
  currency: "KRW";
  createdAt: string;
  subscribers: string;
  amountKrw: string;
  lowerKrw: string;
  upperKrw: string;
  marginBps: number;
  rule: RateRule;
  warnings: string[];
}

function fail(message: string): never { throw new Error(message); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("객체 형식의 계수 자료가 필요합니다.");
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail("지원하지 않는 필드가 있습니다. 파일 형식을 확인하세요.");
}
function text(value: unknown, label: string, max = 80): string {
  if (typeof value !== "string") fail(`${label}을(를) 입력하세요.`);
  const clean = value.trim();
  if (!clean || clean.length > max || /[\u0000-\u001f\u007f]/u.test(clean)) fail(`${label}은(는) 1~${max}자의 한 줄 텍스트여야 합니다.`);
  return clean;
}
function integer(value: unknown, label: string, min: bigint, max: bigint): bigint {
  if (typeof value !== "string" || value.length > 40) fail(`${label}을(를) 정수로 입력하세요.`);
  const clean = value.trim();
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)$/u.test(clean)) fail(`${label}은(는) 정수여야 합니다. 지수 표기는 지원하지 않습니다.`);
  const result = BigInt(clean.replaceAll(",", ""));
  if (result < min || result > max) fail(`${label}의 허용 범위는 ${min.toLocaleString("ko-KR")}~${max.toLocaleString("ko-KR")}입니다.`);
  return result;
}
function coefficient(value: unknown): bigint {
  if (typeof value !== "string" || value.length > 32 || !/^\d+(?:\.\d{1,6})?$/u.test(value.trim())) fail("a는 0 이상의 숫자이며 소수점 6자리까지 입력할 수 있습니다.");
  const [whole = "0", fraction = ""] = value.trim().split(".");
  const result = BigInt(whole) * RATE_SCALE + BigInt(fraction.padEnd(6, "0"));
  if (result > 1_000_000n * RATE_SCALE) fail("a는 구독자 1명당 1,000,000원 이하여야 합니다.");
  return result;
}
function formatCoefficient(value: bigint): string {
  const fraction = (value % RATE_SCALE).toString().padStart(6, "0").replace(/0+$/u, "");
  return `${value / RATE_SCALE}${fraction ? `.${fraction}` : ""}`;
}
/** Round half away from zero; all calculations remain in integer fixed-point arithmetic. */
function round(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) fail("계산 분모가 올바르지 않습니다.");
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator < 0n ? -numerator : numerator;
  return sign * ((absolute + denominator / 2n) / denominator);
}
export function ruleKey(rule: Pick<RateRule, "category" | "format">): string {
  return `${rule.category.normalize("NFC")}\u0000${rule.format}`;
}
export function validateRule(value: unknown): RateRule {
  const raw = record(value);
  exactKeys(raw, ["category", "format", "a", "bKrw", "source", "updatedAt", "calibration"]);
  if (!FORMATS.includes(raw.format as AdFormat)) fail("광고 형식을 선택하세요.");
  const updatedAt = text(raw.updatedAt, "수정 시각", 30);
  if (!Number.isFinite(Date.parse(updatedAt)) || new Date(updatedAt).toISOString() !== updatedAt) fail("수정 시각은 ISO 8601 UTC 형식이어야 합니다.");
  const rule: RateRule = {
    category: text(raw.category, "카테고리", 40).normalize("NFC"),
    format: raw.format as AdFormat,
    a: formatCoefficient(coefficient(raw.a)),
    bKrw: integer(raw.bKrw, "b", -MAX_KRW, MAX_KRW).toString(),
    source: text(raw.source, "계수 근거", 240),
    updatedAt,
  };
  if (raw.calibration !== undefined) {
    const cal = record(raw.calibration);
    exactKeys(cal, ["sampleCount", "subscriberMin", "subscriberMax", "trainingMaeKrw"]);
    if (!Number.isInteger(cal.sampleCount) || (cal.sampleCount as number) < 3 || (cal.sampleCount as number) > 1000) fail("보정 표본 수가 올바르지 않습니다.");
    const min = integer(cal.subscriberMin, "최소 구독자 수", 0n, MAX_SUBSCRIBERS);
    const max = integer(cal.subscriberMax, "최대 구독자 수", min + 1n, MAX_SUBSCRIBERS);
    rule.calibration = {
      sampleCount: cal.sampleCount as number,
      subscriberMin: min.toString(), subscriberMax: max.toString(),
      trainingMaeKrw: integer(cal.trainingMaeKrw, "학습 평균 절대 오차", 0n, MAX_KRW).toString(),
    };
  }
  return rule;
}
function amount(rule: RateRule, subscribers: bigint): bigint {
  const result = round(coefficient(rule.a) * subscribers + BigInt(rule.bKrw) * RATE_SCALE, RATE_SCALE);
  if (result <= 0n || result > MAX_KRW) fail("산정 금액이 0원 이하이거나 1조 원을 넘습니다. 구독자 수와 a·b를 확인하세요.");
  return result;
}
export function estimateRate(rawRule: unknown, rawSubscribers: string, marginBps = 0, now = new Date()): RateEstimate {
  const rule = validateRule(rawRule);
  const subscribers = integer(rawSubscribers, "구독자 수", 0n, MAX_SUBSCRIBERS);
  if (!Number.isInteger(marginBps) || marginBps < 0 || marginBps > 5000) fail("참고 범위는 0~50%의 정수 비율이어야 합니다.");
  const predicted = amount(rule, subscribers);
  const warnings = ["입력한 계수의 계산 결과이며 확정 견적·시장 시세·성과 보장이 아닙니다."];
  if (rule.calibration && (subscribers < BigInt(rule.calibration.subscriberMin) || subscribers > BigInt(rule.calibration.subscriberMax))) {
    warnings.push("보정 표본의 구독자 범위를 벗어났습니다. 외삽 결과이므로 실제 견적을 별도로 확인하세요.");
  }
  if (marginBps > 0) warnings.push("참고 범위는 직접 설정한 비율입니다. 통계적 신뢰구간이나 예측구간이 아닙니다.");
  return {
    schemaVersion: RATE_SCHEMA_VERSION, mode: "SIMULATION_NOT_A_QUOTE", currency: "KRW",
    createdAt: now.toISOString(), subscribers: subscribers.toString(),
    amountKrw: predicted.toString(),
    lowerKrw: round(predicted * BigInt(10000 - marginBps), 10000n).toString(),
    upperKrw: round(predicted * BigInt(10000 + marginBps), 10000n).toString(),
    marginBps, rule, warnings,
  };
}
export function exportRules(rules: RateRule[]): string {
  return JSON.stringify({ schemaVersion: RATE_SCHEMA_VERSION, rules: rules.map(validateRule) }, null, 2);
}
function checkImportSize(input: string): void {
  if (new TextEncoder().encode(input).length > MAX_IMPORT_BYTES) fail("파일은 128 KB 이하만 불러올 수 있습니다.");
}
export function importRules(input: string): RateRule[] {
  checkImportSize(input);
  let parsed: unknown;
  try { parsed = JSON.parse(input.replace(/^\uFEFF/u, "")); } catch { fail("JSON 파일을 읽을 수 없습니다."); }
  const doc = record(parsed);
  exactKeys(doc, ["schemaVersion", "rules"]);
  if (doc.schemaVersion !== RATE_SCHEMA_VERSION || !Array.isArray(doc.rules) || doc.rules.length > MAX_RULES || doc.rules.length === 0) fail("버전 1의 계수표(1~50개)가 필요합니다.");
  const rules = doc.rules.map(validateRule);
  if (new Set(rules.map(ruleKey)).size !== rules.length) fail("같은 카테고리·광고 형식이 중복되어 있습니다.");
  return rules;
}

/** Small bounded RFC-4180 parser; quoted commas, CRLF and BOM are supported. */
export function parseQuoteCsv(input: string): string[][] {
  checkImportSize(input);
  const csv = input.replace(/^\uFEFF/u, "").replace(/\r\n/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, closedQuote = false;
  const pushCell = () => { row.push(cell.trim()); cell = ""; closedQuote = false; };
  const pushRow = () => {
    pushCell();
    if (row.some((entry) => entry !== "")) rows.push(row);
    row = [];
    if (rows.length > 1001) fail("거래 CSV는 헤더를 제외하고 최대 1,000행입니다.");
  };
  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i]!;
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else cell += char;
    } else if (char === ",") pushCell();
    else if (char === "\n") pushRow();
    else if (char === '"' && !cell && !closedQuote) quoted = true;
    else if (closedQuote || char === '"' || char === "\r") fail("CSV의 따옴표 또는 줄바꿈 형식이 올바르지 않습니다.");
    else cell += char;
    if (cell.length > 512 || row.length > 4) fail("CSV의 열 수 또는 셀 길이를 확인하세요.");
  }
  if (quoted) fail("CSV에 닫히지 않은 따옴표가 있습니다.");
  if (cell || row.length || closedQuote) pushRow();
  if (rows[0]?.join(",") !== "category,format,subscribers,priceKrw") fail("CSV 첫 행은 category,format,subscribers,priceKrw여야 합니다.");
  if (rows.length < 4 || rows.some((line) => line.length !== 4)) fail("CSV는 4개 열이며, 최소 3건의 거래가 필요합니다.");
  return rows.slice(1);
}
export function calibrateRules(csv: string, source: string, now = new Date()): RateRule[] {
  const evidence = text(source, "거래 자료 근거", 240);
  const rows = parseQuoteCsv(csv);
  const groups = new Map<string, { category: string; format: AdFormat; points: [bigint, bigint][] }>();
  for (const [index, row] of rows.entries()) {
    const category = text(row[0], `${index + 2}행 카테고리`, 40).normalize("NFC");
    const format = row[1] as AdFormat;
    if (!FORMATS.includes(format)) fail(`${index + 2}행 형식은 integration, dedicated, shorts, other 중 하나여야 합니다.`);
    const key = ruleKey({ category, format });
    const group = groups.get(key) ?? { category, format, points: [] };
    group.points.push([
      integer(row[2], `${index + 2}행 구독자 수`, 0n, MAX_SUBSCRIBERS),
      integer(row[3], `${index + 2}행 광고비`, 1n, MAX_KRW),
    ]);
    groups.set(key, group);
    if (groups.size > MAX_RULES) fail("한 번에 보정할 수 있는 카테고리·형식 조합은 최대 50개입니다.");
  }
  return [...groups.values()].map(({ category, format, points }) => {
    if (points.length < 3) fail(`${category} / ${FORMAT_LABELS[format]}: 최소 3건이 필요합니다. 일부만 적용하지 않았습니다.`);
    let sx = 0n, sy = 0n, sxx = 0n, sxy = 0n;
    for (const [x, y] of points) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
    const n = BigInt(points.length), denominator = n * sxx - sx * sx;
    if (denominator === 0n) fail(`${category}: 구독자 수가 모두 같습니다. 서로 다른 구독자 수가 필요합니다.`);
    const numerator = n * sxy - sx * sy;
    if (numerator < 0n) fail(`${category}: 음수 기울기가 나왔습니다. 이 자료는 증가형 단가식에 맞지 않아 자동 반영하지 않습니다.`);
    const a = round(numerator * RATE_SCALE, denominator);
    const b = round(sy * RATE_SCALE - a * sx, n * RATE_SCALE);
    const rule = validateRule({ category, format, a: formatCoefficient(a), bKrw: b.toString(), source: evidence, updatedAt: now.toISOString() });
    let totalError = 0n, min = points[0]![0], max = min;
    for (const [x, y] of points) {
      const delta = amount(rule, x) - y;
      totalError += delta < 0n ? -delta : delta;
      if (x < min) min = x;
      if (x > max) max = x;
    }
    rule.calibration = { sampleCount: points.length, subscriberMin: min.toString(), subscriberMax: max.toString(), trainingMaeKrw: round(totalError, n).toString() };
    return rule;
  });
}
/** Escape spreadsheet formula prefixes, including leading whitespace, in exported text cells. */
export function csvCell(value: string): string {
  const safe = /^[\s]*[=+\-@]/u.test(value) || /^[\t\r]/u.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function exportEstimateCsv(estimate: RateEstimate): string {
  const keys = ["category", "format", "subscribers", "a", "bKrw", "amountKrw", "lowerKrw", "upperKrw", "marginBps", "source", "mode", "createdAt"];
  const values = [estimate.rule.category, estimate.rule.format, estimate.subscribers, estimate.rule.a, estimate.rule.bKrw,
    estimate.amountKrw, estimate.lowerKrw, estimate.upperKrw, String(estimate.marginBps), estimate.rule.source, estimate.mode, estimate.createdAt];
  return `\uFEFF${keys.join(",")}\r\n${values.map(csvCell).join(",")}\r\n`;
}
