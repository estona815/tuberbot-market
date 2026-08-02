# API contract

상태: 구현된 Phase 1/2 경계와 후속 target contract를 함께 기록한다. 현재 Route Handler의 Base URL은 same-origin `/api`; 후속 public API versioning 목표는 `/api/v1`이다. JSON은 UTF-8, 시각은 UTC ISO-8601, KRW 금액은 JSON **decimal string**으로 전달해 JavaScript 정밀도 손실을 피한다.

## 현재 구현 endpoint

| Method/path | Actor | 현재 동작 |
| --- | --- | --- |
| `GET /api/auth/session` | cookie 또는 anonymous | no-store session projection; malformed/expired cookie 제거 |
| `POST /api/auth/demo-session` | loopback local sandbox only | 광고주/유튜버 로컬 데모 opaque session 발급; production·public host 404 |
| `PATCH /api/auth/session` | signed-in + Origin/CSRF | token·CSRF 동시 회전, 이전 session revoke |
| `DELETE /api/auth/session` | signed-in + Origin/CSRF | session revoke 및 cookie 제거 |
| `GET /api/orders/:id/workspace` | recorded advertiser/creator only | 참여 범위를 확인한 주문·최근 메시지·현재 제출물 projection; staff assignment 모델 전에는 운영 역할도 기본 거부 |
| `POST /api/orders/:id/messages` | order party | expected version, client message ID, idempotency, audit/outbox |
| `POST /api/orders/:id/transitions` | buyer | 구조화된 수정 요청 또는 제출물 승인; optimistic lock와 revision limit |
| `POST /api/uploads/initiate` | injected signed-in actor | opaque private key와 짧은 PUT grant 예약 |
| `POST /api/uploads/complete` | injected signed-in actor | 서버 측 크기·magic MIME·SHA-256 seal 후 scan pending/quarantine |
| `GET /api/uploads/:attachmentId/download` | attachment-scoped actor | CLEAN 파일에만 attachment disposition의 짧은 GET grant |
| `GET /api/health` | public | 결제/지급/공개 배지의 fail-closed readiness |

인증은 raw token이 아니라 HMAC-SHA-256 digest만 저장한다. 로컬 주문 fixture는 `ENABLE_LOCAL_DEMO_AUTH=true`, `TUBERBOT_ORDER_DEMO_MODE=true`, loopback origin, non-production, sandbox payment를 모두 만족할 때만 메모리에 설치된다. production은 DB/session resolver나 live storage가 없을 때 메모리로 fallback하지 않는다.

현재 공통 응답은 다음 최소 envelope를 사용한다. 공개 오류에는 내부 예외 메시지·stack·식별 가능 리소스 정보가 포함되지 않는다.

```json
{
  "error": { "code": "ORDER_VERSION_CONFLICT" },
  "requestId": "request_12345678"
}
```

주문 성공 응답은 멱등 replay 여부를 함께 반환한다.

```json
{
  "workspace": {
    "order": { "id": "…", "orderNumber": "TBM-…", "status": "DRAFT_SUBMITTED", "version": 1 },
    "messages": [],
    "messagePage": { "limit": 100, "returned": 0, "hasMore": false, "nextCursor": null },
    "deliverables": []
  },
  "replayed": false
}
```

업로드 Route Handler는 composition root가 인증·order scope·private storage 의존성을 설치하기 전에는 의도적으로 `503 STORAGE_UNAVAILABLE`이다. sandbox custom signed URL은 단위 테스트용이며 production object storage URL로 가장하지 않는다.

## 공통 보안 계약

- 인증: secure httpOnly session cookie. API key/OAuth bearer가 필요한 provider callback은 별도 adapter route만 사용.
- 모든 state change: runtime schema, session, RBAC + org/object scope, allowed Origin/CSRF, `Idempotency-Key`, audit; `Content-Type: application/json`.
- `Idempotency-Key`는 같은 actor+operation+resource+body hash에만 재사용 가능. 다른 payload 재사용은 `409 IDEMPOTENCY_CONFLICT`.
- `GET`도 민감 resource의 ownership을 확인한다. ID가 존재하는지 노출하지 않도록 403/404 정책을 통일한다.
- 주문 메시지 cursor pagination: `?before=&limit=`, 기본·최대 100. `messagePage.nextCursor`를 다음 `before`에 전달한다. user-provided sort/filter는 allowlist.
- 로그에는 request/correlation ID만; token, bank, signed URL, raw webhook body 금지.

후속 `/api/v1` 목표 응답:

```json
{
  "data": {},
  "meta": { "requestId": "req_...", "nextCursor": null }
}
```

후속 `/api/v1` 목표 오류:

```json
{
  "error": {
    "code": "ORDER_TRANSITION_NOT_ALLOWED",
    "message": "현재 상태에서 요청을 처리할 수 없습니다.",
    "requestId": "req_...",
    "fields": []
  }
}
```

## Public/identity/marketplace

| Method/path | Actor | 설명 |
| --- | --- | --- |
| `GET /creators`, `GET /creators/:id` | public | 공개·허가된 discovery 데이터; source/updatedAt 포함 |
| `POST /channel-claims` | signed-in | legacy/channel ownership claim |
| `GET/POST /packages`, `PATCH /packages/:id` | public/verified creator | rate card; 판매 상태는 verification guard |
| `GET/POST /campaigns`, `PATCH /campaigns/:id` | public/advertiser org | campaign; 공개 전 moderation/risk |
| `POST /campaigns/:id/applications` | verified creator | child order 전 지원 |
| `POST /favorites` / `DELETE /favorites/:id` | signed-in | type+target idempotent 저장 |

## Proposal/contract/order

| Method/path | Actor | 핵심 guard |
| --- | --- | --- |
| `POST /proposals` | order/campaign party | structured terms 전체, KRW string |
| `POST /proposals/:id/counteroffers` | 상대 party | 새 immutable version |
| `POST /proposals/:id/acceptances` | 각 party | exact version/hash; human action |
| `GET /orders/:id` | recorded order party | UI projection + allowed actions. Support/Finance/Risk/Admin은 별도 case/order assignment가 구현되기 전 접근 불가 |
| `POST /orders/:id/transitions` | allowed actor | `{command, expectedVersion, reason, payload}`; 중앙 state service |
| `GET /orders/:id/contracts/:version` | party/scoped staff | canonical/hash/acceptance; signed URL은 별도 |
| `POST /orders/:id/messages` | party | size/sanitize/rate limit |
| `POST /orders/:id/deliverables/uploads` | party | short private upload intent |
| `POST /orders/:id/deliverables` | creator | clean upload hash/version만 제출 |

직접 `status` 값을 PATCH하는 endpoint는 제공하지 않는다.

## Payment/refund/payout

| Method/path | Actor | 처리 |
| --- | --- | --- |
| `POST /orders/:id/payment-intents` | buyer | 서버가 contract/fee/amount 재계산 |
| `POST /payments/:id/confirm` | buyer | redirect 값과 저장값 검증 후 provider confirm/get |
| `GET /payments/:id` | party/Finance | normalized status; secret 없음 |
| `POST /orders/:id/refund-requests` | party | 사유/금액/증거; payout hold |
| `POST /refunds/:id/approve` | Finance | policy/dual approval; provider cancel + ledger |
| `GET /payouts` | creator/Finance | 본인/권한 scope, masked metadata |
| `POST /payouts/:id/dispatch` | Finance/system | 모든 payout guard, available balance, unique business ID |

payment redirect/confirm 응답만으로 order를 `FUNDED`로 만들지 않고 provider fact를 transaction 안에서 반영한다. payout request success는 `PAID`가 아니다.

## Dispute/review/license/admin

| Method/path | Actor | 설명 |
| --- | --- | --- |
| `POST /orders/:id/disputes` | party | 즉시 payout/auto-confirm hold |
| `POST /disputes/:id/evidence` | party/scoped staff | immutable evidence metadata/hash |
| `POST /disputes/:id/decisions` | assigned Support/Risk | human reason + approval; AI 결정 금지 |
| `POST /orders/:id/reviews` | completed party | role당 1개, blind publish |
| `POST /reviews/:id/reports`, `POST /reviews/:id/appeals` | signed-in/author | moderation audit |
| `GET /licenses`, `POST /licenses/:id/renewals` | contract party | 새 proposal/order 생성 |
| `POST /admin/feature-flags/:key/changes` | Admin | reason, high-risk dual approval |
| `POST /admin/reconciliation-runs` | Finance | immutable run; mismatch hold |

## Provider webhooks

- `POST /api/webhooks/toss/payments`: 일반 결제 event를 allowlist parse 후 `paymentKey` canonical GET으로 확인. 같은 HMAC 서명이 있다고 가정하지 않는다.
- `POST /api/webhooks/toss/payouts`, `/sellers`: raw payload와 transmission time으로 HMAC-SHA256 signature를 constant-time 검증; timestamp/ID replay 차단.
- 빠르게 2xx 후 unique event + payload hash를 저장하고 outbox/worker가 처리한다. 중복은 2xx/no-op, 일시 장애는 5xx로 provider retry 허용. 인증 실패는 4xx와 보안 alert.

Toss 서명 범위와 payload는 [공식 webhook events](https://docs.tosspayments.com/reference/using-api/webhook-events)를 source of truth로 삼는다.

## 상태 코드

`200/201/202/204`, `400 VALIDATION`, `401 AUTH_REQUIRED`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 VERSION_OR_IDEMPOTENCY_CONFLICT`, `422 BUSINESS_RULE`, `429 RATE_LIMITED`, `502 PROVIDER_ERROR`, `503 TEMPORARILY_UNAVAILABLE`. Provider pending은 성공으로 가장하지 않고 `202` + polling resource를 반환한다.
