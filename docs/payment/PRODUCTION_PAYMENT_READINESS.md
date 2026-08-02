# Production payment readiness

현재 판정:

```text
PAYMENT_MODE: INTERNAL_SANDBOX_VERIFIED
TOSS_TEST_API: NOT_RUN
LIVE_PAYMENT: BLOCKED_EXTERNAL
PAYOUT_MODE: INTERNAL_SANDBOX_VERIFIED
SAFE_PAYMENT_PUBLIC_BADGE: DISABLED
```

`INTERNAL_SANDBOX_VERIFIED`는 `pnpm sandbox:verify`의 in-process provider 수직 흐름을 통과했다는 뜻이다. 외부 보고에서 단독으로 `SANDBOX_VERIFIED`라고 표기하려면 아래 자동 테스트와 Toss test API를 모두 실제로 통과해야 한다.

## Hard gate

다음 항목이 모두 증빙되지 않으면 live mode startup/deploy가 실패해야 한다.

- [ ] Toss Payments 전자결제 계약/MID와 콘텐츠 광고 용역 업종·카드사 심사 승인
- [ ] 오픈마켓 지급대행 별도 계약, seller 유형·KYC·한도·수수료·정산주기 서면 확인
- [ ] 법무 승인: 중개자 지위, 이용약관, 개인정보, 환불/분쟁/후기/콘텐츠 권리, 보호결제 명칭
- [ ] 세무 승인: VAT, 세금계산서, 개인 seller 원천징수/지급명세, chargeback/fee 처리
- [ ] live client/secret/security key를 secret manager에 저장하고 rotation owner 지정
- [ ] live webhook URLs, `payout.changed`/`seller.changed` HMAC 검증, payment canonical GET 검증
- [ ] production에서 test key/mock/sandbox 감지 시 fail-closed
- [ ] versioned terms/privacy/refund IDs와 사용자 acceptance 저장
- [ ] seller verification과 payout account provider tokenization 완료; 원 계좌 미저장/마스킹
- [ ] refund/support/dispute/incident 연락처와 영업시간 게시
- [ ] daily reconciliation, mismatch alert/hold, Finance on-call, provider statement access
- [ ] backup restore drill, rollback, observability, idempotent webhook replay drill
- [ ] chargeback·payout failure·부분 취소·중복/역순 event 테스트
- [ ] 제한 pilot 금액/사용자/기간 및 kill switch 승인

## 기능별 readiness

| Capability | Sandbox 기준 | Live 추가 기준 |
| --- | --- | --- |
| payment confirm | 저장된 orderId/amount 검증, idempotency, canonical provider result | live MID/업종 승인, 실제 소액 pilot/reconciliation |
| payment webhook | duplicate/out-of-order, GET 재조회 | 방화벽/TLS/alert/replay runbook |
| refund | 전액/부분 ledger reversal, provider failure | 결제수단별 고객 고지, 권한 분리, 실제 취소 대사 |
| seller | sandbox 법인 상태 simulation | 개인/개인사업자 본인인증, KYC recheck, privacy notice |
| payout JWE | `dir`/`A256GCM`, iat/nonce, encrypted error test | security key rotation, available balance, live fee acknowledgment |
| payout webhook | HMAC/constant-time/replay | live delivery/retry/failure/reconciliation drill |
| safe-payment badge | 항상 off | 계약상 capability + 법무가 정확한 문구 승인 |

## 승인 기록

승인자는 날짜, 범위, 계약/정책 문서 hash, 만료/재검토일을 남긴다. 단순 env 변수 변경으로 승인할 수 없고 deploy gate가 증빙 ID를 확인한다. `ENABLE_LIVE_PAYMENTS`, `ENABLE_PAYOUTS`, `ENABLE_SAFE_PAYMENT_BADGE`는 서로 독립이다.

## 공식 확인점

- [Toss 지급대행](https://docs.tosspayments.com/guides/v2/payouts)
- [Toss 환경/테스트 제약](https://docs.tosspayments.com/guides/v2/get-started/environment)
- [Toss 웹훅 이벤트와 서명 범위](https://docs.tosspayments.com/reference/using-api/webhook-events)
- [Toss 결제 취소](https://docs.tosspayments.com/guides/v2/cancel-payment)

문서는 제품 기능 설명이며 계약 조건을 대신하지 않는다. 공식 문서와 계약서가 다르면 계약/지원팀 확인 후 adapter capability를 갱신한다.
