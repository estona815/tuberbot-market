# Threat model

기준일: 2026-08-02. 대상은 신규 Next.js/PostgreSQL 모듈형 모놀리스다. 이 모델은 **경로 단위 설계 근거**이며 해당 제어가 배포·운영에서 검증됐다는 뜻이 아니다.

## Assumptions

- `src/app/**`가 유일한 public HTTP entry, PostgreSQL이 system of record, `src/domain/**`이 상태/금액 규칙, `src/providers/**`가 외부 provider 경계라고 가정한다.
- auth/session, object storage, worker, rate limiter, secret manager, production hosting은 감사 시점에 확정되지 않았다. 미구현이면 아래 관련 위험은 open이다.
- `next.config.ts`의 security headers/allowed origins는 보조 제어이며 handler별 authorization/CSRF를 대신하지 않는다.
- Toss live key/네트워크는 없고 sandbox/fetch injection만 존재한다고 가정한다.
- legacy 운영 DB·API는 이 저장소 밖이며 cutover 전 별도 threat review가 필요하다.

## 자산과 경계

자산: 계정/session, org membership, channel claim, 계약/파일, payment/payout provider IDs, seller verification, ledger, dispute evidence, OAuth token, provider secret/security key, audit log.  
경계: browser↔Next, Next↔PostgreSQL, browser↔object storage, server↔Toss/YouTube/email/AI, provider↔webhook, web↔worker/admin.

## 위협 및 근거 anchor

| 위협 | 공격/영향 | 필수 제어 | Repo evidence anchor / 현재 판정 |
| --- | --- | --- | --- |
| IDOR/org escape | 타 주문·캠페인·파일 열람/변경 | session + role + org membership + object party check | `src/lib/server/authorization.ts`와 `tests/unit/server-security-policies.test.ts`에 deny-by-default 정책/부정 테스트 존재. 실제 auth/session 및 route handler 연결은 open |
| CSRF/origin | 로그인 사용자의 계약·환불 등 강제 실행 | SameSite secure cookie, origin/CSRF token, JSON/content-type, re-auth | `src/lib/server/request-security.ts` 동일 출처/Fetch Metadata 정책 및 부정 테스트 존재. 실제 mutation handler/cookie 설정 연결은 open |
| XSS | 메시지/brief로 session·관리자 탈취 | output escape, sanitizer, CSP nonce/hash, upload isolation | `next.config.ts` CSP 존재하나 `unsafe-inline` 포함; 강화 필요 |
| SQL injection/mass assignment | DB 탈취/권한·금액 변조 | parameterized Drizzle, allowlisted DTO, Zod/runtime validation | `src/lib/server/db/**`, handler schemas; tests 필요 |
| 상태/금액 tampering | client amount·redirect로 FUNDED 처리 | server recompute, central transition, provider canonical facts | `src/domain/{money,fees,order-workflow}.ts`, `src/providers/**`; tests가 근거 |
| duplicate/reordered webhook | 중복 fee/refund/payout | unique event/idempotency, precedence, transaction/outbox | DB schema/migration + payment integration tests 필요 |
| forged webhook | 가짜 지급/결제 완료 | payout/seller HMAC constant-time; payment GET requery | `src/providers/toss/{payment-adapter,payout-security}.ts`; raw-body route test 필요 |
| payout replay/secret leak | seller 자금 탈취 | JWE dir/A256GCM, iat/nonce, secret manager, no raw logs | `src/providers/toss/payout-security.ts`; nonce store/rotation/deploy proof open |
| ledger manipulation | 수익·지급 왜곡 | balanced posting, posted update/delete DB guard, reversal only | `src/domain/ledger.ts`, `src/lib/server/db/schema.ts`, `db/migrations/**` |
| hold bypass | 분쟁 중 지급 | DB + domain guard for dispute/risk/KYC/chargeback/recon | `src/domain/payout-guards.ts`, schema trigger/constraint, integration tests |
| upload abuse | malware, cross-tenant draft, signed URL leak | private bucket, path scope, size/MIME magic, AV, short URL, quota | `src/lib/server/upload-policy.ts`가 크기/MIME/확장자/key를 검증하고 부정 테스트 존재. storage adapter, magic-byte detector, AV, signed URL route는 open |
| SSRF | product URL/AI fetch to metadata/private network | scheme/DNS/IP recheck, redirect/size/type/time limits | `src/lib/server/request-security.ts`가 HTTPS/host/port/DNS 결과의 private IP를 차단하고 부정 테스트 존재. IP pinning fetch adapter·redirect/응답 제한은 open이므로 기능 off 유지 |
| OAuth theft | channel takeover/YouTube data leak | PKCE/state, minimal scope, encrypted token, revoke/delete | auth/YouTube adapter 미확인—OAuth flag off |
| admin abuse | 강제환불·상태·fee 변경 | 2FA/step-up, least privilege, reason, dual control, audit | `src/lib/server/authorization.ts`가 privileged write의 MFA와 permission matrix를 강제하고 부정 테스트 존재. 실제 admin session/route, dual control은 open |
| log/data leakage | 계좌/token/webhook/signed URL 노출 | structured allowlist logging, masking, access/retention | logger config 미확인; production blocker |
| supply chain | 악성 dependency/build | frozen lockfile, audit gate, provenance, minimal CI token | `pnpm-lock.yaml`, `.github/workflows/ci.yml`; branch protection external |
| backup theft/corruption | 전체 PII 유출·복구 실패 | encrypted immutable backup, separate key, restore drill | infra evidence 없음; runbook only |

## 우선순위

P0: authorization/IDOR, provider fact verification, payout/ledger guard, secrets/logging, admin 2FA.  
P1: upload isolation/malware, OAuth lifecycle, CSRF/CSP, reconciliation/backup.  
P2: SSRF(AI/URL 기능이 켜질 때 P0), abuse/rate limits, advanced anomaly detection.

## 검증과 수용

각 control은 code path, automated negative test, production config screenshot/log sample, owner와 review date가 있어야 closed다. 문서/feature flag만으로 위험을 closed 처리하지 않는다. P0 open이면 live payment/payout/marketplace public rollout을 차단한다.

Toss의 실제 signature 범위는 [공식 webhook events](https://docs.tosspayments.com/reference/using-api/webhook-events), 개인정보 안전조치는 [2026 안전성 확보조치 기준](https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000281400&chrClsCd=010201)을 기준으로 재검토한다.
