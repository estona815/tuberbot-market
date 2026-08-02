# TuberBot Market repository guidance

- Preserve the legacy creator discovery routes `/`, `/search`, and `/channel/[id]` during migration.
- Never enable live payments, payouts, regulated categories, public safe-payment claims, or estimated ad-rate/CPV flags without documented external approval.
- Store KRW as integer `bigint`; calculate fees in basis points; snapshot fee rules at contract acceptance.
- Treat contract versions, posted ledger entries, provider events, status events, and audit logs as append-only.
- Confirm payment and payout state from provider facts, never from browser redirects alone.
- Keep payment, payout, seller verification, storage, email, notification, and AI providers behind adapters.
- Never store raw bank account values, security keys, OAuth tokens, signed upload URLs, or webhook bodies in logs.
- All state-changing handlers require runtime validation, session authorization, CSRF/origin checks, idempotency, and audit evidence where applicable.
- A dispute, risk hold, seller-verification hold, chargeback, or reconciliation mismatch blocks payout dispatch.
- Use `apply_patch` for source edits, preserve user changes, and keep diffs reviewable.
- Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` before handoff when the runtime permits.
