# Current state audit

기준 시각: 2026-08-02 KST  
대상: `https://tuberbot.co.kr` 및 repository root

## 결론

운영 사이트는 유튜버 탐색 서비스이며 마켓플레이스 거래 시스템은 확인되지 않았다. 신규 저장소는 기존 URL을 보존하는 Next.js 16/PostgreSQL 모듈형 모놀리스로 전환 중이다. 공개 `예상 광고 단가`와 `예상 CPV`는 출처·산식·허가·갱신일을 확인할 수 없어 즉시 공개 비활성화하고 원본만 접근 제한된 migration archive에 보존한다.

## 운영 사이트에서 직접 확인한 사실

2026-08-02 KST에 인증 없는 HTTP GET으로 확인했다. 브라우저 내부 동작, 운영 DB, 배포 콘솔 및 비공개 API는 접근하지 않았으므로 미확인이다.

| 항목 | 관찰 | 조치 |
| --- | --- | --- |
| `/`, `/search`, `/channel/[id]` | 모두 HTTP 200 | URL과 검색 유입을 그대로 보존하고 회귀 테스트 |
| 프레임워크 | 응답 헤더 `x-fah-adapter: nextjs-14.0.12`, `x-powered-by: Next.js`; Google 경유 응답 | 새 앱 전환 시 캐시·헤더·원본 호스트 노출 회귀 확인 |
| 홈 | 검색, 카테고리, 추천 채널, 공개 예상 단가/CPV | 단가/CPV 공개 중단; creator rate card로 대체 |
| 검색 | 22,417건/2,242페이지가 초기 응답에 표시됨; 채널·구독자·카테고리 필터 | 데이터 원천·갱신 주기·삭제 요청 가능 여부 확인 후 이관 |
| 채널 | 채널명, 설명, 썸네일, 구독자·영상·조회수, 광고 제안 CTA | legacy ID와 YouTube channel ID를 alias로 보존 |
| 인증 | 단가/CPV 열람과 일부 CTA는 `/login`으로 연결 | 사용자/세션은 별도 데이터 이관 계획 없이는 이전됐다고 가정하지 않음 |
| SEO | 동일한 전역 title/description; `/robots.txt`, `/sitemap.xml`은 404 | route별 metadata, robots, sitemap, canonical 추가 |
| 링크 | 검색 페이지네이션이 `wallaby-…a.run.app` 원본 URL을 노출 | 상대 URL로 교체하고 원본 호스트 노출 차단 |
| 푸터 | 법인명만 확인; 약관·개인정보·사업자 연락처 링크 미확인 | 계약 전 법무 검토된 고지/정책/연락처 제공 |
| 문서 언어 | `<html lang="kr">` | BCP 47 `ko` 또는 `ko-KR` 사용 |

샘플 데이터에는 서로 다른 추천 카드가 같은 YouTube 링크를 가리키는 정황과 갱신 시각이 현재보다 미래인 검색 레코드가 있었다. 전체 데이터 오류율을 의미하지 않지만, 이관 전 중복·시간 범위·채널 ID 일치 검증이 필요하다.

## 신규 저장소 기준선

- Git branch: `codex/feat/tuberbot-safe-marketplace`; remote와 commit은 감사 시점에 없음.
- 런타임: Next.js `16.2.12`, React `19.2.8`, TypeScript strict, Node `>=20.9`, pnpm `11.9.0`.
- 데이터: PostgreSQL 17, Drizzle ORM, 로컬 Docker Compose; 테스트용 PGlite.
- 품질 명령: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- 보안 헤더는 `next.config.ts`, DB 설정은 `drizzle.config.ts`, 로컬 서비스는 `compose.yml`에 있다.
- 실제 결제·지급·안전결제 배지·규제 카테고리·예상 단가/CPV의 기본값은 off여야 한다.

감사 시점의 신규 UI route에는 `/`, `/search`, `/market`, `/creators`, `/creators/[slug]`, `/packages/[id]`, `/campaigns`, `/orders/[id]`, `/dashboard`, `/admin`, `/robots.txt`, `/sitemap.xml`이 있다. `src/app/channel/[id]/page.tsx`는 legacy URL을 `/creators?legacyChannelId=...`로 영구 redirect한다. compatibility entry는 구현됐지만 production legacy ID를 정확한 public slug/profile로 해석하는 alias import는 아직 데이터 migration release blocker다. 도메인/adapter/schema와 `/api/health`는 존재하지만 거래 API handler, 실제 session authorization, worker, private storage upload, production provider 통신은 확인되지 않았다. 파일 존재를 기능 완료로 간주하지 않는다.

## 증거와 한계

- 운영 사이트: [홈](https://tuberbot.co.kr/), [검색](https://tuberbot.co.kr/search). 동적 채널 URL은 legacy ID를 사용하므로 샘플 ID를 문서의 영구 링크로 삼지 않는다.
- 공식 YouTube 정책상 비인가 통계는 30일 안에 삭제 또는 갱신해야 하며, API에 없는 독립 파생 지표 제공은 제한된다: [YouTube API Developer Policies](https://developers.google.com/youtube/terms/developer-policies), [정책 준수 가이드](https://developers.google.com/youtube/terms/developer-policies-guide).
- 운영 DB 스키마, 데이터 취득 계약, YouTube API 프로젝트·quota/audit 상태, 개인정보 처리방침 버전, 인증 공급자, 실제 사용자 수는 미확인이다. 이 항목은 migration 전에 운영 담당자가 증빙해야 한다.

## 출시 차단 기준

legacy route 회귀, 원본 데이터 provenance, CPV/rate 비공개, seller claim, 법률 고지, 개인정보 처리방침, PG 계약 중 하나라도 검증되지 않으면 마켓플레이스 공개 전환을 차단한다.
