-- Additive safety guards. This migration intentionally contains no DROP or data rewrite.
-- PostgreSQL stores timestamptz as UTC; migration/session output is pinned to UTC as well.
SET TIME ZONE 'UTC';

CREATE OR REPLACE FUNCTION tb_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = format('%I is append-only; %s is not permitted', TG_TABLE_NAME, TG_OP);
END;
$$;

CREATE TRIGGER proposal_versions_append_only
BEFORE UPDATE OR DELETE ON proposal_versions
FOR EACH ROW EXECUTE FUNCTION tb_reject_mutation();

CREATE TRIGGER proposal_acceptances_append_only
BEFORE UPDATE OR DELETE ON proposal_acceptances
FOR EACH ROW EXECUTE FUNCTION tb_reject_mutation();

CREATE TRIGGER contract_versions_append_only
BEFORE UPDATE OR DELETE ON contract_versions
FOR EACH ROW EXECUTE FUNCTION tb_reject_mutation();

CREATE TRIGGER contract_acceptances_append_only
BEFORE UPDATE OR DELETE ON contract_acceptances
FOR EACH ROW EXECUTE FUNCTION tb_reject_mutation();

CREATE TRIGGER fee_snapshots_append_only
BEFORE UPDATE OR DELETE ON fee_snapshots
FOR EACH ROW EXECUTE FUNCTION tb_reject_mutation();

CREATE TRIGGER fee_rules_append_only
BEFORE UPDATE OR DELETE ON fee_rules
FOR EACH ROW EXECUTE FUNCTION tb_reject_mutation();

CREATE TRIGGER order_status_events_append_only
BEFORE UPDATE OR DELETE ON order_status_events
FOR EACH ROW EXECUTE FUNCTION tb_reject_mutation();

CREATE TRIGGER payment_events_append_only
BEFORE UPDATE OR DELETE ON payment_events
FOR EACH ROW EXECUTE FUNCTION tb_reject_mutation();

CREATE TRIGGER payment_transactions_append_only
BEFORE UPDATE OR DELETE ON payment_transactions
FOR EACH ROW EXECUTE FUNCTION tb_reject_mutation();

CREATE TRIGGER payout_events_append_only
BEFORE UPDATE OR DELETE ON payout_events
FOR EACH ROW EXECUTE FUNCTION tb_reject_mutation();

CREATE TRIGGER dispute_evidence_append_only
BEFORE UPDATE OR DELETE ON dispute_evidence
FOR EACH ROW EXECUTE FUNCTION tb_reject_mutation();

CREATE TRIGGER dispute_decisions_append_only
BEFORE UPDATE OR DELETE ON dispute_decisions
FOR EACH ROW EXECUTE FUNCTION tb_reject_mutation();

CREATE TRIGGER terms_documents_append_only
BEFORE UPDATE OR DELETE ON terms_documents
FOR EACH ROW EXECUTE FUNCTION tb_reject_mutation();

CREATE TRIGGER consents_append_only
BEFORE UPDATE OR DELETE ON consents
FOR EACH ROW EXECUTE FUNCTION tb_reject_mutation();

CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION tb_reject_mutation();

CREATE TRIGGER legacy_creator_imports_append_only
BEFORE UPDATE OR DELETE ON legacy_creator_imports
FOR EACH ROW EXECUTE FUNCTION tb_reject_mutation();

CREATE OR REPLACE FUNCTION tb_guard_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'contracts cannot be deleted';
  END IF;

  IF OLD.status IN ('SUPERSEDED', 'VOIDED') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'terminal contracts are immutable';
  END IF;

  IF OLD.status = 'EXECUTED' THEN
    IF NEW.status <> 'SUPERSEDED'
      OR NEW.superseded_by_contract_id IS NULL
      OR NEW.id IS DISTINCT FROM OLD.id
      OR NEW.proposal_id IS DISTINCT FROM OLD.proposal_id
      OR NEW.advertiser_profile_id IS DISTINCT FROM OLD.advertiser_profile_id
      OR NEW.creator_profile_id IS DISTINCT FROM OLD.creator_profile_id
      OR NEW.current_version IS DISTINCT FROM OLD.current_version
      OR NEW.executed_at IS DISTINCT FROM OLD.executed_at
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'executed contracts are immutable except explicit supersession';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER contracts_immutable_after_execution
BEFORE UPDATE OR DELETE ON contracts
FOR EACH ROW EXECUTE FUNCTION tb_guard_contract();

CREATE OR REPLACE FUNCTION tb_guard_order_economics()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'orders cannot be deleted';
  END IF;

  IF OLD.workflow_status NOT IN ('DRAFT', 'NEGOTIATING', 'AWAITING_PARTY_ACCEPTANCE') THEN
    IF NEW.buyer_user_id IS DISTINCT FROM OLD.buyer_user_id
      OR NEW.buyer_organization_id IS DISTINCT FROM OLD.buyer_organization_id
      OR NEW.advertiser_profile_id IS DISTINCT FROM OLD.advertiser_profile_id
      OR NEW.creator_profile_id IS DISTINCT FROM OLD.creator_profile_id
      OR NEW.proposal_version_id IS DISTINCT FROM OLD.proposal_version_id
      OR NEW.contract_version_id IS DISTINCT FROM OLD.contract_version_id
      OR NEW.fee_snapshot_id IS DISTINCT FROM OLD.fee_snapshot_id
      OR NEW.currency IS DISTINCT FROM OLD.currency
      OR NEW.gross_amount_krw IS DISTINCT FROM OLD.gross_amount_krw
      OR NEW.buyer_fee_krw IS DISTINCT FROM OLD.buyer_fee_krw
      OR NEW.buyer_total_krw IS DISTINCT FROM OLD.buyer_total_krw
      OR NEW.seller_fee_krw IS DISTINCT FROM OLD.seller_fee_krw
      OR NEW.seller_tax_withholding_krw IS DISTINCT FROM OLD.seller_tax_withholding_krw
      OR NEW.seller_receivable_krw IS DISTINCT FROM OLD.seller_receivable_krw
      OR NEW.product_value_krw IS DISTINCT FROM OLD.product_value_krw
    THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'accepted order economics and parties are immutable';
    END IF;
  END IF;

  IF OLD.workflow_status IN ('COMPLETED', 'CANCELED', 'REFUNDED')
    AND NEW.workflow_status IS DISTINCT FROM OLD.workflow_status
  THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'terminal order workflow state is immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_economics_immutable_after_acceptance
BEFORE UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION tb_guard_order_economics();

CREATE OR REPLACE FUNCTION tb_guard_payment_intent_authority()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'payment intents cannot be deleted';
  END IF;

  IF OLD.status IN ('AUTHORIZED', 'FUNDED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGEBACK')
    AND (
      NEW.order_id IS DISTINCT FROM OLD.order_id
      OR NEW.provider IS DISTINCT FROM OLD.provider
      OR NEW.provider_payment_key IS DISTINCT FROM OLD.provider_payment_key
      OR NEW.merchant_reference IS DISTINCT FROM OLD.merchant_reference
      OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
      OR NEW.amount_krw IS DISTINCT FROM OLD.amount_krw
      OR NEW.currency IS DISTINCT FROM OLD.currency
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'provider-authorized payment identity and amount are immutable';
  END IF;

  IF NEW.provider_version < OLD.provider_version THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'payment provider version cannot move backwards';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_intents_authority_guard
BEFORE UPDATE OR DELETE ON payment_intents
FOR EACH ROW EXECUTE FUNCTION tb_guard_payment_intent_authority();

CREATE OR REPLACE FUNCTION tb_guard_ledger_transaction()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  entry_count bigint;
  debit_total numeric;
  credit_total numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'DRAFT' OR NEW.posted_at IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'ledger transactions must be inserted as DRAFT';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'POSTED' THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'posted ledger transactions cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'POSTED' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'posted ledger transactions are immutable';
  END IF;

  IF NEW.status = 'POSTED' THEN
    SELECT count(*), coalesce(sum(debit_krw), 0), coalesce(sum(credit_krw), 0)
      INTO entry_count, debit_total, credit_total
      FROM ledger_entries
     WHERE transaction_id = OLD.id;

    IF entry_count < 2 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'posted ledger transactions require at least two entries';
    END IF;
    IF debit_total <> credit_total THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'posted ledger transactions must balance debits and credits';
    END IF;
    IF NEW.posted_at IS NULL THEN
      NEW.posted_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER ledger_transactions_posting_guard
BEFORE INSERT OR UPDATE OR DELETE ON ledger_transactions
FOR EACH ROW EXECUTE FUNCTION tb_guard_ledger_transaction();

CREATE OR REPLACE FUNCTION tb_guard_ledger_entry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status ledger_transaction_status;
  target_transaction_id uuid;
BEGIN
  target_transaction_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.transaction_id ELSE NEW.transaction_id END;

  SELECT status
    INTO parent_status
    FROM ledger_transactions
   WHERE id = target_transaction_id
   FOR UPDATE;

  IF parent_status IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'ledger transaction does not exist';
  END IF;
  IF parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'entries of a posted ledger transaction are immutable';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.transaction_id IS DISTINCT FROM OLD.transaction_id THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'ledger entries cannot move between transactions';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER ledger_entries_draft_only
BEFORE INSERT OR UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION tb_guard_ledger_entry();

CREATE OR REPLACE FUNCTION tb_guard_refund_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  funded_amount bigint;
  payment_order_id uuid;
  payment_state payment_status;
  other_refunds bigint;
BEGIN
  SELECT amount_krw, order_id, status
    INTO funded_amount, payment_order_id, payment_state
    FROM payment_intents
   WHERE id = NEW.payment_intent_id
   FOR UPDATE;

  IF payment_order_id IS NULL OR payment_order_id <> NEW.order_id THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'refund order must match its payment intent';
  END IF;

  IF NEW.status IN ('REQUESTED', 'PROCESSING', 'COMPLETED')
    AND payment_state NOT IN ('FUNDED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGEBACK')
  THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'refunds require provider-funded payment facts';
  END IF;

  SELECT coalesce(sum(amount_krw), 0)
    INTO other_refunds
    FROM refunds
   WHERE payment_intent_id = NEW.payment_intent_id
     AND status IN ('REQUESTED', 'PROCESSING', 'COMPLETED')
     AND id <> NEW.id;

  IF NEW.status IN ('REQUESTED', 'PROCESSING', 'COMPLETED')
    AND other_refunds + NEW.amount_krw > funded_amount
  THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'aggregate refund amount exceeds payment amount';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER refunds_cannot_exceed_payment
BEFORE INSERT OR UPDATE OF payment_intent_id, order_id, amount_krw, status ON refunds
FOR EACH ROW EXECUTE FUNCTION tb_guard_refund_total();

CREATE OR REPLACE FUNCTION tb_guard_refund_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'refund records cannot be deleted';
  END IF;

  IF OLD.status = 'COMPLETED' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'completed refunds are immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER refunds_terminal_guard
BEFORE UPDATE OR DELETE ON refunds
FOR EACH ROW EXECUTE FUNCTION tb_guard_refund_lifecycle();

CREATE OR REPLACE FUNCTION tb_guard_payout_dispatch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  order_creator_id uuid;
  seller_receivable bigint;
  payout_account_creator_id uuid;
  payout_account_status verification_status;
  seller_status verification_status;
  other_committed bigint;
  completed_refunds bigint;
  available_to_seller bigint;
BEGIN
  SELECT creator_profile_id, seller_receivable_krw
    INTO order_creator_id, seller_receivable
    FROM orders
   WHERE id = NEW.order_id
   FOR UPDATE;

  IF order_creator_id IS NULL OR order_creator_id <> NEW.creator_profile_id THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'payout creator must match the order seller';
  END IF;

  SELECT pa.creator_profile_id, pa.status, sv.status
    INTO payout_account_creator_id, payout_account_status, seller_status
    FROM payout_accounts pa
    JOIN seller_verifications sv ON sv.id = pa.seller_verification_id
   WHERE pa.id = NEW.payout_account_id;

  IF payout_account_creator_id IS NULL OR payout_account_creator_id <> NEW.creator_profile_id THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'payout account must belong to the order seller';
  END IF;

  SELECT coalesce(sum(amount_krw), 0)
    INTO other_committed
    FROM payouts
   WHERE order_id = NEW.order_id
     AND status IN ('SCHEDULED', 'PROCESSING', 'PAID')
     AND id <> NEW.id;

  SELECT coalesce(sum(amount_krw), 0)
    INTO completed_refunds
    FROM refunds
   WHERE order_id = NEW.order_id
     AND status = 'COMPLETED';

  available_to_seller := greatest(seller_receivable - completed_refunds, 0);

  IF other_committed + NEW.amount_krw > available_to_seller THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'payout exceeds seller receivable amount';
  END IF;

  IF NEW.status IN ('READY', 'SCHEDULED', 'PROCESSING', 'PAID') THEN
    IF payout_account_status <> 'VERIFIED' OR seller_status <> 'VERIFIED' THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'verified seller and payout account are required';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM payment_intents pi
       WHERE pi.order_id = NEW.order_id
         AND pi.status IN ('FUNDED', 'PARTIALLY_REFUNDED')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'funded provider payment is required before payout';
    END IF;

    IF EXISTS (
      SELECT 1 FROM disputes d
       WHERE d.order_id = NEW.order_id
         AND d.status IN ('OPEN', 'EVIDENCE_COLLECTION', 'UNDER_REVIEW', 'APPEALED')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'an active dispute blocks payout';
    END IF;

    IF EXISTS (
      SELECT 1 FROM payout_holds h
       WHERE h.order_id = NEW.order_id AND h.status = 'ACTIVE'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'an active payout hold blocks payout';
    END IF;

    IF EXISTS (
      SELECT 1 FROM refunds r
       WHERE r.order_id = NEW.order_id
         AND r.status IN ('REQUESTED', 'PROCESSING')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'a pending refund blocks payout';
    END IF;

    IF EXISTS (
      SELECT 1 FROM reconciliation_items ri
       WHERE ri.order_id = NEW.order_id
         AND ri.status IN ('MISSING_PROVIDER', 'MISSING_LEDGER', 'AMOUNT_MISMATCH', 'STATUS_MISMATCH')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'an unresolved reconciliation mismatch blocks payout';
    END IF;

    IF EXISTS (
      SELECT 1 FROM risk_flags rf
       WHERE rf.order_id = NEW.order_id
         AND rf.status IN ('OPEN', 'UNDER_REVIEW')
         AND rf.severity IN ('HIGH', 'CRITICAL')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'an unresolved high-risk flag blocks payout';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER payouts_authority_guard
BEFORE INSERT OR UPDATE OF order_id, creator_profile_id, payout_account_id, amount_krw, status ON payouts
FOR EACH ROW EXECUTE FUNCTION tb_guard_payout_dispatch();

CREATE OR REPLACE FUNCTION tb_guard_payout_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'payout records cannot be deleted';
  END IF;

  IF OLD.status = 'PAID' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'paid payouts are immutable';
  END IF;

  IF OLD.status = 'PROCESSING'
    AND (
      NEW.order_id IS DISTINCT FROM OLD.order_id
      OR NEW.creator_profile_id IS DISTINCT FROM OLD.creator_profile_id
      OR NEW.payout_account_id IS DISTINCT FROM OLD.payout_account_id
      OR NEW.provider IS DISTINCT FROM OLD.provider
      OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
      OR NEW.amount_krw IS DISTINCT FROM OLD.amount_krw
      OR NEW.currency IS DISTINCT FROM OLD.currency
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'processing payout identity and amount are immutable';
  END IF;

  IF NEW.provider_version < OLD.provider_version THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'payout provider version cannot move backwards';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER payouts_terminal_guard
BEFORE UPDATE OR DELETE ON payouts
FOR EACH ROW EXECUTE FUNCTION tb_guard_payout_lifecycle();

CREATE OR REPLACE FUNCTION tb_open_dispute_hold()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO payout_holds (order_id, dispute_id, hold_type, status, reason, placed_by_user_id)
  VALUES (NEW.order_id, NEW.id, 'DISPUTE', 'ACTIVE', 'Payout automatically held when dispute opened', NEW.opened_by_user_id)
  ON CONFLICT (order_id, hold_type) WHERE status = 'ACTIVE' DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER disputes_create_payout_hold
AFTER INSERT ON disputes
FOR EACH ROW EXECUTE FUNCTION tb_open_dispute_hold();

CREATE OR REPLACE FUNCTION tb_open_reconciliation_hold()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_id IS NOT NULL
    AND NEW.status IN ('MISSING_PROVIDER', 'MISSING_LEDGER', 'AMOUNT_MISMATCH', 'STATUS_MISMATCH')
  THEN
    INSERT INTO payout_holds (order_id, hold_type, status, reason)
    VALUES (NEW.order_id, 'RECONCILIATION', 'ACTIVE', 'Payout automatically held for reconciliation mismatch')
    ON CONFLICT (order_id, hold_type) WHERE status = 'ACTIVE' DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reconciliation_items_create_payout_hold
AFTER INSERT OR UPDATE OF status ON reconciliation_items
FOR EACH ROW EXECUTE FUNCTION tb_open_reconciliation_hold();

CREATE OR REPLACE FUNCTION tb_guard_review_eligibility()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  order_workflow_state order_status;
  buyer_id uuid;
  creator_user_id uuid;
BEGIN
  SELECT o.workflow_status, o.buyer_user_id, cp.user_id
    INTO order_workflow_state, buyer_id, creator_user_id
    FROM orders o
    JOIN creator_profiles cp ON cp.id = o.creator_profile_id
   WHERE o.id = NEW.order_id;

  IF order_workflow_state <> 'COMPLETED' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'reviews require a completed order';
  END IF;
  IF creator_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'unclaimed creators cannot participate in reviews';
  END IF;
  IF NOT (
    (NEW.author_user_id = buyer_id AND NEW.subject_user_id = creator_user_id AND NEW.direction = 'BUYER_TO_CREATOR')
    OR
    (NEW.author_user_id = creator_user_id AND NEW.subject_user_id = buyer_id AND NEW.direction = 'CREATOR_TO_BUYER')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'review author and subject must be order parties';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reviews_completed_order_parties_only
BEFORE INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION tb_guard_review_eligibility();

-- Explicitly document the intended privilege boundary for operators.
COMMENT ON TABLE ledger_entries IS 'Application role must not receive UPDATE or DELETE; trigger also protects posted entries.';
COMMENT ON TABLE audit_logs IS 'Append-only administrative and security evidence; never store secrets or raw provider bodies.';
COMMENT ON TABLE webhook_events IS 'Webhook inbox stores hashes and redacted payload only; raw signed bodies must not be logged.';
COMMENT ON COLUMN payout_accounts.provider_account_token IS 'Opaque provider token only; raw bank account numbers are forbidden.';
