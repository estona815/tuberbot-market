# Product specification

## 제품 약속

계약 전 공개 약속은 “유튜브 광고, 검색부터 계약과 콘텐츠 검수까지 한 번에.”로 제한한다. PG 계약과 법무 승인 전 결제 관련 공개 문구는 `샌드박스 결제` 또는 `결제 보호 기능 준비 중`만 사용한다. `안전결제`, `에스크로`, 수익 보장 표현은 disabled다.

## 대상과 범위

- 광고주/대행사: creator·상품 탐색, 캠페인 등록, 제안·협상, 계약, 결제, 검수, 분쟁, 후기, 사용권 갱신.
- creator: channel claim, seller verification, package/rate card, 제안, 제작물 version, 게시 증빙, 지급 상태.
- 운영: 사용자/상품/주문/결제/환불/지급/분쟁/후기/수수료/feature flag/대사/audit.
- MVP 한 주문은 광고주 1명과 creator 1명. 다수 creator 캠페인은 child order로 분리한다.

## 핵심 성공 조건

1. legacy 탐색 route의 검색 유입과 ID가 보존된다.
2. 동일 proposal version 양측 수락 후 immutable contract snapshot이 생성된다.
3. 결제는 서버 승인 + provider 조회/webhook으로 확인된 뒤에만 `FUNDED`다.
4. 완료 거래마다 snapshot fee가 balanced ledger에 자동 기록된다.
5. dispute/verification/risk/chargeback/reconciliation mismatch는 payout을 차단한다.
6. creator·광고주가 콘텐츠 사용 범위와 종료일을 결제 전 확인한다.

## MVP 기능

- package와 campaign 양면 시장, 검색/filter/favorite/shortlist.
- structured proposal/counteroffer와 clickwrap contract.
- order room: timeline, brief, message, private versioned deliverable, revision/approval/publication proof.
- sandbox payment/refund/payout adapters, immutable double-entry ledger, daily reconciliation.
- dispute/evidence/decision/appeal, bilateral reviews, license renewal.
- in-app/email notification adapter와 RBAC admin.

## 비범위/기본 off

live payments/payouts, 내부 wallet, 현금 충전/송금, 규제 카테고리, 자동 구매확정, public transaction benchmark, 예상 rate/CPV, agency subscription, featured listing, public safe-payment badge. 외부 전자서명·OpenSearch·AI 자동 결정도 MVP 필수가 아니다.

## 지표

GMV가 아니라 `funded→completed 전환`, 분쟁률, 환불률, 지급 실패, 대사 불일치, creator 응답시간, 반복 거래, license renewal을 실제 ledger/order 데이터에서 계산한다. development seed를 운영 지표와 합치지 않는다.

## 출시 단계

internal sandbox → verified pilot creator → PG/법무/세무/YouTube 확인 → 제한 live pilot → public. 단계별 조건은 `docs/payment/PRODUCTION_PAYMENT_READINESS.md`에 있다.
