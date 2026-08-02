# Order state machine

## 원칙

상태는 중앙 transition service만 변경한다. 모든 전환은 DB transaction, row/version lock, runtime actor/permission/guard 검증, unique idempotency key, append-only status event, audit/outbox를 요구한다. UI나 provider redirect는 상태를 직접 확정하지 않는다.

## 정상 경로

```text
DRAFT -> NEGOTIATING -> AWAITING_PARTY_ACCEPTANCE -> AWAITING_PAYMENT
-> PAYMENT_PROCESSING -> FUNDED -> BRIEF_CONFIRMATION_PENDING -> IN_PRODUCTION
-> DRAFT_SUBMITTED <-> REVISION_REQUESTED -> FINAL_APPROVAL_PENDING
-> SCHEDULED_FOR_PUBLICATION -> PUBLISHED -> BUYER_CONFIRMATION_PENDING
-> PAYOUT_SCHEDULED -> PAYOUT_PROCESSING -> COMPLETED
```

`PAYOUT_BLOCKED`는 FUNDED 이후 어느 지급 준비 단계에서든 들어갈 수 있으며 모든 hold가 명시적으로 해소돼야 이전의 안전한 단계로 복귀한다.

## 주요 전환표

| 명령 | From → To | 필수 guard |
| --- | --- | --- |
| propose | DRAFT/NEGOTIATING → NEGOTIATING | order party, structured proposal version |
| acceptProposal | NEGOTIATING/AWAITING_PARTY_ACCEPTANCE → AWAITING_PARTY_ACCEPTANCE 또는 AWAITING_PAYMENT | 양측 동일 hash 수락; contract/fee/policy snapshot |
| startPayment | AWAITING_PAYMENT → PAYMENT_PROCESSING | buyer, active payment 없음, 서버 계산 amount |
| recordFunded | PAYMENT_PROCESSING → FUNDED | provider `DONE`/동등 사실, orderId·amount 일치, event unique |
| startWork | FUNDED/BRIEF_CONFIRMATION_PENDING → IN_PRODUCTION | seller verified, no cancellation/dispute |
| submitDraft | IN_PRODUCTION/REVISION_REQUESTED → DRAFT_SUBMITTED | clean immutable deliverable version |
| requestRevision | DRAFT_SUBMITTED/FINAL_APPROVAL_PENDING → REVISION_REQUESTED | buyer, remaining revisions > 0 |
| approveFinal | DRAFT_SUBMITTED/FINAL_APPROVAL_PENDING → SCHEDULED_FOR_PUBLICATION | buyer, final version hash |
| recordPublication | SCHEDULED_FOR_PUBLICATION → PUBLISHED | valid URL + disclosure proof |
| confirmPurchase | PUBLISHED/BUYER_CONFIRMATION_PENDING → PAYOUT_SCHEDULED 또는 PAYOUT_BLOCKED | buyer; all payout guards |
| dispatchPayout | PAYOUT_SCHEDULED → PAYOUT_PROCESSING | seller approval, available balance, no hold/mismatch, unique payout |
| recordPayoutPaid | PAYOUT_PROCESSING → COMPLETED | verified `payout.changed`/provider query, balanced posted ledger |

## 취소·분쟁·환불

- 취소 요청: eligible active state → `CANCELLATION_REQUESTED`; 사람/정책/provider 결과 후 `CANCELED` 또는 원상태.
- 분쟁: FUNDED 이후 terminal 전 → `DISPUTED`; 동시에 payout hold. 해결 결과에 따라 안전한 workflow, `REFUND_PENDING`, 또는 payout 경로로 이동한다.
- 환불: `REFUND_PENDING` → `PARTIALLY_REFUNDED` 또는 `REFUNDED`; provider cancel 사실과 reversal ledger가 모두 필요하다.
- chargeback: active/terminal payment 관련 주문 → `CHARGEBACK`; payout 차단 및 이미 지급된 금액의 채권 처리는 자동 음수 payout으로 만들지 않는다.
- payout 실패: `PAYOUT_PROCESSING` → `PAYOUT_FAILED`; provider 사실 재조회 후 같은 business payout ID로 안전하게 재시도한다.

## 전역 payout guard

`sellerVerification=PAYOUT_READY` AND no open dispute AND no risk hold AND no chargeback AND latest reconciliation matched AND creatorPayable>0 AND providerAvailable>=amount. 하나라도 false면 `PAYOUT_BLOCKED`; 관리자가 DB 값을 직접 수정해 우회할 수 없다.

## 순서 뒤바뀐 이벤트

provider event의 `occurredAt`과 상태 precedence를 비교한다. 이미 더 최신 terminal fact가 있으면 event를 processed/no-op로 기록한다. 중복 event ID는 같은 결과를 반환하며 ledger/status/outbox를 다시 만들지 않는다.
