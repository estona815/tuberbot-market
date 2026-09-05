import { describe, expect, it } from "vitest";
import { parseShortlist } from "@/domain/creator-shortlist";
const allowed = new Set(["a", "b", "c"]);
describe("public channel shortlist", () => {
  it("accepts known IDs only in stable unique order", () => { expect(parseShortlist('["b","a","b","unknown",{},2]', allowed)).toEqual(["b", "a"]); });
  it.each([null, "", "broken", "null", "{}", '"a"', "x".repeat(8193)])("ignores corrupt values", (raw) => { expect(parseShortlist(raw, allowed)).toEqual([]); });
  it("does not store private arbitrary fields", () => { expect(parseShortlist('[{"email":"test@example.com"},"email@example.com"]', allowed)).toEqual([]); });
  it("caps the shortlist", () => { const ids = Array.from({ length: 50 }, (_, i) => String(i)); expect(parseShortlist(JSON.stringify(ids), new Set(ids))).toHaveLength(30); });
});
