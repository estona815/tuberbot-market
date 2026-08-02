# Data migration

## 목적과 원칙

legacy creator discovery 데이터와 `/`, `/search`, `/channel/[id]`를 보존하되, 소유권·판매 가능성·YouTube 정책 적합성을 새로 검증한다. 원본 DB에는 쓰지 않고 export → staging → 검증 → idempotent import 순서로 진행한다.

## 사전 증빙

운영 담당자는 export 전에 다음을 기록한다: 원본 시스템/테이블, row count, schema hash, export SHA-256, UTC 생성시각, 데이터 controller, YouTube API project, 취득 근거·scope, 마지막 갱신일, 삭제/갱신 정책. 비밀키·OAuth token·원문 계좌는 export에 포함하지 않는다.

## 매핑

| Legacy | 신규 | 규칙 |
| --- | --- | --- |
| 내부 creator document ID | `legacy_creator_aliases` | 기존 `/channel/[id]` entry가 정확한 public profile로 영구 redirect할 때 사용 |
| YouTube channel ID | `youtube_channels.external_channel_id` | unique; 형식 검증 및 duplicate quarantine |
| title/description/thumb/stats | `youtube_channels` + `data_provenance` | source, fetched_at, expires_at, authorization 기록 |
| 연락 가능 표시 | creator profile metadata | 판매자 인증으로 간주하지 않음 |
| 즐겨찾기 | 별도 user mapping | 사용자 identity가 확실할 때만 이관 |
| 예상 광고 단가/CPV | 제한된 migration archive | 공개 컬럼으로 복사하지 않음; 신규 계산 입력으로 사용 금지 |

기존 프로필 상태는 기본 `DISCOVERY_ONLY` 또는 `UNCLAIMED`. 소유권 요청 이후 `CLAIM_PENDING` → `CHANNEL_VERIFIED`; seller verification, 지급 수단, 약관, 상품, risk gate를 모두 통과해야 `PAYOUT_READY`/판매 가능 상태가 된다.

## 실행 절차

1. 운영 쓰기를 중단하지 않은 시점 snapshot과 최종 delta 기준을 정한다.
2. export를 암호화 저장하고 SHA-256/row count를 manifest에 기록한다.
3. staging에서 channel ID 형식, null, 중복, 미래 시각, 깨진 URL, orphan user를 검사한다.
4. provenance가 없는 레코드는 `quarantine_reason`과 함께 import 제외 또는 discovery-only로 둔다.
5. `legacy_creator_imports` batch를 만든 뒤 upsert가 아닌 immutable batch/alias 방식으로 import한다.
6. shadow read로 검색 결과 수·상위 질의와 legacy URL의 의도한 permanent redirect/최종 200 응답을 비교한다.
7. marketplace flag off 상태로 배포하고 내부 승인 후 read cutover한다.
8. rollback은 신규 read flag를 legacy로 되돌린다. 신규 계약/주문 데이터는 삭제하지 않는다.

## 검증 기준

- export row 수 = accepted + quarantined + rejected.
- unique channel ID 충돌은 0 또는 모두 사유 기록.
- 무작위 100건과 상위 유입 URL 100건을 비교.
- `/`, `/search`, `/channel/[id]` 404 = 0; legacy ID의 잘못된 profile 매핑 = 0.
- 공개 예상 단가/CPV = 0; feature flags off.
- non-authorized YouTube API 통계는 30일 내 refresh/delete schedule 보유. [YouTube API Developer Policies](https://developers.google.com/youtube/terms/developer-policies)

## 삭제 및 보존

정책/법률상 삭제 대상과 계약·회계 보존 의무가 충돌하면 field-level tombstone 또는 분리 보관을 법무·개인정보 담당자가 승인한다. migration archive 접근은 Compliance 최소 인원으로 제한하고, 접근·export·삭제를 audit log에 남긴다.
