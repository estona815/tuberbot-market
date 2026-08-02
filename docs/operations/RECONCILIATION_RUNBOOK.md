# Reconciliation runbook

Owner: Finance; backup: Engineering/Risk. Frequency: daily after provider settlement data is available, plus on-demand after incident. The job never dispatches payout merely because totals match.

## Inputs

- provider payment/query and settlement facts by transaction/date
- provider cancellations/chargebacks, payout/balance facts
- internal payment/refund/payout status, posted ledger, order state, fee snapshot
- previous closing balance and unresolved reconciliation items

Provider reports/API output is stored in restricted immutable object storage with retrieval timestamp/hash; bank/account raw fields are excluded from operational logs.

## Automated checks

1. Create unique `reconciliation_run(provider, business_date, attempt)` and snapshot cut-off.
2. Match provider IDs/transaction keys before aggregate totals; detect missing, duplicate, amount/status/currency/date differences.
3. Compare funded, canceled/refunded, chargeback, payout paid, provider fee and closing balance to ledger equations in `docs/payment/LEDGER_DESIGN.md`.
4. Verify each posted transaction balances and every payout has seller verification plus no active hold.
5. Persist every discrepancy; never net unrelated orders to hide a difference.
6. If any money-affecting difference exists, create reconciliation hold for related order/seller/provider and alert Finance.

## Triage

| Class | Example | Action |
| --- | --- | --- |
| timing | provider fact after cut-off | requery with timestamp evidence; do not mark matched early |
| missing provider | internal FUNDED but provider absent | P0 payment integrity; block payout, canonical GET |
| missing internal | provider charge/refund absent internally | block payout, idempotently ingest/replay event |
| duplicate | two postings for one event | block, verify unique constraint; reversal only if approved |
| amount/status | partial cancel, fee, payout mismatch | block affected order/seller; Finance + Engineering |
| balance/global | closing clearing mismatch | block all provider payouts until scope known |

## Resolution

Assignee records root cause, provider evidence ID, affected orders/entries, approved remediation and reviewer. Never edit POSTED entries or provider events. Use idempotent replay, missing posting, or explicit reversal/replacement through domain service. Re-run the same business date; only a second reviewer may mark `RESOLVED/MATCHED` and release holds.

## Escalation and evidence

Any unauthorized payout, unknown funded payment, unbalanced ledger, or unresolved global difference is P0. Provider support ticket, run ID, hashes, queries, before/after totals, approvals and hold release go in incident/audit records. Do not paste secrets or raw account data.

## Drill

Monthly: duplicate and out-of-order webhook, one missing refund, one payout failure, one 1-KRW amount mismatch in sandbox. Expected result: discrepancy detected, payout blocked, no duplicate ledger/payout, audited release.
