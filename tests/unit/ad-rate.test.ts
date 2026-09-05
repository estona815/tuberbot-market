import { describe, expect, it } from "vitest";
import {
  calibrateRules, csvCell, estimateRate, exportEstimateCsv, exportRules,
  importRules, MAX_IMPORT_BYTES, parseQuoteCsv, validateRule, type RateRule,
} from "@/domain/ad-rate";

// Synthetic fixtures only; these numbers are not market rates or production defaults.
const NOW = new Date("2026-09-05T00:00:00.000Z");
const rule: RateRule = { category: "테스트", format: "integration", a: "2.5", bKrw: "100000", source: "합성 테스트 자료", updatedAt: NOW.toISOString() };
const CSV = "category,format,subscribers,priceKrw\n테스트,integration,10000,120000\n테스트,integration,20000,140000\n테스트,integration,30000,160000\n";

describe("exact local ad-rate calculation", () => {
  it("implements Y=aX+b without converting money to floating point", () => {
    const result = estimateRate(rule, "100,000", 1000, NOW);
    expect(result.amountKrw).toBe("350000");
    expect(result.lowerKrw).toBe("315000");
    expect(result.upperKrw).toBe("385000");
    expect(result.mode).toBe("SIMULATION_NOT_A_QUOTE");
    expect(result.rule.source).toBe("합성 테스트 자료");
    expect(result.createdAt).toBe(NOW.toISOString());
  });
  it("handles sub-won coefficients and half rounding exactly", () => {
    expect(estimateRate({ ...rule, a: "0.000001", bKrw: "1" }, "500000").amountKrw).toBe("2");
    expect(estimateRate({ ...rule, a: "0.1", bKrw: "1" }, "5").amountKrw).toBe("2");
  });
  it("accepts a negative intercept if the final amount is positive", () => {
    expect(estimateRate({ ...rule, a: "2", bKrw: "-100" }, "100").amountKrw).toBe("100");
  });
  it("supports zero subscribers and zero slope when the intercept is positive", () => {
    expect(estimateRate({ ...rule, a: "0" }, "0").amountKrw).toBe("100000");
  });
  it.each(["", "-1", "1e5", "Infinity", "NaN", "100.5", "10,00", "1 000", "1000000001", "<script>"])("rejects invalid subscriber input %s", (input) => {
    expect(() => estimateRate(rule, input)).toThrow();
  });
  it.each(["", "-1", "1e2", "1.0000001", "Infinity", "1,2", "1000001"])("rejects invalid coefficient %s", (a) => {
    expect(() => estimateRate({ ...rule, a }, "100000")).toThrow();
  });
  it.each(["", "1.5", "Infinity", "1e5", "1000000000001"])("rejects invalid intercept %s", (bKrw) => {
    expect(() => estimateRate({ ...rule, bKrw }, "100000")).toThrow();
  });
  it.each([-1, 5001, 0.5, NaN, Infinity])("rejects invalid margin %s", (margin) => {
    expect(() => estimateRate(rule, "100000", margin)).toThrow();
  });
  it.each(["-300000", "-250000"])("never produces a negative or zero fee", (bKrw) => {
    expect(() => estimateRate({ ...rule, bKrw }, "100000")).toThrow(/0원 이하/u);
  });
  it("rejects amount overflow while preserving precision at the supported maximum", () => {
    expect(estimateRate({ ...rule, a: "1000", bKrw: "0" }, "1000000000").amountKrw).toBe("1000000000000");
    expect(() => estimateRate({ ...rule, a: "1000", bKrw: "1" }, "1000000000")).toThrow();
  });
  it("defaults to no invented uncertainty interval", () => {
    const result = estimateRate(rule, "100000");
    expect(result.lowerKrw).toBe(result.upperKrw);
    expect(result.marginBps).toBe(0);
    expect(result.warnings.join()).not.toContain("신뢰구간");
  });
  it("copies the validated rule into a self-contained snapshot", () => {
    const input = { ...rule };
    const result = estimateRate(input, "100000");
    input.a = "500";
    expect(result.rule.a).toBe("2.5");
  });
});

describe("rule provenance, files and data boundaries", () => {
  it.each(["", "\n", "x".repeat(241)])("requires a bounded single-line source", (source) => {
    expect(() => validateRule({ ...rule, source })).toThrow();
  });
  it("rejects unknown formats, fields, invalid timestamps and scalar documents", () => {
    for (const input of [null, [], 1, { ...rule, format: "wrong" }, { ...rule, admin: true }, { ...rule, updatedAt: "tomorrow" }]) {
      expect(() => validateRule(input)).toThrow();
    }
  });
  it("round-trips a rule library without asserting approval", () => {
    expect(importRules(exportRules([rule]))).toEqual([rule]);
    expect(importRules(`\uFEFF${exportRules([rule])}`)).toEqual([rule]);
  });
  it.each(["{", "[]", '{"schemaVersion":2,"rules":[]}', '{"schemaVersion":1,"rules":[]}'])("rejects malformed library %s", (input) => {
    expect(() => importRules(input)).toThrow();
  });
  it("rejects duplicate keys and overlarge libraries", () => {
    expect(() => importRules(exportRules([rule, rule]))).toThrow(/중복/u);
    expect(() => importRules(exportRules(Array.from({ length: 51 }, (_, i) => ({ ...rule, category: String(i) }))))).toThrow();
  });
  it("enforces byte limits with multibyte input", () => {
    expect(() => importRules("x".repeat(MAX_IMPORT_BYTES + 1))).toThrow(/128 KB/u);
    expect(() => parseQuoteCsv("가".repeat(MAX_IMPORT_BYTES / 2))).toThrow(/128 KB/u);
  });
  it.each(["=1+1", "+SUM(A1)", "-1", "@command", "  =formula", "\ttext"])("neutralizes spreadsheet injection %s", (input) => {
    expect(csvCell(input).startsWith('"\'')).toBe(true);
  });
  it("escapes commas and quotes, and includes the simulation label in exports", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    const csv = exportEstimateCsv(estimateRate({ ...rule, source: "=1+1" }, "100000", 0, NOW));
    expect(csv).toContain("SIMULATION_NOT_A_QUOTE");
    expect(csv).toContain('"\'=1+1"');
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
});

describe("transparent ordinary least squares calibration", () => {
  it("recovers a known line from synthetic transaction data", () => {
    const [fitted] = calibrateRules(CSV, "합성 자료", NOW);
    expect(fitted?.a).toBe("2");
    expect(fitted?.bKrw).toBe("100000");
    expect(fitted?.calibration).toEqual({ sampleCount: 3, subscriberMin: "10000", subscriberMax: "30000", trainingMaeKrw: "0" });
    expect(estimateRate(fitted, "20000").warnings).toHaveLength(1);
    expect(estimateRate(fitted, "50000").warnings.join()).toContain("외삽");
  });
  it("handles quoted Korean categories, BOM, CRLF and grouped integer strings", () => {
    const csv = CSV.replaceAll("테스트", '"테스트, 분류"').replaceAll("\n", "\r\n").replace(",10000,", ',"10,000",');
    expect(calibrateRules(`\uFEFF${csv}`, "합성 자료", NOW)[0]?.category).toBe("테스트, 분류");
  });
  it("computes fractional coefficients", () => {
    const csv = "category,format,subscribers,priceKrw\nX,shorts,10,103\nX,shorts,20,106\nX,shorts,30,109";
    expect(calibrateRules(csv, "합성 자료", NOW)[0]?.a).toBe("0.3");
  });
  it("keeps categories and ad formats separate", () => {
    const csv = CSV + CSV.split("\n").slice(1).join("\n").replaceAll("integration", "shorts");
    expect(calibrateRules(csv, "합성 자료")).toHaveLength(2);
  });
  it("rejects any group with too few observations, atomically", () => {
    expect(() => calibrateRules(`${CSV}다른범주,shorts,10000,50000`, "합성 자료")).toThrow(/최소 3건/u);
  });
  it("rejects all-equal subscriber counts", () => {
    expect(() => calibrateRules(CSV.replaceAll("20000,", "10000,").replaceAll("30000,", "10000,"), "합성 자료")).toThrow(/모두 같습니다/u);
  });
  it("rejects a negative slope without clamping or inventing fallback values", () => {
    const csv = "category,format,subscribers,priceKrw\nX,shorts,10,300\nX,shorts,20,200\nX,shorts,30,100";
    expect(() => calibrateRules(csv, "합성 자료")).toThrow(/음수 기울기/u);
  });
  it.each([
    CSV.replace("category", "email"),
    CSV.replace("10000", "=1+1"),
    CSV.replace("120000", "0"),
    CSV.replace("120000", "-1"),
    CSV.replace("integration", "wrong"),
    CSV.replace("테스트", '"닫히지 않음'),
    CSV.replace("테스트", '"잘못된"값'),
    CSV.replace("테스트", "한\r글"),
    CSV.replace("120000", "120000,extra"),
  ])("rejects malformed CSV", (csv) => { expect(() => calibrateRules(csv, "합성 자료")).toThrow(); });
  it("rejects forged calibration bounds and sample counts on JSON import", () => {
    for (const calibration of [
      { sampleCount: 2, subscriberMin: "1", subscriberMax: "10", trainingMaeKrw: "0" },
      { sampleCount: 3, subscriberMin: "10", subscriberMax: "1", trainingMaeKrw: "0" },
      { sampleCount: 3, subscriberMin: "1", subscriberMax: "10", trainingMaeKrw: "-1" },
    ]) expect(() => validateRule({ ...rule, calibration })).toThrow();
  });
});
