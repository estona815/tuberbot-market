import { describe, expect, it } from "vitest";

import {
  canonicalizeJson,
  createContractSnapshot,
  verifyContractSnapshot,
} from "../../src/domain";

const baseContract = {
  contractId: "contract-1",
  version: 1,
  proposalVersionId: "proposal-v3",
  createdAt: "2026-08-02T01:00:00.000Z",
  parties: [
    {
      partyId: "advertiser-1",
      role: "ADVERTISER" as const,
      acceptedAt: "2026-08-02T00:58:00.000Z",
      evidenceId: "evidence-advertiser-1",
    },
    {
      partyId: "creator-1",
      role: "CREATOR" as const,
      acceptedAt: "2026-08-02T00:59:00.000Z",
      evidenceId: "evidence-creator-1",
    },
  ],
  policies: {
    marketplaceTerms: "marketplace-v1-draft",
    refundPolicy: "refund-v1-draft",
    privacyPolicy: "privacy-v2",
    feeRuleId: "fee-market-v7",
    feeRuleVersion: 7,
  },
};

describe("canonical contract snapshots", () => {
  it("sorts object keys and produces a stable SHA-256 hash", () => {
    const first = createContractSnapshot({
      ...baseContract,
      terms: {
        usage: { paidMedia: false, organicPublish: true },
        priceKrw: "1000000",
        revisionCount: 2,
      },
    });
    const second = createContractSnapshot({
      ...baseContract,
      terms: {
        revisionCount: 2,
        priceKrw: "1000000",
        usage: { organicPublish: true, paidMedia: false },
      },
    });

    expect(first.canonicalJson).toBe(second.canonicalJson);
    expect(first.sha256).toBe(second.sha256);
    expect(first.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(verifyContractSnapshot(first)).toBe(true);
    expect(first.document.legalReviewStatus).toBe("DRAFT_NEEDS_COUNSEL");
  });

  it("deep-freezes accepted terms instead of retaining caller references", () => {
    const mutableTerms = { brief: { requiredText: "광고" } };
    const snapshot = createContractSnapshot({ ...baseContract, terms: mutableTerms });
    mutableTerms.brief.requiredText = "changed outside";

    expect(snapshot.document.terms).toEqual({ brief: { requiredText: "광고" } });
    expect(Object.isFrozen(snapshot.document)).toBe(true);
    expect(Object.isFrozen(snapshot.document.parties)).toBe(true);
    expect(() => {
      const terms = snapshot.document.terms as { brief: { requiredText: string } };
      terms.brief.requiredText = "mutation";
    }).toThrow();
  });

  it("rejects values that cannot be canonical JSON", () => {
    expect(() => canonicalizeJson({ amountKrw: 100n })).toThrow(/unsupported/iu);
    expect(() => canonicalizeJson({ missing: undefined })).toThrow(/unsupported/iu);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => canonicalizeJson(cyclic)).toThrow(/cycles/iu);
  });

  it("requires both advertiser and creator acceptances", () => {
    expect(() =>
      createContractSnapshot({
        ...baseContract,
        parties: [baseContract.parties[0]!],
        terms: {},
      }),
    ).toThrow(/exactly two/iu);
  });
});
