# E-commerce checklist

> **DRAFT_NEEDS_COUNSEL — 2026-07-21 시행 법령을 기준으로 한 구현 체크리스트이며 법률 의견이 아닙니다.**

## 사업자/중개 구조

- [ ] 거래 유형별 TuberBot/광고주/creator의 당사자·중개자 지위를 결제 전 명확히 표시
- [ ] 통신판매업/중개 관련 신고와 사업자명, 대표, 등록번호, 주소, 연락처, 호스팅 고지 확인
- [ ] 사업자 seller 신원정보를 확인하고 청약 전 필요한 범위로 제공
- [ ] 개인 seller 정보 확인·제공 방식과 과다 공개 방지, 기록 증빙 구현
- [ ] 중개자의 불만·분쟁 조치, 고객지원/외부 구제 경로 운영

전자상거래법 제20조는 중개자가 거래 당사자가 아님을 사전 고지하고 사업자 seller 정보를 확인·제공하며 분쟁 해결 조치를 하도록 규정한다: [조문](https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900232735). 정확한 적용은 counsel이 확정한다.

## 주문/계약

- [ ] 상품/creator, 총액·세금·수수료, 지급 시기, 제작/게시일, 수정, 사용권, 취소·환불을 청약 전에 표시
- [ ] proposal/contract/policy/fee version과 양측 acceptance hash/timestamp 보존
- [ ] 결제 버튼이 지급 의무를 명확히 표현하고 주문 정정 기회 제공
- [ ] 맞춤 제작/용역 청약철회 제한의 법적 요건과 별도 동의 확인
- [ ] 계약·대금·공급·불만/분쟁 기록별 법정 보존기간과 열람 방법 확정

## 결제/환불/지급

- [ ] PG 계약/MID/업종 심사, 지급대행 계약, seller KYC/CI 확인
- [ ] redirect가 아닌 server approval + provider fact로 결제 확정
- [ ] 원 결제수단 환불, 수단별 기간/소요, 부분 환불 제한 고지
- [ ] `안전결제`/`에스크로` 명칭은 계약과 법무 승인 전 disabled
- [ ] platform이 고객 자금을 자체 계좌/내부 wallet에 보관하지 않음
- [ ] refund/dispute/chargeback/mismatch가 payout을 차단

## 후기/광고/콘텐츠

- [ ] completed 거래만 후기 작성; 삭제 기준·통지·이의제기·복구 절차 사전 공개
- [ ] 추천·프로모션 노출을 광고로 표시하고 가짜 평점/거래량 금지
- [ ] 현금·제품·제휴수익 등 경제적 이해관계 표시 checklist와 YouTube paid promotion 확인
- [ ] 금지/규제 카테고리와 증빙·수동 심사·신고/takedown 운영
- [ ] 콘텐츠 license 범위·기간·territory·editing/paid media/exclusivity를 구조화

2026-07-21 시행 개정은 개인 간 거래와 후기 절차 관련 규율을 포함한다: [법령 및 개정 이유](https://law.go.kr/lsInfoP.do?ancYnChk=0&chrClsCd=010202&efYd=20260721&lsId=&lsiSeq=282793&urlMode=lsEfInfoR&viewCls=lsRvsDocInfoR). 경제적 이해관계 표시는 [추천·보증 심사지침](https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000280130)을 검토한다.

## 개인정보/접근성

- [ ] privacy/terms/refund/marketplace/review/rights 정책 version과 acceptance
- [ ] 수집·위탁·제3자 제공·국외 이전·보유/파기·정보주체 권리 문구
- [ ] WCAG 2.2 AA, keyboard/focus/error label, 390/768/1440px 검증
- [ ] dashboard/order/message/payment/payout/dispute/admin은 noindex

## 승인 packet

법률 의견서 ID, 사업자 신고 증빙, PG/지급대행 계약 capability, 정책 hash, UI screenshots, seller verification test, refund/dispute drill, review appeal drill을 하나의 release ticket에 첨부한다. 한 항목이라도 미완료면 관련 feature flag를 off로 유지한다.
