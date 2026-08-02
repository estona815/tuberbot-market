# Source register

기준일: 2026-08-02 KST. 이 목록은 조사 근거이지 법률 의견이나 계약을 대신하지 않는다. owner는 분기마다 URL/시행일/계약 변경을 확인하고 snapshot hash 또는 내부 티켓을 연결한다.

| ID | 공식 출처 | 사용한 판단 | 재검토 |
| --- | --- | --- | --- |
| OPS-01 | [TuberBot 운영 홈](https://tuberbot.co.kr/) / [검색](https://tuberbot.co.kr/search) | legacy route, 공개 rate/CPV, 검색·채널 공개 필드 감사 | migration cutover 전 |
| TP-01 | [Toss 지급대행](https://docs.tosspayments.com/guides/v2/payouts) | 별도 지급대행, seller/KYC, JWE, balance, payout lifecycle/멱등성 | 계약 및 월 1회 |
| TP-02 | [Toss 웹훅 이벤트](https://docs.tosspayments.com/reference/using-api/webhook-events) | payout/seller signature 범위, transmission headers, payment event | adapter 변경 시 |
| TP-03 | [Toss 웹훅 연결](https://docs.tosspayments.com/guides/v2/webhook) | event 등록/전달 운영 | live 신청 전 |
| TP-04 | [Toss 결제 흐름](https://docs.tosspayments.com/guides/v2/get-started/payment-flow) | redirect 검증, 서버 승인, paymentKey 저장 | payment 변경 시 |
| TP-05 | [Toss 결제 취소](https://docs.tosspayments.com/guides/v2/cancel-payment) | 전액/부분 취소, 수단별 차이 | 환불정책 변경 시 |
| TP-06 | [Toss 환경 설정](https://docs.tosspayments.com/guides/v2/get-started/environment) | test/live 제약, TLS, payout 테스트 비용 | deploy gate 변경 시 |
| TP-07 | [Toss API 키](https://docs.tosspayments.com/reference/using-api/api-keys) | client/secret/security key 분리 및 rotation | 키 교체 시 |
| YT-01 | [YouTube API Developer Policies](https://developers.google.com/youtube/terms/developer-policies) | 30일 refresh/delete, revocation, 표시·저장 제한 | 분기/정책 알림 시 |
| YT-02 | [YouTube 정책 준수 가이드](https://developers.google.com/youtube/terms/developer-policies-guide) | 파생 지표 제한, source 구분, 삭제 요청 | metric 추가 전 |
| YT-03 | [YouTube API Terms](https://developers.google.com/youtube/terms/api-services-terms-of-service) | API 사용 계약 | OAuth/API 변경 시 |
| YT-04 | [YouTube authentication](https://developers.google.com/youtube/documentation/authentication) | user-delegated OAuth 사용 범위 | scope 변경 시 |
| YT-05 | [YouTube paid promotion](https://support.google.com/youtube/answer/154235) | 유료 프로모션 설정 및 금지 카테고리 | 콘텐츠 정책 변경 시 |
| YT-06 | [YouTube API audit form](https://support.google.com/youtube/contact/yt_api_form) | quota extension/compliance audit 증빙 | quota 신청 전 |
| LAW-01 | [전자상거래법, 2026-07-21 시행](https://www.law.go.kr/LSW/lsInfoP.do?ancNo=21312&ancYd=20260120&efYd=20260721&lsiSeq=282793) | 중개자, C2C seller 정보, 후기/분쟁 등 검토 기반 | counsel 즉시/분기 |
| LAW-02 | [전자상거래법 시행령, 2026-07-21 시행](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=288143) | seller 정보 제공·기록 등 하위 규정 | 시행령 개정 시 |
| LAW-03 | [개인정보 보호법 제30조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1020398435) | 처리방침 필수 항목 | privacy release 전 |
| LAW-04 | [개인정보 처리방침 작성지침 2025.4](https://www.privacy.go.kr/front/bbs/bbsView.do?bbsNo=BBSMSTR_000000000049&bbscttNo=20806) | 처리방침 작성·공개 기준 | 연 1회 |
| LAW-05 | [개인정보 안전성 확보조치 기준, 2026-07-01](https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000281400&chrClsCd=010201) | 접근통제·접속기록 등 보호조치 | 보안 감사 시 |
| LAW-06 | [추천·보증 심사지침, 2026-06-01](https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000280130) | 경제적 이해관계 표시 | 캠페인 정책 변경 시 |
| LAW-07 | [전자금융거래법 2026-12-17 시행 개정](https://law.go.kr/lsRvsDocInfoR.do?lsiSeq=280277) | PG 정산자금 외부관리 등 미래 시행 영향 추적 | 시행 전 counsel/PG 확인 |

## 내부 근거

아키텍처/보안 근거는 `package.json`, `next.config.ts`, `drizzle.config.ts`, `compose.yml`, `src/domain/**`, `src/providers/**`, `src/lib/server/db/**`, `db/migrations/**`, `tests/**`를 사용한다. 경로가 존재한다고 운영 제어가 검증된 것은 아니며 테스트/배포 증빙을 별도로 연결한다.

## 미등록 자료 처리

PG 계약서, Toss 지원 답변, 법률 의견서, YouTube compliance 승인, 세무 의견은 공개 저장소에 원문을 넣지 않는다. 문서 ID, 승인 범위, 발행자, 날짜, 만료일, SHA-256, 접근 가능한 내부 보관 위치만 등록한다. API 키·개인정보는 금지한다.
