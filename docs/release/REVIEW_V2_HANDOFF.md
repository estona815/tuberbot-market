# TuberBot review release v2 — 2026-09-05

## Scope

A usable public review application, not an activated payment marketplace. The original domain is not replaced. No live charge, payout, seller verification, or invented market rate is enabled.

Public routes: `/`, `/search`, `/channel/[id]`, `/market`, `/campaigns`, `/rate-studio`, `/workspace`, `/launch`, `/account`. The existing `/deal-demo` and authenticated order collaboration paths remain for regression compatibility.

`/workspace` records user-entered campaigns and conditions in this browser. It supports four ad types, counteroffers, independent two-role acceptance of the latest version, immutable-in-workflow contract snapshots, mock payment choices, revision limits, disclosure-confirmed review, publication/evidence links, settlement preparation, messages, disputes, and JSON backup/restore. The role selector is a simulation, not authentication. No private or confidential data should be entered in the public review workflow. A content hash is not an electronic signature. Local files can be rewritten by their owner; they are not trusted financial evidence.

`/workspace/connected` is the external-account server sandbox. Its client does not submit authoritative actor IDs, payment totals or role overrides. PostgreSQL transactions lock projects, check party scope, compare revisions and append commands/contracts atomically. The immutable database trigger prevents rewriting prior command history. There is no live payout command.

## Configuration versus verification

`/api/release-status` returns non-secret configuration flags and `externalVerification=NOT_ATTESTED`. A configured adapter is not evidence of a successful live integration. Public review deployments deliberately leave external account and payment flags off.

Optional Google identity configuration uses `ENABLE_GOOGLE_LOGIN`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, reviewed `TERMS_VERSION`/`PRIVACY_VERSION`, `LEGAL_REVIEW_CONFIRMED`, `DATABASE_URL`, canonical HTTPS `APP_ORIGIN`, and a real `SESSION_HASH_PEPPER` of at least 32 characters. The registered callback must be exactly `${APP_ORIGIN}/api/auth/google/callback`. Client secrets belong only in the host secret manager.

The login adapter implements OIDC ID-token signature/issuer/audience/nonce checks, PKCE, a short-lived encrypted host-only HttpOnly flow cookie, database-backed single-use state, subject-based identity mapping and existing opaque sessions. Verified-email collisions require deliberate account linking rather than automatic takeover. Self-registering as a creator does not verify the YouTube channel or seller.

After database migrations, `ENABLE_CONNECTED_WORKSPACE=true` allows two registered external-provider accounts to use the sandbox server workspace. A creator shares their account ID from `/account`; this does not itself grant anyone access to orders. Do not enable this for live business until real multi-account, revoke, recovery, abuse, backup and monitoring tests are completed.

YouTube requires `ENABLE_YOUTUBE_LOOKUP=true`, `YOUTUBE_API_KEY`, `YOUTUBE_POLICY_REVIEW_CONFIRMED=true` and external login. It requests raw channel snippet/statistics from the fixed official endpoint, shows source/time, does not reconstruct hidden counts, does not persist API statistics, and does not generate estimated fees. Existing discovery data is explicitly archived, not live.

## Payment boundary

Payment method names in review workflows are mock choices only. The application does not collect card/bank data, open a PG payment window, claim escrow, transfer funds, or consider browser redirects as payment facts. The previously existing provider/ledger modules remain isolated. Contracting with a payment provider, seller checks, actual provider reconciliation, cancellation/refund paths and legal/tax/support/backup readiness must be separately completed before a live marketplace release.

## Quality evidence

Commit `00f7f69c8f449771a03c4201ab61453581211da3`: GitHub Actions run `33955081454` passed TypeScript, lint, 263 unit/integration cases, database checks including migration 0004, original sandbox order flow, Next production build, Playwright E2E, standalone rate calculator build/verification and the existing Sites target. Provider tests use mocked HTTP and locally signed tokens, not real Google/Toss accounts. Full-flow browser tests cover proposal/counteroffer/dual acceptance, contract hash/download, reload persistence, payment simulation, revision/review, publication, settlement block, file restoration and dispute lock on desktop/mobile. Remote hosting is a separate gate: a deployment creation receipt is not an accessible site.

## Commands

```sh
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test
pnpm db:check && pnpm sandbox:verify
pnpm build && pnpm test:e2e
pnpm build:rate-preview && pnpm verify:rate-preview
pnpm build:sites
```

Run migrations only against the intended environment after backup. The release adds migration 0004; no production user database has been migrated by this chat. Live flags remain off. Do not treat a passing UI test or configuration flag as operational approval.
