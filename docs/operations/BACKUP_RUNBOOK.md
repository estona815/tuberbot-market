# Backup and restore runbook

초기 목표: PostgreSQL RPO ≤15분/RTO ≤4시간, object storage·계약 artifact RPO ≤24시간. 이는 검증 전 목표이며 SLA가 아니다.

## 범위

PostgreSQL schema/data, private object versions, migration files, app/config source, provider/audit/reconciliation references. secret 값은 database backup과 별도 secret manager lifecycle로 관리한다.

## Backup controls

- encrypted automated PostgreSQL base backup + PITR/WAL, 다른 failure domain에 immutable copy.
- object versioning/retention과 orphan manifest; 계약 canonical JSON/PDF/hash의 일치 검사.
- backup service identity는 production app과 분리하고 delete 권한을 최소화.
- job마다 start/end, snapshot/LSN, object count/bytes, encryption key version, checksum, destination, retention, result를 기록.
- 최소 두 개의 독립 검증 copy가 있기 전 원본 제거 금지. backup existence가 아니라 restore 성공이 증거다.

정확한 retention은 법무·개인정보·회계 승인 후 data class별로 정한다. expiry/delete는 별도 승인과 audit가 필요하며 이 runbook은 삭제 권한을 부여하지 않는다.

## Restore drill (월 1회, isolated)

1. production과 다른 계정/network의 빈 temporary environment를 승인받는다.
2. 선택한 backup hash/key/LSN을 기록하고 가장 최근 copy와 이전 copy를 교차 검증한다.
3. isolated PostgreSQL에 restore; production target/hostname이면 즉시 중단한다.
4. migration/schema check, row counts, FK, accepted contract hashes, ledger balances, provider ID uniqueness를 검증한다.
5. 무작위 private objects와 contract PDF/JSON hash를 복원 검증한다.
6. 앱 smoke read만 실행하고 외부 email/payment/payout/webhook은 sandbox/disabled로 강제한다.
7. 실제 RPO/RTO와 오류를 기록하고 owner가 sign-off한다.

## Disaster restore

IC가 write freeze/cutover point를 승인 → Finance가 provider 사실 snapshot → backup owner가 새 infrastructure에 복원 → Engineering이 migrations/read checks → Finance가 ledger/reconciliation → Security가 access/secrets rotation → canary read/write → DNS/traffic 승인은 별도. 데이터 손실 구간은 추정하지 말고 마지막 검증 LSN/time으로 보고한다.

temporary restore data의 제거는 정확한 target과 사전 승인을 받아 별도 cleanup 절차로 수행한다.
