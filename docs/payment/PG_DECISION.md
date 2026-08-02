# PG decision: Toss Payments (conditional)

결정 상태: **sandbox adapter 채택, live 계약/기능 적합성 미승인**. Toss Payments의 일반 결제와 오픈마켓 지급대행을 분리된 adapters로 구현한다. 계약, 업종·용역 거래 적합성, 수수료·정산 주기, chargeback, 보호결제 명칭을 서면 확인하기 전 live payment/payout과 공개 안전결제 배지는 disabled다.

## 공식 문서에서 확인한 사실

- 지급대행은 오픈마켓 매출을 토스페이먼츠가 대신 seller에게 지급하는 별도 서비스다. 직접 판매자에게 송금하거나 내부 wallet을 만들지 않는다. [지급대행 가이드](https://docs.tosspayments.com/guides/v2/payouts)
- seller 등록/수정과 payout 요청 POST body는 JWE `alg=dir`, `enc=A256GCM`, ISO-8601 `iat`, 무작위 고유 `nonce`로 암호화하고 `TossPayments-api-security-mode: ENCRYPTION`과 Basic 인증을 사용한다. 성공/실패 응답도 같은 보안 키로 암호화된다. body 없는 payout 취소 POST는 ENCRYPTION 대상이 아니다.
- 개인·개인사업자는 등록 후 `APPROVAL_REQUIRED`이며 본인인증 후 제한 지급 가능한 `PARTIALLY_APPROVED`가 된다. 법인은 문서상 제한 범위에서 즉시 지급 가능하다. seller당 주 1천만원 이상 시 `KYC_REQUIRED`, 승인 후 `APPROVED`; KYC는 주기적 재심사될 수 있다.
- 테스트 환경은 유효한 사업자번호의 법인 seller만 등록 가능하고 테스트 KYC를 완료할 수 없다. 그러므로 개인 seller E2E나 1천만원 이상 payout은 sandbox 검증 완료라고 주장할 수 없다.
- payout 요청은 멱등키를 지원하고, 요청 성공은 최종 입금 성공을 뜻하지 않는다. Toss의 최종 `COMPLETED`/`FAILED`를 `payout.changed`와 provider 조회로 확인한 뒤 내부 `PAID`/`FAILED`로 정규화한다.
- `payout.changed`와 `seller.changed`에는 `tosspayments-webhook-signature`가 있고, raw payload + transmission time을 보안 키로 HMAC-SHA256 검증한다. 일반 `PAYMENT_STATUS_CHANGED`에는 같은 signature가 제공되지 않으므로 `paymentKey`로 canonical GET 재조회해 상태·order ID·amount를 검증한다. [웹훅 이벤트](https://docs.tosspayments.com/reference/using-api/webhook-events), [웹훅 연결](https://docs.tosspayments.com/guides/v2/webhook)
- 일반 결제는 redirect의 `paymentKey`, `orderId`, `amount`를 서버가 저장값과 비교한 뒤 승인하고, 승인/조회 provider fact로 서비스 제공을 시작한다. [결제 흐름](https://docs.tosspayments.com/guides/v2/get-started/payment-flow)
- 전액/부분 취소는 원 결제의 cancel API를 사용하며 결제수단별 기한·처리시간·제한이 다르다. [결제 취소](https://docs.tosspayments.com/guides/v2/cancel-payment)

## 구현 계약

`PaymentGateway`: create/request context, confirm, get, cancel/full-or-partial, normalize event.  
`SellerVerificationProvider`: register/update/get, verify/normalize seller event.  
`PayoutProvider`: balance, request/cancel/get, verify/normalize payout event.  
`EscrowCapability`: service transaction, buyer confirmation, pre-confirm partial refund, automatic confirmation 지원 여부를 계약별로 명시한다.

구현 anchor는 `src/providers/types.ts`, sandbox adapter `src/providers/sandbox.ts`, Toss adapter `src/providers/toss/payment-adapter.ts`, 지급 암호화 `src/providers/toss/payout-security.ts`다. 도메인은 provider 상태 문자열을 직접 알지 않고 정규화 결과만 받는다.

## 보안 요구

- 보안 키/secret은 secret manager에 두고 64 hex 보안 키를 로그·DB·client에 노출하지 않는다. 키 재발급 시 7일 무중단 교체 절차를 사용한다. [API 키](https://docs.tosspayments.com/reference/using-api/api-keys)
- nonce는 CSPRNG UUID 이상, 최근 nonce/transmission ID를 unique 저장하고 timestamp 허용 범위를 적용한다.
- signature 비교는 constant-time; raw payload를 변경한 후 검증하지 않는다. raw body는 검증 메모리에만 두고 저장 시 allowlist + hash로 축소한다.
- webhook 순서 뒤바뀜/중복을 정상으로 처리하며 redirect만으로 `FUNDED`/`PAID` 처리하지 않는다.
- seller 등록 직후의 초기 `APPROVAL_REQUIRED`에는 `seller.changed`가 발송되지 않을 수 있으므로 등록 응답/GET을 canonical 초기 사실로 저장하고 이후 변경 webhook을 처리한다.
- production에서 `test_*`, sandbox/mock adapter, 누락 webhook/security key, `ENABLE_LIVE_PAYMENTS=false` 불일치는 startup/deploy failure다. Toss는 TLS 1.2+를 요구한다: [환경 설정](https://docs.tosspayments.com/guides/v2/get-started/environment).

## 아직 확인되지 않은 계약 사실

콘텐츠 제작 용역의 결제대금예치/보호결제 지원, `안전결제` 명칭과 배지, buyer confirmation/auto-confirm, 부분 환불과 payout 연계, seller 유형별 최신 한도, PG/지급 수수료, 정산 주기, chargeback 책임, prohibited categories, 세금·증빙, 장애 SLA. 계약서와 Toss 지원 답변을 `docs/compliance/SOURCE_REGISTER.md`에 등록하기 전 capability는 false다.

특히 Toss 문서의 에스크로 취소 예시는 배송정보를 전제로 하므로 콘텐츠 용역에 그대로 적용한다고 추론하지 않는다. `ENABLE_SAFE_PAYMENT_BADGE=false`를 유지한다.
