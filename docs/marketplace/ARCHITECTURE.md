# Architecture

## 결정

TuberBot Market은 Next.js 16 App Router와 PostgreSQL을 한 배포 단위로 운영하는 **모듈형 모놀리스**다. 거래 일관성과 작은 운영팀을 우선하며, 초기 마이크로서비스·내부 지갑·브라우저 리다이렉트 기반 결제 확정은 금지한다.

```text
Browser
  -> Next.js route/page/server action
  -> runtime validation + session/RBAC + origin/CSRF + idempotency
  -> domain application service
  -> PostgreSQL transaction (state event + ledger + audit + outbox)
  -> provider adapter (payment/payout/storage/email/YouTube/AI)
  -> worker consumes outbox; provider facts return by query/webhook
```

## 경계

| 계층 | 책임 | 금지 |
| --- | --- | --- |
| `src/app/**` | HTTP/UI, DTO, 상태 코드 | 금액·상태 규칙 직접 구현 |
| `src/domain/**` | money, fee, contract, order, payout guard, ledger, license 규칙 | provider SDK/HTTP 직접 결합 |
| `src/providers/**` | sandbox/Toss와 향후 storage/email/YouTube adapters | 도메인 상태를 임의 변경 |
| `src/lib/server/**` | DB, auth/session, outbox, observability | 클라이언트 bundle에 secret 포함 |
| `src/lib/server/db/schema.ts` | 타입·FK·제약·인덱스 | destructive 자동 변경 |
| `db/migrations/**` | 순방향·비파괴 migration | 기존 테이블 drop/rename without bridge |

향후 auth/creator/proposal/payment application service를 추가해도 위 의존 방향(`app -> domain + provider ports -> infrastructure`)을 유지한다. 실제 구현 경로가 달라지면 본 문서를 같은 변경에서 갱신한다.

## 동기 경로와 비동기 경로

- 계약 수락, 주문 전환, 결제 사실 반영, 환불, 원장 posting, payout hold는 하나의 DB transaction 안에서 수행한다.
- 외부 호출 전에 idempotency record를 만든다. 외부 결과는 provider query/webhook으로 재확인한다.
- transaction 안에서 알림을 보내지 않고 outbox를 적재한다. worker가 재시도·dead-letter·수동 replay를 담당한다.
- webhook은 원문 event ID/전송 ID와 payload hash를 저장하고 빠르게 2xx 응답한 뒤 처리한다. raw body와 signed URL, 계좌 원문은 로그에 남기지 않는다.

## 데이터 원칙

- KRW는 `bigint`, 수수료는 basis points `integer`; 부동소수점 금지.
- contract version, order status event, provider event, posted ledger entry, audit log는 append-only.
- fee rule은 양측 계약 수락 시 snapshot으로 고정한다.
- DB 시각은 UTC `timestamptz`, UI는 KST.
- payment/payout provider ID와 idempotency key는 unique.
- 분쟁, 위험 hold, 판매자 검증 hold, chargeback, 대사 불일치는 payout dispatch를 막는다.

## 배포 단위

1. Web: Next.js Node runtime.
2. Worker: 동일 코드베이스의 별도 command/process; outbox lease와 idempotent handler 사용.
3. PostgreSQL: system of record.
4. S3-compatible private object storage: 직접 multipart upload, 짧은 signed URL, malware/MIME 검증.

초기에는 DB-backed queue로 시작할 수 있으나 worker lease, retry count, next-at, dead-letter 상태가 있어야 한다. 검색은 PostgreSQL index → `pg_trgm` → FTS 순서로 확장한다.

## ADR 요약

- Next 16/PostgreSQL 유지: 현재 `package.json`, `drizzle.config.ts`, `compose.yml`과 일치한다.
- 지급은 Toss Payments 지급대행 adapter 후보이나 계약 전 sandbox-only다. 공식 가이드는 이 서비스가 오픈마켓을 대신해 셀러에게 지급하는 별도 계약 서비스임을 명시한다: [지급대행 가이드](https://docs.tosspayments.com/guides/v2/payouts).
- 공개 안전결제 명칭은 PG·법무 승인 전 `ENABLE_SAFE_PAYMENT_BADGE=false`.
- AI는 초안/요약만 수행하고 제안, 계약, 결제, 환불, 분쟁 결정, 지급을 실행하지 않는다.

## 운영 품질 속성

- RPO 목표 15분, RTO 목표 4시간은 초기 운영 목표이며 인프라 검증 후 확정한다.
- 모든 상태 변경은 trace ID, actor, reason, request ID와 연결한다.
- SLO 초안: 핵심 읽기 API 99.9%, 결제 webhook 수신 99.95%; 법적·계약적 약속은 아니다.
- production에서 sandbox/mock provider 또는 필수 readiness flag 누락 시 startup/deploy check가 실패해야 한다.
