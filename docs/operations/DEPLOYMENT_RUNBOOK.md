# Deployment runbook

운영 배포와 DNS 변경은 사용자/운영 승인 없이는 수행하지 않는다. 기본은 preview 또는 staging, marketplace/payment/payout/safe-payment flags off다.

## Preflight

- [ ] branch/diff/owner 확인, unrelated user change 보존
- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:integration`, `pnpm build`
- [ ] `pnpm audit --prod --audit-level=critical`
- [ ] migration fresh DB/dry-run + backward compatibility + rollback read path
- [ ] current DB backup/restore evidence and object storage health
- [ ] production readiness gates; mock/test key 감지 fail-closed
- [ ] terms/privacy/refund versions, support/incident owner, monitoring/alerts

## Safe sequence

1. release artifact/commit/dependency lock/migration checksum을 기록한다.
2. 검증된 backup을 생성하되 production source를 이동/덮어쓰지 않는다.
3. additive/backward-compatible migration을 먼저 적용한다. destructive cleanup은 이 release 범위 밖이다.
4. 앱과 worker를 feature flags off로 배포하고 health/readiness를 확인한다.
5. `/`, `/search`, 대표 `/channel/[id]`, auth, API unauthorized paths를 smoke test한다.
6. 내부 sandbox 거래: contract → payment → deliverable → confirm → payout → ledger/recon.
7. pilot cohort만 marketplace를 열고 error/webhook lag/ledger/recon/payout holds를 관찰한다.
8. PG/법무/세무 승인 이후에도 live payment, payout, safe-payment badge는 각각 별도 change로 연다.

## Rollback

먼저 feature flag/traffic을 이전 app version으로 되돌린다. backward-compatible DB changes는 즉시 down migration하지 않는다. provider 요청이 시작됐다면 app rollback과 별개로 canonical provider 상태를 재조회하고 idempotent recovery/reconciliation한다. accepted contract, posted ledger, provider event를 삭제하거나 수정하지 않는다.

## Stop conditions

legacy route 404, auth/IDOR regression, migration discrepancy, provider/mock mode 불일치, unbalanced ledger, reconciliation mismatch, webhook verification failure, missing backup/monitoring, CSP/console fatal error, mobile core flow block 중 하나라도 있으면 rollout을 중단한다.

## Post-deploy

version/commit/migrations/flags, test 결과, operator, 시작/완료 UTC, smoke screenshots, incidents, rollback decision을 release record에 남긴다. 최소 한 settlement cycle까지 payment/refund/payout/recon을 관찰하고 다음 단계 승인 전 open discrepancy를 0으로 만든다.
