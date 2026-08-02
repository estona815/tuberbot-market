# Incident runbook

## Severity

- **P0**: unauthorized/misdirected payout, payment/ledger integrity loss, active secret/OAuth/bank data exposure, cross-tenant access, production data loss.
- **P1**: payment/refund/payout unavailable, webhook/reconciliation backlog, private file access failure, widespread auth outage without confirmed leak.
- **P2**: degraded non-money feature, isolated workflow bug with safe workaround.

## First 15 minutes

1. Incident commander, scribe, technical/Finance/Risk leads와 private incident channel을 지정한다.
2. incident ID, UTC start/detection, reporter, affected capability를 기록한다.
3. 증거를 보존하고 destructive cleanup/redeploy를 하지 않는다.
4. 범위를 모르면 live payment/payout/marketplace 관련 feature flag를 fail-closed; payout hold를 우선한다.
5. status page/customer message는 확인된 사실만 사용하며 `안전`, `자금 손실 없음`을 추정하지 않는다.

## Containment by type

- secret: 해당 credential만 rotate/revoke, 이전/신규 key overlap과 사용 logs 보존; 저장소/채팅에 값 복사 금지.
- webhook/provider: endpoint를 무조건 끄지 말고 수신 raw 검증과 queue backlog를 격리; provider canonical query로 금전 사실 확인.
- payout/ledger: provider-wide payout block, reconciliation snapshot, duplicate idempotency 금지.
- IDOR/file: affected route/signed URL 발급 off, session revoke 범위 결정, object access logs 보존.
- data loss: writes 격리 후 backup team 호출; production 위 restore 금지.

## Investigation

timeline, deploy/config/auth/admin changes, request/trace IDs, provider event IDs와 hashes를 수집한다. PII/secret은 incident 문서에서 tokenize/redact한다. 로그가 사실의 유일한 근거가 아니며 DB/provider/object storage를 교차 확인한다.

## Notification/escalation

법적 신고/정보주체 통지 시점과 내용은 개인정보/Legal 담당자가 현행 법률로 즉시 판단한다. Toss/Google/hosting/insurer/law enforcement 연락은 계약된 owner가 수행한다. 외부 공지는 영향, 현재 조치, 사용자 행동, 다음 업데이트 시각을 포함한다.

## Recovery and closure

fix review + targeted tests → sandbox/canary → reconciliation/permission checks → Finance/Risk/IC 승인 → 단계적 flag 복구. closure에는 root cause, impact, detection gap, evidence, money reconciliation, notification decision, follow-up owner/due date가 필요하다. 5영업일 내 blameless review, P0 action은 다음 live release 전에 완료한다.

비상 연락처는 공개 저장소에 개인 전화/credential을 넣지 않고 승인된 on-call system 링크로 관리한다.
