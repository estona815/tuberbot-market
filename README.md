# TuberBot Market

튜버봇 마켓은 기존 유튜버 탐색을 보존하면서 광고 상품, 구조화된 제안, 계약 스냅샷, 샌드박스 결제, 콘텐츠 검수, 분쟁 보류, 이중분개 원장과 지급대행 준비 흐름을 한 저장소에 구현하는 모듈형 모놀리스입니다.

> 공개 사이트는 샘플 데이터로 구성된 제품 프리뷰이며 실제 입점, 제안, 계약, 결제 또는 정산을 제공하지 않습니다. 현재 공개 결제 보호 배지는 비활성화되어 있습니다. 이 저장소의 기본 결제·정산 동작은 샌드박스이며, Toss Payments 지급대행 계약·법무·세무 검토 전에는 라이브 결제와 지급을 활성화할 수 없습니다.

## 빠른 시작

필수: Node.js 20.9 이상, pnpm 11, PostgreSQL 17. Docker가 있으면 `compose.yml`을 사용할 수 있습니다.

```bash
cp .env.example .env.local
docker compose up -d postgres minio
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Docker가 없는 CI/검증 환경에서는 통합 테스트가 PGlite 임베디드 PostgreSQL을 사용합니다.

DB 없이 주문 협업 화면을 로컬에서 확인할 때만 아래처럼 명시적으로 격리된 데모를 켤 수 있습니다. 세션과 주문 기록은 프로세스를 재시작하면 사라지며, loopback·development·sandbox 조건 중 하나라도 맞지 않으면 활성화되지 않습니다.

```bash
APP_ORIGIN=http://127.0.0.1:3000 \
ENABLE_LOCAL_DEMO_AUTH=true \
TUBERBOT_ORDER_DEMO_MODE=true \
PAYMENT_MODE=sandbox \
ENABLE_LIVE_PAYMENTS=false \
SESSION_HASH_PEPPER="$(openssl rand -hex 32)" \
pnpm dev
```

이후 `/login`에서 “광고주 로컬 데모”를 선택하고 주문 `TBM-20260802-001`을 열 수 있습니다. 로컬 데모는 실제 가입·본인인증·결제 계정이 아닙니다.

## 품질 게이트

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm db:check
pnpm sandbox:verify
pnpm build
pnpm test:e2e
```

`pnpm sandbox:verify`는 내부 sandbox provider로 계약 스냅샷 → 결제 확정/중복 webhook → 제작·수정·승인 → 복식부기 원장 → 지급 자격/대사 → 지급 완료까지 한 주문을 재현합니다. 이는 Toss 테스트 API 또는 라이브 결제 검증을 대신하지 않습니다.

## 안전한 기본값

- `ENABLE_LIVE_PAYMENTS=false`
- `ENABLE_PAYOUTS=false`
- `ENABLE_SAFE_PAYMENT_BADGE=false`
- `ENABLE_ESTIMATED_AD_RATE=false`
- `ENABLE_ESTIMATED_CPV=false`
- `ENABLE_REGULATED_CATEGORIES=false`

운영 준비 조건과 외부 차단사항은 `docs/payment/PRODUCTION_PAYMENT_READINESS.md`와 `docs/compliance/LEGAL_OPEN_QUESTIONS.md`를 확인하세요.

현재 구현에는 digest-only opaque session, Origin+CSRF 검증, 정확한 광고주·크리에이터 주문 당사자 scope, 최근 100건 cursor 메시지 조회, PostgreSQL 트랜잭션 기반 메시지·검수·멱등성·audit/outbox 기록, 비공개 업로드 검증 포트와 scan quarantine gate, outbox lease/retry/dead-letter 참조 구현이 포함됩니다. 브라우저용 로컬 데모도 동일한 session/CSRF 경계를 통과합니다.

아직 연결되지 않은 운영 의존성은 외부 identity provider, staff case/order assignment, 분산 rate limiter, 실제 private object storage와 AV scanner, 운영 outbox worker, Toss 테스트/라이브 API, 모니터링·백업 증적입니다. 이 의존성이 없는 production 경로는 메모리나 sandbox로 자동 대체되지 않고 401/503 또는 기능 비활성 상태로 실패합니다.

Acquisition-to-Revenue Pipeline V2 대비 단계별 증거와 남은 조건은 [`docs/growth/ACQUISITION_REVENUE_STATUS.md`](docs/growth/ACQUISITION_REVENUE_STATUS.md)에 기록합니다.

## 공개 Sites 프리뷰

`pnpm build:sites`는 공개 탐색 화면을 Cloudflare Workers 기반 Sites 번들로 만듭니다. 이 프리뷰의 Worker는 `/admin`, `/dashboard`, `/orders/*`, 인증·주문·업로드 API를 404로 차단합니다. 운영 거래 기능은 PostgreSQL, 외부 인증, 비공개 객체 저장소 및 승인된 결제 공급자가 연결된 별도 환경에서만 활성화해야 합니다.

## License

공개 열람과 검수용 저장소이며 오픈소스 라이선스는 부여되지 않습니다. 별도 서면 허가 없이 복제, 배포 또는 상업적 사용을 허용하지 않습니다.
