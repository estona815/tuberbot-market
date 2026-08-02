# Legal open questions

> **DRAFT_NEEDS_COUNSEL — 아래는 쟁점 목록이며 법률 의견이 아닙니다.**

모든 항목은 owner, 외부 counsel 결론, 적용 사용자/거래, effective date, 문서 hash를 기록하기 전 production capability를 열지 않는다.

## 거래 구조

- TuberBot이 통신판매중개자, 통신판매업자, 또는 managed campaign에서 거래 당사자 중 무엇에 해당하는가?
- 광고주가 사업자여도 소비자와 같은 지위인 예외가 적용될 수 있는가? 전자상거래법 B2B 적용 제외 범위는?
- 2026-07-21 시행 개정의 개인 seller 신원 확인·제공, 후기 삭제/이의제기, 분쟁 의무를 어떤 화면/기록으로 충족하는가?
- 통신판매업/통신판매중개 관련 신고, 사업자·호스팅·고객지원 고지 범위는?

## 결제·지급

- 광고 콘텐츠 제작 용역이 Toss의 오픈마켓 지급대행 및 결제대금예치/보호결제 대상인가?
- `안전결제`, `결제 보호`, `에스크로` 명칭과 배지를 사용할 계약상·법률상 조건은?
- TuberBot fee/creator consideration/제품 제공가치의 법적 거래 구조와 VAT 처리 주체는?
- 개인/개인사업자/법인 seller의 본인확인, KYC, 원천징수, 지급명세, 세금계산서 의무는?
- 부분 환불, PG fee, payout 후 환수, chargeback 손실과 증빙의 부담 주체는?
- 2026-12-17 시행 전자금융거래법 개정이 TuberBot/PG 계약과 정산자금 고지에 미치는 영향은?

## 계약·환불·분쟁

- 맞춤 제작물/용역의 청약철회 제한 요건, 별도 고지·동의, 제작 착수/기성고 기준은?
- clickwrap, canonical JSON/PDF/hash, IP 최소화 증빙의 전자계약 효력과 보존기간은?
- 자동 구매확정 기한을 둘 수 있는가? 분쟁·장애·미성년/대리권 예외는?
- 분쟁 결정의 법적 성격, 관할/준거법, 외부 조정, appeal과 evidence 보존 범위는?

## 콘텐츠·광고

- organic publish, paid media, whitelisting, 편집, 독점, 영구 이용의 정확한 저작권/초상권 문구는?
- creator의 체험 표현과 광고주의 근거자료 책임, 경제적 이해관계 표시 위치·형식은?
- 의료/건강/금융/주류/담배/도박/아동 관련 카테고리의 허용·금지·사전심의 기준은?
- DMCA가 아닌 국내 notice/takedown, 반론, 반복 침해자 정책과 중간자 책임은?

## 개인정보·플랫폼 데이터

- seller CI/KYC, 사업자번호, 계좌 token, dispute evidence의 법적 근거·필수/선택 구분·보유기간은?
- Toss, object storage, email, monitoring, YouTube/Google, AI provider의 위수탁/제3자 제공/국외 이전 고지는?
- 계약·회계 보존과 삭제권 충돌 시 분리보관/비식별화 방식은?
- YouTube OAuth/API 데이터의 30일 갱신·revocation 7일 삭제 요구를 운영 보존과 어떻게 분리하는가?

## 차단 mapping

미결 거래 구조/PG 명칭 → `ENABLE_LIVE_PAYMENTS=false`, `ENABLE_SAFE_PAYMENT_BADGE=false`; 미결 seller/세무 → `ENABLE_PAYOUTS=false`; 미결 규제 광고 → `ENABLE_REGULATED_CATEGORIES=false`; 미결 YouTube 지표 → `ENABLE_ESTIMATED_AD_RATE=false`, `ENABLE_ESTIMATED_CPV=false`, `ENABLE_PUBLIC_TRANSACTION_BENCHMARKS=false`.

주요 현행 출처: [전자상거래법](https://www.law.go.kr/LSW/lsInfoP.do?ancNo=21312&ancYd=20260120&efYd=20260721&lsiSeq=282793), [개인정보 보호법 제30조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1020398435), [추천·보증 심사지침](https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000280130), [Toss 지급대행](https://docs.tosspayments.com/guides/v2/payouts).
