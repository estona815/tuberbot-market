# Ledger design

## 목적

결제 상태 테이블이 아니라 append-only double-entry ledger가 플랫폼 수수료, creator payable, 환불, payout, provider fee의 재무 근거다. 금액은 KRW `bigint`, entry는 양수, 방향은 debit/credit으로 분리한다.

## 계정

| 계정 | 정상 잔액 | 의미 |
| --- | --- | --- |
| `PG_CLEARING` | Debit | PG에서 회수/지급 가능한 자금 |
| `CUSTOMER_PAYMENT_LIABILITY` | Credit | 이행/확정 전 고객 결제 의무 |
| `CREATOR_PAYABLE` | Credit | creator에게 지급할 확정 금액 |
| `PLATFORM_FEE_REVENUE` | Credit | 완료 조건을 충족한 플랫폼 수수료 |
| `PAYMENT_PROVIDER_FEE_EXPENSE` | Debit | provider가 확인한 결제/지급 비용 |
| `REFUND_LIABILITY` | Credit | 승인됐지만 provider 완료 전 환불 의무(필요 시) |
| `CHARGEBACK_LIABILITY` | Credit | 확정되지 않은 chargeback 의무 |
| `TAX_PAYABLE` | Credit | 세무 승인된 세금 분리액 |
| `PROMOTION_EXPENSE` | Debit | 승인된 fee discount 비용 |

## Posting templates

| 사실 | Debit | Credit | 시점 |
| --- | --- | --- | --- |
| payment funded | PG_CLEARING gross | CUSTOMER_PAYMENT_LIABILITY gross | provider 승인/조회 확인 |
| buyer confirmation | CUSTOMER_PAYMENT_LIABILITY gross | CREATOR_PAYABLE net + PLATFORM_FEE_REVENUE fee (+ TAX_PAYABLE) | 계약상 수익 인식 조건 충족 |
| payout paid | CREATOR_PAYABLE net | PG_CLEARING net | provider `PAID` 확인 |
| refund before recognition | CUSTOMER_PAYMENT_LIABILITY amount | PG_CLEARING amount | provider cancel 확인 |
| refund after recognition | CREATOR_PAYABLE seller share + PLATFORM_FEE_REVENUE fee share | PG_CLEARING amount | versioned allocation 정책 + provider 취소 |
| provider fee | PAYMENT_PROVIDER_FEE_EXPENSE amount | PG_CLEARING amount | settlement statement 확인 |

부분 환불의 seller/fee 배분과 이미 지급된 주문 처리는 세무·법무 승인된 policy version이 없으면 자동 post하지 않는다. 이미 지급된 creator payable을 음수로 만들지 않고 Finance case/별도 승인된 receivable 모델로 이관한다.

## 데이터 구조와 불변조건

- `ledger_transactions`: business event, order, provider reference, idempotency key, status `PENDING|POSTED|REVERSED`, occurred/posted time, policy/fee snapshot.
- `ledger_entries`: transaction, account, debit/credit, amount, currency, order/seller dimension.
- 같은 transaction의 debit 합 = credit 합, currency=KRW, 2개 이상 entry.
- POSTED transaction/entry update/delete 금지. 수정은 원 transaction을 가리키는 reversal + replacement.
- provider event ID, business posting key, payout business ID unique.
- contract/order 금액과 posted totals가 일치하지 않으면 transaction rollback 및 payout hold.

DB trigger는 최후 방어선이며 application service도 같은 검증을 수행한다. 구현 anchor는 `src/domain/ledger.ts`, fee/money는 `src/domain/fees.ts`, `src/domain/money.ts`, schema는 `src/lib/server/db/schema.ts`다.

## Fee snapshot

양측 proposal 수락 시 `rule_id`, version, seller/buyer/license BPS, promotion 조건, rounding, tax treatment, effective_at, calculated components를 snapshot한다. 이후 admin fee 변경은 기존 order에 영향을 주지 않는다. 예시 12%는 실험 기본값일 뿐 약관/코드 상수로 쓰지 않는다.

## 대사 방정식

일별·provider별로 다음을 독립 비교한다.

```text
provider funded - provider canceled/chargeback
  == internal funded cash movement

CUSTOMER_PAYMENT_LIABILITY + CREATOR_PAYABLE + TAX_PAYABLE
  == 관련 미이행/미지급 obligation

opening PG_CLEARING + funded - refunds - payouts - provider fees
  == closing provider-reconcilable balance
```

차이는 `reconciliation_runs/items`에 기록하고 관련 seller/order payout을 자동 block한다. tolerance는 KRW 0원이 기본이며 세무상 timing difference는 별도 reason code와 승인 없이 무시하지 않는다.

## 검증

unit: fee/promotions/rounding, 모든 template balance, full/partial reversal, duplicate posting.  
integration: POSTED mutation rejection, unique event/idempotency, payout guard, reconciliation mismatch.  
property test: 임의 유효 amount/BPS에도 debit=credit, refund≤funded, payout≤payable.
