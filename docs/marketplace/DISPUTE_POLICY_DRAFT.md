# Dispute policy draft

> **DRAFT_NEEDS_COUNSEL — 법률·PG 검토 전 운영 약관으로 사용하지 마십시오.**

## 범위

미응답, 일정 미준수, brief/수정 횟수 불일치, 승인 지연, 게시 누락·조기 삭제, 광고 표시 누락, 사용권 침해, 허위 표현 강요, 제품 미배송, 무단 취소, 결제/chargeback을 구조화된 reason code로 접수한다.

## 처리 원칙

- 접수 즉시 payout과 자동 구매확정을 시스템적으로 hold한다.
- AI는 증거 정리만 하며 판정·환불·지급을 실행하지 않는다.
- 담당자는 이해상충을 신고하고 양 당사자에게 같은 제출 기회를 준다.
- 계약 version, status/provider event, 메시지, deliverable hash, publication proof를 보존한다. 새 증거가 원본을 덮지 않는다.
- 결정에는 사실 인정, 적용 contract/policy version, 금액, reason, 승인자, 시각을 기록한다.

## 절차 초안

1. 당사자가 terminal payout 전에 접수한다. 긴급 권리침해/불법 콘텐츠는 별도 moderation으로 즉시 제한할 수 있다.
2. 시스템이 `DISPUTED`, `BLOCKED_DISPUTE`와 evidence snapshot을 원자적으로 만든다.
3. 접수 확인과 증거 제출 마감(초안: 5영업일)을 양측에 알린다.
4. Support가 완전성 확인, Risk/Legal/Finance로 escalation한다.
5. 당사자 합의를 우선하되 강압적 합의나 플랫폼 밖 지급을 요구하지 않는다.
6. 담당자가 `전액 환불`, `부분 환불`, `creator 지급`, `추가 이행`, `기각` 중 승인 가능한 결정을 기록한다.
7. provider와 ledger가 완료된 뒤에만 주문 결과를 확정한다.
8. 결정 통지 후 이의제기 기간(초안: 7일)을 제공하고 다른 검토자가 재검토한다.

기한은 약관이 아니라 운영 초안이며 법률가가 확정한다. 법정·PG·카드사 기한은 내부 기한보다 우선한다.

## 긴급 escalation

불법 콘텐츠, 개인정보·계좌 노출, 아동 안전, 명백한 저작권 침해, 위조 증거, 계정 탈취, 고액/반복 chargeback은 Risk/Legal/보안 incident로 즉시 이관한다. 계좌 원문이나 webhook body는 dispute export에 넣지 않는다.

## 외부 구제

플랫폼 절차가 소비자의 법정 권리나 관계기관 신고·조정을 제한하지 않는다고 명시한다. 정확한 관할 기관·연락처와 사업자 지위 문구는 법률 검토 후 게시한다. 통신판매중개자는 불만·분쟁 해결에 필요한 조치를 신속히 해야 한다는 전자상거래법 제20조를 검토한다: [국가법령정보센터 조문](https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900232735).
