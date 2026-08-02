import { describe, expect, it } from "vitest";

import {
  DEMO_CONTRACT_SHA256,
  DEMO_LIVE_PAYMENTS_ENABLED,
  DEMO_LIVE_PAYOUTS_ENABLED,
  applyDemoDealAction,
  createInitialDemoDealState,
  isDemoDealTerminal,
  type DemoDealAction,
  type DemoDealState,
} from "../../src/domain/deal-demo";
import {
  assertFeeSnapshotInvariant,
} from "../../src/domain/fees";
import { calculateBpsFloor } from "../../src/domain/money";

function apply(
  state: Readonly<DemoDealState>,
  action: DemoDealAction,
): Readonly<DemoDealState> {
  return applyDemoDealAction(state, action);
}

function reachAcceptance(): Readonly<DemoDealState> {
  let state = createInitialDemoDealState();
  state = apply(state, { type: "SEND_ADVERTISER_PROPOSAL" });
  return apply(state, { type: "SEND_CREATOR_COUNTEROFFER" });
}

function reachPayment(): Readonly<DemoDealState> {
  let state = reachAcceptance();
  state = apply(state, { type: "ACCEPT_ADVERTISER" });
  return apply(state, { type: "ACCEPT_CREATOR" });
}

describe("public deal demo state machine", () => {
  it("allows only the ordered proposal and counteroffer transitions", () => {
    const initial = createInitialDemoDealState();
    expect(() => apply(initial, { type: "SEND_CREATOR_COUNTEROFFER" })).toThrow(
      /cannot apply/iu,
    );

    const proposed = apply(initial, { type: "SEND_ADVERTISER_PROPOSAL" });
    expect(proposed).toMatchObject({ phase: "PROPOSAL_V1", proposalVersion: 1 });
    expect(() => apply(proposed, { type: "SEND_ADVERTISER_PROPOSAL" })).toThrow(
      /cannot apply/iu,
    );

    const countered = apply(proposed, { type: "SEND_CREATOR_COUNTEROFFER" });
    expect(countered).toMatchObject({
      phase: "AWAITING_PARTY_ACCEPTANCE",
      proposalVersion: 2,
    });
    expect(countered.events.map((event) => event.sequence)).toEqual([1, 2]);
    expect(Object.isFrozen(countered.events)).toBe(true);
    expect(Object.isFrozen(countered.events[0])).toBe(true);
  });

  it("requires separate advertiser and creator acceptance before payment", () => {
    const awaiting = reachAcceptance();
    const advertiserAccepted = apply(awaiting, { type: "ACCEPT_ADVERTISER" });

    expect(advertiserAccepted).toMatchObject({
      phase: "AWAITING_PARTY_ACCEPTANCE",
      advertiserAccepted: true,
      creatorAccepted: false,
      contractSnapshot: null,
    });
    expect(() => apply(advertiserAccepted, { type: "ACCEPT_ADVERTISER" })).toThrow(
      /cannot apply/iu,
    );

    const bothAccepted = apply(advertiserAccepted, { type: "ACCEPT_CREATOR" });
    expect(bothAccepted).toMatchObject({
      phase: "AWAITING_PAYMENT",
      advertiserAccepted: true,
      creatorAccepted: true,
    });
    expect(bothAccepted.contractSnapshot).not.toBeNull();
    expect(Object.isFrozen(bothAccepted.contractSnapshot)).toBe(true);
    expect(bothAccepted.contractSnapshot?.digest).toBe(DEMO_CONTRACT_SHA256);
    expect(DEMO_CONTRACT_SHA256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("cannot confirm payment early or without selecting a sandbox method", () => {
    expect(() =>
      apply(reachAcceptance(), { type: "CONFIRM_SANDBOX_PAYMENT" }),
    ).toThrow(/cannot apply/iu);

    const paymentReady = reachPayment();
    expect(() =>
      apply(paymentReady, { type: "CONFIRM_SANDBOX_PAYMENT" }),
    ).toThrow(/cannot apply/iu);

    const selected = apply(paymentReady, {
      type: "SELECT_SANDBOX_PAYMENT_METHOD",
      method: "TOSS_PAY",
    });
    const funded = apply(selected, { type: "CONFIRM_SANDBOX_PAYMENT" });
    expect(funded.phase).toBe("IN_PRODUCTION");
    expect(funded.events.at(-1)?.detail).toMatch(/실제 승인·청구·PG 요청 없이/u);
    expect(DEMO_LIVE_PAYMENTS_ENABLED).toBe(false);
  });

  it("keeps the contract fee snapshot consistent in bigint KRW and BPS", () => {
    const snapshot = reachPayment().contractSnapshot;
    expect(snapshot).not.toBeNull();
    if (snapshot === null) throw new Error("expected contract snapshot");

    expect(() => assertFeeSnapshotInvariant(snapshot.feeSnapshot)).not.toThrow();
    expect(snapshot.feeSnapshot.contractAmountKrw).toBe(1_650_000n);
    expect(snapshot.feeSnapshot.sellerFeeBps).toBe(1_200);
    expect(snapshot.feeSnapshot.sellerFeeKrw).toBe(
      calculateBpsFloor(1_650_000n, 1_200),
    );
    expect(snapshot.feeSnapshot.creatorReceivableKrw).toBe(1_452_000n);
    expect(snapshot.feeSnapshot.buyerChargeKrw).toBe(1_650_000n);
  });

  it("runs the review flow and terminates at PAYOUT_BLOCKED", () => {
    const actions: readonly DemoDealAction[] = [
      { type: "SELECT_SANDBOX_PAYMENT_METHOD", method: "NAVER_PAY" },
      { type: "CONFIRM_SANDBOX_PAYMENT" },
      { type: "SUBMIT_DRAFT" },
      { type: "REQUEST_REVISION" },
      { type: "RESUBMIT_DRAFT" },
      { type: "APPROVE_FINAL" },
      { type: "RECORD_PUBLICATION" },
      { type: "CONFIRM_BUYER" },
    ];
    const terminal = actions.reduce(apply, reachPayment());

    expect(terminal.phase).toBe("PAYOUT_BLOCKED");
    expect(isDemoDealTerminal(terminal)).toBe(true);
    expect(DEMO_LIVE_PAYOUTS_ENABLED).toBe(false);
    expect(terminal.events.at(-1)).toMatchObject({
      kind: "BUYER_CONFIRMED_PAYOUT_BLOCKED",
      phase: "PAYOUT_BLOCKED",
    });
    expect(() => apply(terminal, { type: "CONFIRM_BUYER" })).toThrow(
      /cannot apply/iu,
    );
  });
});
