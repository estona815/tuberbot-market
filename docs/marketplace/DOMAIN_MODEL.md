# Domain model

## Aggregate와 불변조건

| Aggregate | 주요 엔터티 | 불변조건 |
| --- | --- | --- |
| Identity | user, role, organization, member, profile | 다중 역할 허용; org scope 필수 |
| Creator | creator profile, channel, claim, verification | channel 1개당 active claim 1개; 검증 전 판매/지급 금지 |
| Marketplace | package, option, availability, campaign, application | 공개 package는 검증 seller와 유효 rate card 필요 |
| Negotiation | proposal, proposal version | 가격·권리는 structured version만 변경; 양측 동일 version 수락 |
| Contract | contract, contract version, acceptance | canonical JSON/HTML/PDF hash; accepted version append-only |
| Order | order, status event, deliverable, conversation | buyer 1명 + seller 1명; 중앙 transition service만 상태 변경 |
| Money | payment, refund, payout, fee snapshot, ledger | provider fact 기반; posted ledger balanced/immutable; payout 1회 |
| Resolution | dispute, evidence, decision, hold | open dispute는 payout과 auto-confirm을 차단 |
| Trust | review, report, appeal | completed party만 1회 작성; 공개/삭제 이력 보존 |
| Rights | license, renewal | 기본은 계약된 organic publish; 추가 권리는 명시적 가격/기간 필요 |
| Platform | notification, outbox, webhook, risk, moderation, terms, audit | event/idempotency unique; admin 작업 사유 필수 |

## 금액 값 객체

- `MoneyKRW.amount`: signed 64-bit integer이나 주문·환불·지급 입력은 `>= 0` check.
- `FeeRate.bps`: 0–10,000 범위; `fee = floor(amount * bps / 10_000)`의 반올림 정책을 fee rule version에 저장.
- 계약 수락 시 seller fee, buyer fee, promotion eligibility와 rule ID를 snapshot한다.
- 환불은 원 거래를 수정하지 않고 reversal transaction으로 기록한다.

## 상태와 사실

`OrderStatus`는 사용자 workflow, `PaymentStatus`/`PayoutStatus`는 provider 사실의 정규화 결과다. 하나를 다른 하나로 덮어쓰지 않는다. 예: payment `FUNDED`가 확인돼도 risk hold가 있으면 order는 `PAYOUT_BLOCKED`가 될 수 있다.

계약/상태/provider/ledger event에는 최소 `id`, aggregate ID, version, event type, actor type/id, reason code, occurred_at, recorded_at, idempotency key, correlation ID가 필요하다.

## 핵심 관계

```text
Campaign 1---* Order *---1 CreatorPackage
Order 1---* ProposalVersion -> ContractVersion
Order 1---* DeliverableVersion
Order 1---* Payment 1---* Refund
Order 1---0..1 Payout
Order 1---* LedgerTransaction 1---2..* LedgerEntry
Order 1---0..* Dispute -> PayoutHold
ContractVersion 1---* License -> LicenseRenewal
```

## Persistence anchor

Drizzle schema는 `src/lib/server/db/schema.ts`, baseline은 `db/migrations/0000_tuberbot_market_foundation.sql`, 권한·불변성 guard는 `0001_authority_and_immutability_guards.sql`, FK 보조 index는 `0002_foreign_key_supporting_indexes.sql`을 기준으로 한다. 실제 이름이 바뀌면 이 문서와 schema를 같은 diff에서 갱신한다. DB 제약은 애플리케이션 검증을 대체하지 않고 최후 방어선이다.
