# Acquisition-to-revenue implementation status

기준 시각: 2026-08-02 KST

이 문서는 Acquisition-to-Revenue Pipeline V2 부속 명세 대비 실제 구현 상태를 기록합니다. 계획, 샘플 화면, seed 데이터 또는 샌드박스 실행을 운영 트래픽·실거래·매출로 간주하지 않습니다.

| 단계 | 상태 | 현재 증거 | 다음 완료 조건 |
| --- | --- | --- | --- |
| G0 관측 기반 | PARTIAL | route inventory와 `analytics_events` 스키마 | 동의·보관 기한이 적용된 이벤트 수집 API, 익명 식별자, first/last-touch attribution, 검증 쿼리 |
| G1 공개 유입 | PARTIAL | `/`, `/search`, `/market`, 카테고리·샘플 상세 UI | 실제 출처가 있는 공개 데이터, URL 기반 검색·필터, 0건 대안, 안전한 sitemap/canonical |
| G2 가입·활성화 | MISSING | 공개 Sites 프리뷰에서는 인증 경로 차단 | 운영 identity provider, `returnTo`·pending action, 동의 기록, 실제 lead/claim 접수 |
| G3 거래 전환 | PARTIAL / BLOCKED_EXTERNAL | 주문 협업 경계, 계약 snapshot, 샌드박스 provider, 원장·지급 차단 규칙 | PG 계약 및 provider 검증, 판매자 확인, private storage/AV, 운영 worker, 법무·세무 승인 |
| G4 재구매·추천 | MISSING | 운영 데이터 없음 | 저장 검색, 재주문, lifecycle CRM, referral과 동의 철회 |
| G5 성장 운영 | MISSING | 운영 데이터 없음 | source-backed dashboard, cohort, experiment registry, guardrail과 중단 기준 |

## 공개 제품 프리뷰 범위

- 샘플 유튜버·상품·캠페인을 이용한 공개 탐색 UI
- 실제 거래가 아님을 표시하고 seed 상세·법률 초안은 `noindex`
- 공개 Worker에서 관리자·대시보드·주문·인증·업로드 경로를 fail-closed 처리
- 라이브 결제, 지급, 판매자 인증, 안전결제 배지, 광고 단가·CPV 추정 비활성

따라서 공개 표현은 **“튜버봇 마켓 제품 프리뷰”**로 제한합니다. “인증 유튜버가 입점한 거래 마켓”, “광고주 모집 중”, “유입부터 매출까지 완성” 또는 실제 트래픽·거래·매출을 암시하는 표현은 운영 증거와 외부 승인이 생기기 전까지 사용할 수 없습니다.
