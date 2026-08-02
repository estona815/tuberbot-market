# YouTube API audit

## 판정

```text
LEGACY_SOURCE_AUTHORIZATION: UNVERIFIED
ESTIMATED_AD_RATE: ARCHIVE_ONLY / PUBLIC_DISABLED
ESTIMATED_CPV: ARCHIVE_ONLY / PUBLIC_DISABLED
YOUTUBE_OAUTH: BLOCKED_UNTIL_SCOPE_AND_DELETION_REVIEW
```

운영 사이트는 2026-08-02 KST에 channel title/description/thumbnail/subscriber/video/view counts와 예상 단가·CPV를 공개 또는 로그인 뒤 표시했다. 데이터 원천, API project, owner authorization, 산식, 갱신일, quota audit, 개인정보 고지는 공개 화면에서 확인되지 않았다. 따라서 적합성을 추정하지 않는다.

## 정책 mapping

- non-authorized YouTube API 통계는 30일을 넘겨 저장할 수 없고 삭제 또는 refresh해야 한다.
- authorized 통계를 더 오래 저장하더라도 30일마다 authorization과 대상 존재를 재확인해야 한다.
- 사용자가 동의를 철회하면 token을 즉시 revoke하고 그 동의로 취득한 Authorized Data를 가능한 즉시, 최대 7일 내 삭제해야 한다.
- YouTube API에 없는 독립 파생 metric을 제공하거나 YouTube 데이터와 외부 데이터를 source 구분 없이 결합하지 않는다.
- 공개/비공개 YouTube API 데이터, 광고주 first-party 성과, TuberBot 거래 지표를 UI/DB/provenance에서 구분한다.

근거: [Developer Policies](https://developers.google.com/youtube/terms/developer-policies), [Compliance Guide](https://developers.google.com/youtube/terms/developer-policies-guide), [API Terms](https://developers.google.com/youtube/terms/api-services-terms-of-service).

## migration 조치

1. legacy export에 `source`, `api_project`, `fetched_at`, `authorization_type`, `owner_subject`, `expires_at`, `formula_version`을 요구한다.
2. 누락된 공개 데이터는 `DISCOVERY_ONLY` quarantine 또는 30일 이내 공식 refresh/delete 대상으로 분류한다.
3. rate/CPV 원본은 접근 제한된 archive에 보존하되 신규 검색·추천·가격 산식·SEO·benchmark에서 제외한다.
4. 신규 가격은 creator가 직접 입력한 rate card와 실제 TuberBot 계약 price만 사용한다.
5. 거래 benchmark는 법무/정책 승인, 최소 5건, range/median, 재식별 방지 후 별도 flag로만 연다.

## OAuth 설계 gate

- ownership claim에 필요한 최소 scope와 API method를 문서화하고 consent 화면에 목적을 설명한다.
- client secret/token은 server-only encrypted storage; disconnect/revoke/delete UI 제공.
- token refresh 실패/Google 권한 철회를 정기 감지하고 downstream 삭제 job을 만든다.
- public privacy policy에 Google privacy/security settings 링크, YouTube 데이터 사용·보존·삭제를 명시한다.
- scope/use case/quota 변경 전 compliance audit 필요 여부를 검토한다. [YouTube API audit form](https://support.google.com/youtube/contact/yt_api_form)

## 출시 증빙

Cloud project owner, OAuth scopes, consent screenshots, privacy/terms URLs, quota, API request inventory, 30-day refresh job, revoke/delete test, provenance query, public source labels, rate/CPV zero-public assertion를 Compliance가 확인해야 한다.
