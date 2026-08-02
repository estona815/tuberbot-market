import { describe, expect, it } from "vitest";
import { verifySandboxVerticalFlow } from "../../src/application/verify-sandbox-vertical";

describe("sandbox marketplace vertical", () => {
  it("moves one accepted contract through funded, fee allocation, payout, and completion", async () => {
    const report = await verifySandboxVerticalFlow();

    expect(report.mode).toBe("SANDBOX_VERIFIED");
    expect(report.orderStatus).toBe("COMPLETED");
    expect(report.paymentStatus).toBe("FUNDED");
    expect(report.paymentWebhookDeduplicated).toBe(true);
    expect(report.sellerStatus).toBe("APPROVED");
    expect(report.payoutStatus).toBe("PAID");
    expect(report.platformFeeKrw).toBe(54_000n);
    expect(report.creatorReceivableKrw).toBe(396_000n);
    expect(report.ledger).toHaveLength(3);
    expect(report.orderEventCount).toBe(13);
    expect(report.contractSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
