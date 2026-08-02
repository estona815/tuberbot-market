# Refund policy draft

> **DRAFT_NEEDS_COUNSEL — 법률·PG·세무 검토 전 운영 약관으로 사용하지 마십시오.**

버전 후보: `refund-draft-2026-08-02`. 주문 수락 시 적용 버전을 contract snapshot에 고정한다. 아래 기준은 자동 환불 비율을 확정하지 않으며 B2B/B2C, 통신판매자/중개자 지위, 맞춤 제작 용역의 청약철회 제한을 법률가가 결정해야 한다.

## 기본 원칙

- 환불은 원 결제수단을 우선하고 store credit을 강제하지 않는다.
- 실제 환불 완료는 Toss cancel API 응답/재조회 등 provider fact로 확인한다.
- creator 지급 전에 환불을 우선 처리한다. 지급 후 분쟁은 임의의 음수 정산으로 상계하지 않는다.
- 총 환불액은 captured amount를 초과할 수 없고, 각 요청은 idempotency key를 가진다.
- 결제수단별 취소 가능 기간과 처리시간이 다르므로 화면에는 provider 최신 사실을 표시한다. [Toss 결제 취소 가이드](https://docs.tosspayments.com/guides/v2/cancel-payment)

## 단계별 결정 초안

| 단계 | 기본 처리 | 자동 가능 여부 |
| --- | --- | --- |
| 결제 실패/중복 결제 | 승인되지 않은 시도는 청구 없음; 중복 승인분 전액 취소 | provider ID와 amount가 명확할 때 가능 |
| creator 수락 전 또는 바로구매 일정 미확정 | 전액 취소 요청 | 계약된 timeout + 미착수 증거가 있을 때 가능 |
| FUNDED, 제작 착수 전 | 전액 또는 실제 발생비용 공제 여부 법무 결정 | 비율 자동화 금지 |
| 제작 중/초안 제출 | 합의, 계약 milestone, 사용 가능한 산출물에 따라 부분 환불 | 사람이 승인; 정액표 금지 |
| 최종 승인/게시 후 | 하자·계약 위반·표시 누락·조기 삭제 등 구체 사유별 판단 | 자동 금지 |
| chargeback/provider reversal | 주문·지급 즉시 hold, 사실 확인 후 ledger 반영 | provider event intake만 자동 |

## 요청 절차

주문 화면에서 사유, 요청 금액, 설명, 증거를 제출한다 → 상대방에게 통지 → 지급 hold → Support 검토 → 합의 또는 dispute 전환 → 승인자가 reason code와 근거를 기록 → provider cancel → payment 조회로 상태/금액 확인 → refund/reversal ledger posting → 양측 통지.

부분 취소는 `cancelAmount`를 명시한다. 가상계좌 등 결제수단별 추가 환불 정보는 provider가 요구할 때만 수집하고 로그/일반 DB에 원문을 남기지 않는다. Toss 문서상 미입금 가상계좌는 부분 취소가 불가능하다.

## 화면 고지

결제 전 총액, creator 보상, 플랫폼 수수료, 환불 기준 버전, 맞춤 제작 특성, 예상 처리 기간, 고객지원/분쟁 경로를 표시한다. `취소 요청됨`, `PG 취소 처리 중`, `환불 완료`를 구분한다.

## 법률 검토 질문

전자상거래법 적용/제외, 맞춤 제작 또는 용역의 청약철회 제한 요건과 사전 동의, B2B 거래, 제품 제공분 반환, 플랫폼 수수료/VAT/PG 비용, creator 기성고 산정, payout 후 환수, chargeback 부담 주체를 확정해야 한다. 현행 법령은 [국가법령정보센터](https://www.law.go.kr/LSW/lsInfoP.do?ancNo=21312&ancYd=20260120&efYd=20260721&lsiSeq=282793)에서 검토한다.
