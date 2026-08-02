import { createHmac } from "node:crypto";
import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import {
  buildTossPayoutRequest,
  decodeTossSecurityKey,
  decryptTossPayoutJwe,
  encryptTossPayoutJwe,
  verifyTossPayoutWebhookHmac,
  verifyTossSignedWebhookDelivery,
  type ReplayGuard,
} from "../../src/providers";

const securityKeyHex = "11".repeat(32);
const now = new Date("2026-08-02T00:00:00.000Z");
const nonce = "123e4567-e89b-42d3-a456-426614174000";

class InMemoryReplayGuard implements ReplayGuard {
  readonly seen = new Set<string>();

  async consume(key: string): Promise<boolean> {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}

describe("Toss payout JWE", () => {
  it("requires a 32-byte key represented as 64 hexadecimal characters", () => {
    expect(decodeTossSecurityKey(securityKeyHex)).toHaveLength(32);
    expect(() => decodeTossSecurityKey("not-a-key")).toThrow(/64 hexadecimal/iu);
  });

  it("encrypts and authenticates compact JWE with dir/A256GCM, iat and nonce", async () => {
    const payload = {
      refPayoutId: "payout-1",
      destination: "seller-1",
      amount: { currency: "KRW", value: 880_000 },
    };
    const encrypted = await encryptTossPayoutJwe(payload, {
      securityKeyHex,
      now,
      nonce,
    });
    expect(encrypted.split(".")).toHaveLength(5);

    const decoded = await decryptTossPayoutJwe(encrypted, {
      securityKeyHex,
      now: new Date(now.getTime() + 1_000),
      decode: (value) => value as typeof payload,
    });
    expect(decoded).toEqual(payload);

    const compactParts = encrypted.split(".");
    const authenticationTag = compactParts[4];
    if (authenticationTag === undefined || authenticationTag.length === 0) {
      throw new Error("JWE authentication tag is empty");
    }
    compactParts[4] = `${authenticationTag[0] === "A" ? "B" : "A"}${authenticationTag.slice(1)}`;
    const tampered = compactParts.join(".");
    await expect(
      decryptTossPayoutJwe(tampered, {
        securityKeyHex,
        now,
        decode: (value) => value,
      }),
    ).rejects.toThrow(/authentication failed/iu);
  });

  it("uses a replay guard for decrypted response nonces", async () => {
    const encrypted = await encryptTossPayoutJwe({ result: "ok" }, {
      securityKeyHex,
      now,
      nonce,
    });
    const replayGuard = new InMemoryReplayGuard();
    await decryptTossPayoutJwe(encrypted, {
      securityKeyHex,
      now,
      replayGuard,
      decode: (value) => value,
    });
    await expect(
      decryptTossPayoutJwe(encrypted, {
        securityKeyHex,
        now,
        replayGuard,
        decode: (value) => value,
      }),
    ).rejects.toThrow(/replayed/iu);
  });

  it("builds the exact payout fields and enforces Toss limits", () => {
    expect(
      buildTossPayoutRequest({
        refPayoutId: "payout-1",
        destination: "seller-1",
        scheduleType: "SCHEDULED",
        payoutDate: "2026-08-04",
        amountKrw: 880_000n,
        transactionDescription: "튜버봇",
      }),
    ).toEqual({
      refPayoutId: "payout-1",
      destination: "seller-1",
      scheduleType: "SCHEDULED",
      payoutDate: "2026-08-04",
      amount: { currency: "KRW", value: 880_000 },
      transactionDescription: "튜버봇",
    });
    expect(() =>
      buildTossPayoutRequest({
        refPayoutId: "payout-2",
        destination: "seller-1",
        scheduleType: "EXPRESS",
        payoutDate: "2026-08-04",
        amountKrw: 100_000n,
        transactionDescription: "튜버봇",
      }),
    ).toThrow(/must not include/iu);
    expect(() =>
      buildTossPayoutRequest({
        refPayoutId: "payout-3",
        destination: "seller-1",
        scheduleType: "EXPRESS",
        amountKrw: 1_000_000_000n,
        transactionDescription: "튜버봇",
      }),
    ).toThrow(/less than/iu);
  });
});

describe("Toss payout and seller webhook HMAC", () => {
  const rawPayload = JSON.stringify({
    eventType: "payout.changed",
    eventId: "event-1",
    entityBody: { id: "payout-provider-1", status: "COMPLETED" },
  });
  const transmissionTime = "2026-08-02T00:00:00.000Z";
  const signature = createHmac(
    "sha256",
    Buffer.from(securityKeyHex, "hex"),
  )
    .update(`${rawPayload}:${transmissionTime}`, "utf8")
    .digest("base64");

  it("compares both v1 rotation candidates against the exact raw payload", () => {
    const bad = Buffer.alloc(32, 0).toString("base64");
    expect(
      verifyTossPayoutWebhookHmac({
        rawPayload,
        transmissionTime,
        signatureHeader: `v1:${bad},v1:${signature}`,
        securityKeyHex,
      }),
    ).toBe(true);
    expect(
      verifyTossPayoutWebhookHmac({
        rawPayload: `${rawPayload} `,
        transmissionTime,
        signatureHeader: `v1:${bad},v1:${signature}`,
        securityKeyHex,
      }),
    ).toBe(false);
  });

  it("checks timestamp, event type and transmission replay after HMAC", async () => {
    const replayGuard = new InMemoryReplayGuard();
    const input = {
      rawPayload,
      transmissionTime,
      transmissionId: "transmission-1",
      signatureHeader: `v1:${signature},v1:${signature}`,
      securityKeyHex,
      expectedEventType: "payout.changed" as const,
      now,
      replayGuard,
    };
    await expect(verifyTossSignedWebhookDelivery(input)).resolves.toMatchObject({
      eventId: "event-1",
      eventType: "payout.changed",
    });
    await expect(verifyTossSignedWebhookDelivery(input)).rejects.toThrow(/replayed/iu);
  });
});
