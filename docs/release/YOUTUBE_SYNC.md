# YouTube channel synchronization

## What is implemented

The production target is the existing Netlify site `tuberbot-review`. The two Node/TypeScript functions are `channel-data` (public read-through catalog at `/api/channel-data`) and `youtube-daily` (UTC cron `10 18 * * *`, daily 03:10 Asia/Seoul). A recent complete catalog is reused for six hours, including a scheduled invocation shortly after a page-driven refresh. Requests may only address curated IDs in `src/lib/creator-data.ts`; this is not an open search crawler or new-channel discovery service.

The Google adapter uses the fixed official `channels.list` endpoint, up to 50 IDs per request. It returns raw channel title, trusted YouTube thumbnail URL, publicly available subscriber count, view count, video count, and the actual retrieval timestamp. Decimal counters remain strings and are displayed through BigInt. Hidden or absent counters are null, never inferred zero. Missing IDs in a successful response become unavailable. Live counts are not passed to the separate campaign budget estimator.

A strongly consistent Netlify Blobs document stores the latest records, lease and daily reserved quota. Conditional writes use `onlyIfNew`/`onlyIfMatch` and an ETag; no process-local mutex is presented as distributed concurrency control. A 90-second lease, a maximum 200 reserved requests per UTC day, four workers, one retry per transient failure, and a 22-second network deadline limit work. Failures retain previous timestamps and use bounded backoff. Quota failure does not rotate credentials or projects. Invalid durable records are not silently overwritten.

Production uses a site-wide store across deploys. Non-production uses a deploy-specific store and does not call Google. After 29 days without renewal, cached API name, image and counters are removed on scheduled or page-driven cleanup, even if sync is disabled or the API key was removed. Expired records are also hidden on the frontend. API metrics are not written to browser localStorage; the pre-existing shortlist still stores only known public channel IDs.

## Activation boundary

At implementation time, `getAllEnvVars` for this Netlify site returned no environment variables. No user-owned Google API key has been created, obtained, guessed, or placed in source code. A missing key therefore yields `NOT_CONFIGURED` with null success timestamps. Passing mocked tests or seeing the schedule deployed is not a successful live YouTube API test.

The owner must enable YouTube Data API v3 in their Google Cloud project, create/restrict a server API key to that API, and add `YOUTUBE_API_KEY` as a secret in the Netlify site's production Functions environment. Do not put it in `NEXT_PUBLIC_*`, `VITE_*`, client code, logs, or this document. Redeploy after configuring the secret. `YOUTUBE_SYNC_ENABLED=false` explicitly disables API requests without disabling expiration cleanup. No channel-owner OAuth or Google login is required for this public-data catalog.

After activation, open `/#/data-status` and verify a non-null last successful refresh and source timestamps. Check Netlify function logs for categorical status only. The Netlify Scheduled Functions dashboard can run the scheduled function immediately; its scheduled endpoint is not a public control API. Manual Google key setup and the first real response remain unverified until actually performed.

## Frontend and operational verification

The static review target and Next development target preserve existing navigation, campaign budgets, shortlists and inquiry fields. A shared memory hook coalesces catalog requests and checks again every five minutes while visible. The server enforces the six-hour refresh window regardless of client behavior. The standalone Next fallback reports unconfigured rather than pretending to run the Netlify storage runtime.

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm db:check`, `pnpm sandbox:verify`, `pnpm build`, and `pnpm test:e2e`. Build the production UI with `pnpm exec vite build --config review/vite.config.ts`; then run `pnpm exec tsx scripts/verify-channel-sync-ui.mjs` against mocked raw API states. Use `PUBLIC_QA_LIVE=true` and the exact `REVIEW_SOURCE_REVISION` for a separate read-only public deployment check. Browser plugin is absent and this chat container cannot resolve external hosts, so live browser checks run in GitHub-hosted Playwright Chromium. No QA inquiries are submitted by this test.

The deployment bundle publishes only `public/`, with functions and their pinned dependencies outside the public directory. Deployment permission is a short-lived provider-scoped grant, encrypted to the current GitHub runner's ephemeral public key. Do not publish its plaintext or bypass the scope of that grant.

## Deliberate exclusions

No new-channel discovery, channel ownership verification, YouTube upload webhook, current-market ad-price prediction, billing, payouts, or inquiry-inbox repair is included. Existing archived discovery data remains explicitly separate from newly retrieved API data. A public UI or unit-test pass does not attest to live Google access or every legal requirement.

## Official implementation references

- https://developers.google.com/youtube/v3/docs/channels/list
- https://developers.google.com/youtube/terms/developer-policies
- https://docs.netlify.com/build/functions/scheduled-functions/
- https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- https://docs.netlify.com/build/functions/api/
