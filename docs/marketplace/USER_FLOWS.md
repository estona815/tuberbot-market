# User flows

## 1. Legacy discovery → claim

`/` 검색 → `/search` 필터 → `/channel/[legacyId]` → 소유권 요청 → 로그인/조직 선택 → 최소 YouTube OAuth scope 또는 공식 대체 증빙 → 중복 claim 검사 → `CLAIM_PENDING` → 승인 시 `CHANNEL_VERIFIED`. 미인증 profile은 열람·관심 등록만 가능하고 구매 CTA는 비활성이다.

## 2. 고정 상품 주문

상품 상세 → brief/권리/일정/가격 확인 → 제안 → creator 수락/counteroffer → 양측 동일 version 수락 → contract snapshot/hash → `AWAITING_PAYMENT` → 서버가 order/amount 검증 → PG 인증/승인 → provider 사실 확인 → `FUNDED` → 제작/초안/version → 승인 또는 제한된 수정 → 게시 URL/표시 증빙 → 구매확정 → fee/creator payable posting → hold 재검사 → payout → webhook `PAID` → `COMPLETED` → blind review 공개.

오류 경로: 결제 실패는 재시도 가능; 일정 미확정 바로구매는 provider 취소 확인 후 취소; open dispute는 payout/auto-confirm 중단.

## 3. 캠페인

광고주 조직이 캠페인 작성 → 금지 카테고리/risk 검토 → 공개 → creator 지원 또는 초대 → 개별 proposal → 선택 creator마다 child order 생성 → 이후 고정 상품 흐름. 캠페인 예산 합계와 child order 금액은 별도로 표시한다.

## 4. 콘텐츠 검수

creator가 private direct-upload URL 발급 → 업로드 완료 callback → MIME/크기/hash/malware 검사 → deliverable version 제출 → 광고주가 승인 또는 계약상 잔여 횟수 내 구조화 수정 요청 → final approval. signed URL은 짧게 만료되고 주문 당사자만 재발급할 수 있다.

## 5. 분쟁/환불

당사자 접수 → 즉시 payout hold + auto-confirm 중단 → 계약/메시지/파일 hash/상태 event snapshot → 양측 evidence window → Support/Risk 담당 → 사람이 사유·근거·금액을 결정 → provider refund 또는 payout → ledger reversal/posting → 통지 → appeal. AI는 요약만 한다.

## 6. 사용권 갱신

30/14/3/0일 알림 → 광고주 renewal proposal → creator 수락/counteroffer → 새 contract/license version → 별도 결제/order → renewal fee snapshot → 기존 권리를 덮지 않고 새 기간 활성화.

## 공통 실패 UX

- state-changing 요청은 idempotency key를 보내며 네트워크 재시도 시 동일 결과를 반환한다.
- 권한 오류는 존재 여부를 노출하지 않는 404/403 정책을 route별 일관되게 적용한다.
- provider pending은 `처리 중`으로 표시하고 완료를 추정하지 않는다.
- 모든 금액은 KRW 정수, 수수료·환불·creator 예상 수령액을 결제 직전에 다시 표시한다.
