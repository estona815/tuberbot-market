# Dispute operations runbook

Policy source: `docs/marketplace/DISPUTE_POLICY_DRAFT.md` (**DRAFT_NEEDS_COUNSEL**). 이 runbook은 운영 절차이며 법률 결론을 만들지 않는다.

## Intake (즉시)

1. 당사자/session/order scope와 접수 사유를 확인한다.
2. 한 transaction에서 `DISPUTED`, payout/auto-confirm hold, dispute/audit/outbox를 생성한다.
3. provider payout이 이미 processing이면 임의 취소하지 말고 provider 상태를 조회하고 Finance를 호출한다.
4. 계약 version/hash, proposal, status/provider events, conversation, deliverable hashes, publication proof를 immutable snapshot으로 연결한다.
5. 양측에 case ID, 제출 범위/마감, 금지된 민감정보, 외부 구제권을 알린다.

## Triage

- Support: completeness, ordinary schedule/brief/revision cases.
- Risk: fraud, account takeover, forged evidence, repeated refund/chargeback, payout identity mismatch.
- Moderator/Legal: unlawful ad, privacy, IP, threats, regulated content.
- Finance: refund/payout feasibility and ledger; 판정자는 아님.
- Security incident: credential, private file, bank/token exposure.

담당자는 이해상충을 기록하고 필요한 주문 범위만 접근한다.

## Evidence handling

파일은 private read-only version으로 보존하고 hash, uploader, received_at을 기록한다. malware scan 전 열지 않는다. chat/export는 case 범위로 최소화하며 raw bank/card/OAuth/provider secret을 redact한다. AI 요약은 원 증거가 아니고 사람 검토 표시를 갖는다.

## Decision/execution

판정자는 사실, contract/policy version, 각 주장 판단, remedy와 금액, 근거를 기록한다 → 요구되는 second approval → Finance가 provider refund 또는 payout 명령 → provider canonical result → ledger posting/reversal → order transition → 양측 통지. provider pending 동안 `완료`로 표시하지 않는다.

## Appeal/closure

초기 판정에 관여하지 않은 담당자가 새 증거/절차 오류를 검토한다. closure 조건은 provider terminal fact, balanced ledger, hold disposition, 통지, appeal 상태, audit completeness다. 후기 보복 위험을 별도로 모니터링하되 후기를 자동 삭제하지 않는다.

## 실패 시

SLA 초과, provider 장애, 법적 보존 요청, payout 선행, 관할기관 연락은 Operations lead/Legal에 escalation한다. 임시 해결을 위해 DB 상태나 posted ledger를 직접 변경하지 않는다.
