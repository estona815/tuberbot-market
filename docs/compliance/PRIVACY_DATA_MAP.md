# Privacy data map

상태: **DRAFT_NEEDS_COUNSEL / DATA_PROTECTION_REVIEW**. 이 문서는 inventory이며 공개 개인정보 처리방침이 아니다.

## 데이터 흐름

| 범주 | 예시 | 목적/주체 | 저장·공유 | 보존/삭제 gate |
| --- | --- | --- | --- | --- |
| 계정 | email, 표시명, locale, session ID | 로그인·보안 | PostgreSQL/auth adapter | 탈퇴+법정 예외; 확정 필요 |
| 조직 | 법인명, member/role | 광고주/대행사 권한 | PostgreSQL | 계약/법정 기준 확정 |
| 채널 공개 데이터 | channel ID, title, thumbnail, stats, fetched_at | discovery | YouTube/legacy → PostgreSQL | 비인가 API 데이터 30일 refresh/delete |
| YouTube OAuth | subject, scopes, encrypted token ref | claim/소유권 | server secret store/Google | revoke 즉시 token revoke; authorized data 최대 7일 내 삭제 정책 검증 |
| seller verification | seller provider ID, type, status, CI/KYC 결과 | 지급 자격 | Toss ↔ restricted DB | 원문 CI 최소화; 계약/법률 확정 |
| 지급 | payout account provider token, masked bank | payout | Toss/provider; restricted DB | 원 계좌번호 저장·로그 금지 |
| 거래 | brief, proposal, contract, order, fee | 계약 이행·증빙 | PostgreSQL/PDF storage | 법정 기록 기간별 분리; 확정 필요 |
| 결제 | paymentKey/provider IDs, amount/status | 결제·환불·대사 | Toss ↔ PostgreSQL | 카드/계좌 원정보 수집 금지 |
| 메시지/파일 | text, private drafts, metadata/hash | 작업·분쟁 | PostgreSQL/private object storage | 주문/분쟁 lifecycle + policy 확정 |
| 분쟁 | reason, evidence, decision | 피해구제 | restricted storage/Support | 민감 불필요 정보 redact; 기간 확정 |
| 후기 | score/text/report/appeal | 신뢰·중개 | PostgreSQL/public 일부 | 삭제 대신 제한/audit 분리 |
| telemetry | IP 최소화, UA, request/trace ID | 보안·품질 | logs/monitoring provider | 짧은 retention; PII masking |
| AI 입력 | 선택된 brief/summary | 사용자 승인 초안 | AI adapter | opt-out, 최소화, training 금지 계약 |

## 금지 데이터

raw bank account, 카드번호/CVC, security/API key, OAuth access/refresh token 원문, signed upload URL, raw webhook body, 주민등록번호는 일반 DB·로그·analytics에 저장하지 않는다. 불가피한 법적 처리는 별도 승인된 encrypted vault와 최소 권한을 요구한다.

## 통제

- 수집 시 목적·필수/선택·보유기간·거부 영향과 controller 연락처를 표시한다.
- role + organization scope + object ownership을 모두 검증한다. Admin도 민감 필드는 기본 마스킹.
- export/delete/rectify/revoke 요청은 identity re-verification, ticket, downstream deletion, 완료 증빙을 가진다.
- processor/third-party/국외 이전 register에 Toss, Google/YouTube, hosting, storage, email, monitoring, AI를 계약 후 정확한 법인·국가·목적·기간으로 기록한다.
- production dump는 개발에 사용하지 않는다. backup 삭제는 retention 만료와 restore copy까지 반영한다.

개인정보 처리방침에는 처리 목적·기간·제3자 제공·파기·위탁·권리·보호책임자 등 법정 항목을 포함해야 한다: [개인정보 보호법 제30조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1020398435), [작성지침](https://www.privacy.go.kr/front/bbs/bbsView.do?bbsNo=BBSMSTR_000000000049&bbscttNo=20806).

## 검증 evidence

분기별 data inventory diff, DB column classification, log sampling(redacted), access review, processor list, deletion drill, backup expiration drill, YouTube revoke drill을 보안/개인정보 담당자가 서명한다.
