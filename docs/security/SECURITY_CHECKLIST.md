# Security checklist

## 2026-08-02 구현 증적

- request nonce 기반 production CSP: `script-src`의 `unsafe-inline`/`unsafe-eval` 제거, frame/object/base/form 제한
- 32-byte opaque session·CSRF token, purpose-separated HMAC digest 저장, idle/absolute expiry, rotation lineage, revoke
- HttpOnly session cookie와 readable double-submit CSRF cookie; SameSite=Lax, production/HTTPS Secure
- 로컬 데모 auth/order fixture는 explicit flags + non-production + loopback + sandbox에서만 허용
- 주문 GET/POST 모두 실제 session actor와 object scope 확인; 정확한 광고주·크리에이터 당사자만 허용하고 staff 전역 역할은 기본 거부; review는 buyer-only, IDOR-safe 404
- state change는 exact Origin, CSRF, strict JSON schema, 64 KiB body cap, idempotency, optimistic version 적용
- 메시지·수정·승인 DB mutation과 status event·audit·outbox·idempotency response를 같은 transaction에 기록
- 주문 메시지는 안정적인 `(created_at, id)` cursor로 조회하며 기본·최대 100건; mutation·idempotency 응답도 같은 상한 적용
- private upload는 opaque key, size/extension/declared+detected MIME/SHA 검증, internal QUARANTINED, CLEAN-only download
- outbox reference worker는 absolute lease, stale ack 차단, bounded exponential retry, dead letter와 sanitized error code 적용
- production 미구성 auth/storage/order dependency는 memory/sandbox로 fallback하지 않고 fail-closed

미완료 항목은 외부 identity provider, staff case/order assignment와 최소 projection, production distributed rate limit, live object storage/AV, persistent outbox worker, secret manager·monitoring 증적이며 운영 배포 blocker로 유지한다.

## Pull request gate

- [ ] 모든 입력에 runtime schema, size/range/enum 검증; unknown field 거부
- [ ] state-changing handler에 session, RBAC, org/object scope, origin/CSRF, idempotency, audit
- [ ] 금액은 server-side KRW bigint/BPS 계산; client amount 신뢰 금지
- [ ] order transition은 중앙 service만 호출하고 provider redirect로 상태 확정 금지
- [ ] raw SQL은 parameterized; dynamic identifier allowlist
- [ ] message/HTML/URL sanitize 및 XSS test
- [ ] error는 secret/PII/provider raw body/signed URL을 포함하지 않음
- [ ] 새 dependency 필요성·license·official source 확인; lockfile 포함
- [ ] unit/integration negative test와 permission matrix test 추가

## Auth/session/admin

- [ ] secure/httpOnly/SameSite cookie, rotation, revocation, idle/absolute timeout
- [ ] OAuth state/PKCE, 최소 scope, encrypted token, disconnect/revoke/delete
- [ ] login/signup/reset rate limit와 brute-force/credential-stuffing 대응
- [ ] admin/Finance/Risk/Support 2FA 또는 step-up; 민감 action re-auth
- [ ] fee, refund, payout retry, dispute decision, status override는 reason + immutable audit
- [ ] 고액 환불/지급/권한 상승은 dual approval

## Payments/webhooks/ledger

- [ ] 결제 `orderId`/`amount`를 사전 저장값과 비교하고 provider GET/승인으로 확인
- [ ] payout/seller raw payload HMAC-SHA256 constant-time + transmission time/replay 검증
- [ ] payment webhook은 signature 있다고 가정하지 않고 canonical GET 재조회
- [ ] payout POST JWE `dir`/`A256GCM`, valid `iat`, unique CSPRNG nonce; 암호화 오류 응답 처리
- [ ] provider event/idempotency/business payout unique; duplicate/out-of-order test
- [ ] posted ledger balanced/immutable; reversal only
- [ ] dispute/KYC/risk/chargeback/reconciliation mismatch payout block test
- [ ] sandbox/test/mock가 production에서 fail-closed

## Data/files/logs

- [ ] bank/token/security key/signed URL/raw webhook body 로그 금지와 masking test
- [ ] private bucket, tenant/order path, short signed URL, one-purpose operation
- [ ] upload size/quota, extension + magic MIME, AV quarantine, download content disposition
- [ ] field encryption keys 분리/rotation; backup encryption key 분리
- [ ] 개인정보 access log, quarterly access review, export/delete/revoke drill
- [ ] YouTube non-authorized data 30-day refresh/delete and revoke deletion job

## Platform/deployment

- [ ] TLS/HSTS, CSP without broad unsafe exceptions, frame/object/base/form restrictions
- [ ] security headers와 CORS/origin allowlist production domain에 한정
- [ ] DB/storage/provider least-privilege service identity; CI에 production secret 없음
- [ ] frozen install, type/lint/unit/integration/build, critical audit gate
- [ ] migration dry-run/backup/rollback; health/readiness가 dependency 상태 구분
- [ ] monitoring: auth spikes, webhook failure/lag, payout/recon mismatch, admin actions
- [ ] incident owner, provider escalation, key rotation, restore drill 최신 상태

`pnpm typecheck && pnpm lint && pnpm test && pnpm build`와 `pnpm audit --prod --audit-level=critical` 결과를 release evidence로 보관한다. audit 장애를 무시하려면 만료일 있는 risk acceptance와 compensating control이 필요하다.
