-- PostgreSQL does not automatically index foreign-key columns. These additive
-- indexes protect joins, parent updates, and restricted/cascading deletes.
CREATE INDEX IF NOT EXISTS user_roles_granted_by_idx
  ON user_roles (granted_by_user_id);

CREATE INDEX IF NOT EXISTS organization_members_invited_by_idx
  ON organization_members (invited_by_user_id);

CREATE INDEX IF NOT EXISTS proposals_application_idx
  ON proposals (application_id);

CREATE INDEX IF NOT EXISTS proposals_created_by_idx
  ON proposals (created_by_user_id);

CREATE INDEX IF NOT EXISTS proposal_versions_supersedes_idx
  ON proposal_versions (supersedes_version_id);

CREATE INDEX IF NOT EXISTS contracts_superseded_by_idx
  ON contracts (superseded_by_contract_id);

CREATE INDEX IF NOT EXISTS fee_rules_approved_by_idx
  ON fee_rules (approved_by_user_id);

CREATE INDEX IF NOT EXISTS orders_package_idx
  ON orders (package_id);

CREATE INDEX IF NOT EXISTS orders_proposal_version_idx
  ON orders (proposal_version_id);

CREATE INDEX IF NOT EXISTS orders_fee_snapshot_idx
  ON orders (fee_snapshot_id);

CREATE INDEX IF NOT EXISTS orders_advertiser_profile_idx
  ON orders (advertiser_profile_id);

CREATE INDEX IF NOT EXISTS refunds_requested_by_idx
  ON refunds (requested_by_user_id);

CREATE INDEX IF NOT EXISTS payout_holds_placed_by_idx
  ON payout_holds (placed_by_user_id);

CREATE INDEX IF NOT EXISTS payout_holds_released_by_idx
  ON payout_holds (released_by_user_id);

CREATE INDEX IF NOT EXISTS ledger_transactions_created_by_idx
  ON ledger_transactions (created_by_user_id);

CREATE INDEX IF NOT EXISTS reconciliation_runs_resolved_by_idx
  ON reconciliation_runs (resolved_by_user_id);

CREATE INDEX IF NOT EXISTS dispute_evidence_attachment_idx
  ON dispute_evidence (attachment_id);

CREATE INDEX IF NOT EXISTS licenses_source_contract_version_idx
  ON licenses (source_contract_version_id);

CREATE INDEX IF NOT EXISTS license_renewals_proposal_version_idx
  ON license_renewals (proposal_version_id);

CREATE INDEX IF NOT EXISTS license_renewals_renewed_license_idx
  ON license_renewals (renewed_license_id);

CREATE INDEX IF NOT EXISTS review_reports_resolved_by_idx
  ON review_reports (resolved_by_user_id);

CREATE INDEX IF NOT EXISTS review_reports_reported_by_idx
  ON review_reports (reported_by_user_id);

CREATE INDEX IF NOT EXISTS review_appeals_decided_by_idx
  ON review_appeals (decided_by_user_id);

CREATE INDEX IF NOT EXISTS review_appeals_appealed_by_idx
  ON review_appeals (appealed_by_user_id);

CREATE INDEX IF NOT EXISTS reviews_author_idx
  ON reviews (author_user_id);

CREATE INDEX IF NOT EXISTS risk_flags_resolved_by_idx
  ON risk_flags (resolved_by_user_id);

CREATE INDEX IF NOT EXISTS moderation_cases_opened_by_idx
  ON moderation_cases (opened_by_user_id);

CREATE INDEX IF NOT EXISTS feature_flags_updated_by_idx
  ON feature_flags (updated_by_user_id);
