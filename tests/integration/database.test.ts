import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadMigrationFiles } from "../../src/lib/server/db/migrations";

const ids = {
  buyer: "00000000-0000-4000-8000-000000000001",
  creator: "00000000-0000-4000-8000-000000000002",
  channel: "00000000-0000-4000-8000-000000000010",
  creatorProfile: "00000000-0000-4000-8000-000000000011",
  advertiserProfile: "00000000-0000-4000-8000-000000000012",
  creatorPackage: "00000000-0000-4000-8000-000000000013",
  proposal: "00000000-0000-4000-8000-000000000014",
  proposalVersion: "00000000-0000-4000-8000-000000000015",
  contract: "00000000-0000-4000-8000-000000000016",
  contractVersion: "00000000-0000-4000-8000-000000000017",
  feeRule: "00000000-0000-4000-8000-000000000018",
  feeSnapshot: "00000000-0000-4000-8000-000000000019",
  order: "00000000-0000-4000-8000-000000000020",
  sellerVerification: "00000000-0000-4000-8000-000000000021",
  payoutAccount: "00000000-0000-4000-8000-000000000022",
  paymentIntent: "00000000-0000-4000-8000-000000000023",
} as const;

async function migrate(database: PGlite): Promise<void> {
  const migrations = await loadMigrationFiles();
  for (const migration of migrations) {
    await database.exec(migration.sql);
  }
}

async function seedOrderAuthorityFixture(database: PGlite): Promise<void> {
  await database.exec(`
    insert into users (id, email, display_name)
    values
      ('${ids.buyer}', 'buyer@example.invalid', 'Buyer'),
      ('${ids.creator}', 'creator@example.invalid', 'Creator');

    insert into youtube_channels (
      id, external_channel_id, title, source, source_updated_at, source_authorization
    ) values (
      '${ids.channel}', 'UC_TEST_CHANNEL', 'Test channel', 'legacy-import', now(), 'public-metadata'
    );

    insert into creator_profiles (
      id, user_id, youtube_channel_id, public_slug, marketplace_status, display_name
    ) values (
      '${ids.creatorProfile}', '${ids.creator}', '${ids.channel}', 'verified-creator', 'PAYOUT_READY', 'Verified Creator'
    );

    insert into advertiser_profiles (
      id, user_id, public_name, business_type, verification_status
    ) values (
      '${ids.advertiserProfile}', '${ids.buyer}', 'Test Advertiser', 'INDIVIDUAL', 'VERIFIED'
    );

    insert into creator_packages (
      id,
      creator_profile_id,
      public_slug,
      title,
      description,
      category,
      format,
      base_price_krw,
      production_days,
      cancellation_policy_version,
      status
    ) values (
      '${ids.creatorPackage}',
      '${ids.creatorProfile}',
      'integration-package',
      'Integration package',
      'A safe test package',
      'TECH',
      'SHORTS',
      1000000,
      7,
      'refund-draft-v1',
      'PUBLISHED'
    );

    insert into proposals (
      id,
      package_id,
      advertiser_profile_id,
      creator_profile_id,
      created_by_user_id,
      status,
      current_version,
      accepted_at
    ) values (
      '${ids.proposal}',
      '${ids.creatorPackage}',
      '${ids.advertiserProfile}',
      '${ids.creatorProfile}',
      '${ids.buyer}',
      'ACCEPTED',
      1,
      now()
    );

    insert into proposal_versions (
      id,
      proposal_id,
      version,
      created_by_user_id,
      cash_compensation_krw,
      product_value_krw,
      terms,
      canonical_sha256
    ) values (
      '${ids.proposalVersion}',
      '${ids.proposal}',
      1,
      '${ids.buyer}',
      1000000,
      0,
      '{"format":"SHORTS"}'::jsonb,
      'proposal-sha-256'
    );

    insert into contracts (
      id,
      proposal_id,
      advertiser_profile_id,
      creator_profile_id,
      status,
      current_version,
      executed_at
    ) values (
      '${ids.contract}',
      '${ids.proposal}',
      '${ids.advertiserProfile}',
      '${ids.creatorProfile}',
      'EXECUTED',
      1,
      now()
    );

    insert into contract_versions (
      id,
      contract_id,
      proposal_version_id,
      version,
      status,
      html_snapshot,
      canonical_json,
      canonical_sha256,
      terms_version,
      fee_rule_version,
      refund_policy_version,
      buyer_accepted_at,
      creator_accepted_at,
      executed_at
    ) values (
      '${ids.contractVersion}',
      '${ids.contract}',
      '${ids.proposalVersion}',
      1,
      'EXECUTED',
      '<p>Immutable contract</p>',
      '{"amountKrw":1000000}'::jsonb,
      'contract-sha-256',
      'marketplace-draft-v1',
      'MARKETPLACE_STANDARD:1',
      'refund-draft-v1',
      now(),
      now(),
      now()
    );

    insert into fee_rules (
      id,
      code,
      version,
      seller_fee_bps,
      buyer_fee_bps,
      minimum_order_krw,
      effective_from
    ) values (
      '${ids.feeRule}', 'MARKETPLACE_STANDARD', 1, 1200, 0, 100000, now()
    );

    insert into fee_snapshots (
      id,
      fee_rule_id,
      fee_rule_code,
      fee_rule_version,
      seller_fee_bps,
      buyer_fee_bps,
      gross_amount_krw,
      seller_fee_krw,
      buyer_fee_krw,
      snapshot_json,
      accepted_at
    ) values (
      '${ids.feeSnapshot}',
      '${ids.feeRule}',
      'MARKETPLACE_STANDARD',
      1,
      1200,
      0,
      1000000,
      120000,
      0,
      '{"sellerFeeBps":1200}'::jsonb,
      now()
    );

    insert into orders (
      id,
      order_number,
      package_id,
      proposal_version_id,
      contract_version_id,
      fee_snapshot_id,
      buyer_user_id,
      advertiser_profile_id,
      creator_profile_id,
      workflow_status,
      gross_amount_krw,
      buyer_total_krw,
      seller_fee_krw,
      seller_receivable_krw,
      revision_limit,
      brief_snapshot
    ) values (
      '${ids.order}',
      'TB-TEST-0001',
      '${ids.creatorPackage}',
      '${ids.proposalVersion}',
      '${ids.contractVersion}',
      '${ids.feeSnapshot}',
      '${ids.buyer}',
      '${ids.advertiserProfile}',
      '${ids.creatorProfile}',
      'BUYER_CONFIRMATION_PENDING',
      1000000,
      1000000,
      120000,
      880000,
      1,
      '{"summary":"test brief"}'::jsonb
    );

    insert into seller_verifications (
      id, creator_profile_id, provider, provider_seller_id, status, seller_type
    ) values (
      '${ids.sellerVerification}', '${ids.creatorProfile}', 'sandbox', 'seller-test', 'PENDING', 'INDIVIDUAL'
    );

    insert into payout_accounts (
      id,
      creator_profile_id,
      seller_verification_id,
      provider,
      provider_account_token,
      account_last4,
      status,
      is_default
    ) values (
      '${ids.payoutAccount}',
      '${ids.creatorProfile}',
      '${ids.sellerVerification}',
      'sandbox',
      'provider-token-test',
      '1234',
      'PENDING',
      false
    );

    insert into payment_intents (
      id,
      order_id,
      provider,
      provider_payment_key,
      merchant_reference,
      idempotency_key,
      status,
      amount_krw,
      funded_at
    ) values (
      '${ids.paymentIntent}',
      '${ids.order}',
      'sandbox',
      'payment-key-test',
      'TB-TEST-0001',
      'payment-intent-test',
      'FUNDED',
      1000000,
      now()
    );
  `);
}

describe.sequential("PostgreSQL marketplace authority schema", () => {
  const database = new PGlite();

  beforeAll(async () => {
    await migrate(database);
    await seedOrderAuthorityFixture(database);
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it("applies every migration and exposes the required authority tables", async () => {
    const result = await database.query<{ table_name: string }>(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'orders',
          'payment_intents',
          'payouts',
          'payout_holds',
          'disputes',
          'ledger_transactions',
          'ledger_entries',
          'webhook_events',
          'audit_logs'
        )
      order by table_name
    `);

    expect(result.rows.map((row) => row.table_name)).toEqual([
      "audit_logs",
      "disputes",
      "ledger_entries",
      "ledger_transactions",
      "orders",
      "payment_intents",
      "payout_holds",
      "payouts",
      "webhook_events",
    ]);
  });

  it("prevents duplicate channel claims and preserves legacy aliases uniquely", async () => {
    await expect(
      database.exec(`
        insert into creator_profiles (
          youtube_channel_id, public_slug, marketplace_status, display_name
        ) values (
          '${ids.channel}', 'duplicate-channel-owner', 'UNCLAIMED', 'Duplicate'
        )
      `),
    ).rejects.toThrow(/creator_profiles_channel_uidx|duplicate key/i);

    await database.exec(`
      insert into legacy_creator_aliases (
        creator_profile_id, alias_type, alias_value, source
      ) values (
        '${ids.creatorProfile}', 'LEGACY_ROUTE_ID', 'creator-legacy-1', 'legacy-site'
      )
    `);

    await expect(
      database.exec(`
        insert into legacy_creator_aliases (
          creator_profile_id, alias_type, alias_value, source
        ) values (
          '${ids.creatorProfile}', 'LEGACY_ROUTE_ID', 'creator-legacy-1', 'legacy-site'
        )
      `),
    ).rejects.toThrow(/legacy_creator_aliases_type_value_uidx|duplicate key/i);
  });

  it("deduplicates webhook and normalized provider events", async () => {
    await database.exec(`
      insert into webhook_events (
        provider, provider_event_id, event_type, payload_sha256, signature_verified
      ) values (
        'sandbox', 'evt-duplicate', 'payment.funded', 'webhook-payload-hash', true
      );

      insert into payment_events (
        payment_intent_id,
        provider,
        provider_event_id,
        event_type,
        normalized_status,
        payload_sha256,
        occurred_at
      ) values (
        '${ids.paymentIntent}',
        'sandbox',
        'payment-event-duplicate',
        'payment.funded',
        'FUNDED',
        'payment-payload-hash',
        now()
      );
    `);

    await expect(
      database.exec(`
        insert into webhook_events (
          provider, provider_event_id, event_type, payload_sha256, signature_verified
        ) values (
          'sandbox', 'evt-duplicate', 'payment.funded', 'webhook-payload-hash', true
        )
      `),
    ).rejects.toThrow(/webhook_events_provider_event_uidx|duplicate key/i);

    await expect(
      database.exec(`
        insert into payment_events (
          payment_intent_id,
          provider,
          provider_event_id,
          event_type,
          normalized_status,
          payload_sha256,
          occurred_at
        ) values (
          '${ids.paymentIntent}',
          'sandbox',
          'payment-event-duplicate',
          'payment.funded',
          'FUNDED',
          'payment-payload-hash',
          now()
        )
      `),
    ).rejects.toThrow(/payment_events_provider_event_uidx|duplicate key/i);
  });

  it("permits only one provider-active payment intent per order", async () => {
    await expect(
      database.exec(`
        insert into payment_intents (
          order_id,
          provider,
          merchant_reference,
          idempotency_key,
          status,
          amount_krw
        ) values (
          '${ids.order}',
          'sandbox',
          'TB-TEST-0001-RETRY',
          'payment-intent-test-retry',
          'READY',
          1000000
        )
      `),
    ).rejects.toThrow(/payment_intents_one_active_per_order_uidx|duplicate key/i);
  });

  it("posts only balanced double-entry transactions and freezes posted rows", async () => {
    const debitAccount = "00000000-0000-4000-8000-000000000030";
    const creditAccount = "00000000-0000-4000-8000-000000000031";
    const transaction = "00000000-0000-4000-8000-000000000032";

    await database.exec(`
      insert into ledger_accounts (id, code, name, account_type, normal_balance)
      values
        ('${debitAccount}', 'TEST_PG_CLEARING', 'Test PG clearing', 'ASSET', 'DEBIT'),
        ('${creditAccount}', 'TEST_CUSTOMER_LIABILITY', 'Test customer liability', 'LIABILITY', 'CREDIT');

      insert into ledger_transactions (
        id, reference_type, reference_id, order_id, description, idempotency_key, effective_at
      ) values (
        '${transaction}', 'PAYMENT', '${ids.paymentIntent}', '${ids.order}', 'Fund order', 'ledger-fund-order', now()
      );

      insert into ledger_entries (
        transaction_id, line_number, account_id, debit_krw, credit_krw
      ) values
        ('${transaction}', 1, '${debitAccount}', 1000000, 0),
        ('${transaction}', 2, '${creditAccount}', 0, 900000);
    `);

    await expect(
      database.exec(`update ledger_transactions set status = 'POSTED' where id = '${transaction}'`),
    ).rejects.toThrow(/must balance debits and credits/i);

    await database.exec(`
      update ledger_entries
         set credit_krw = 1000000
       where transaction_id = '${transaction}' and line_number = 2;
      update ledger_transactions set status = 'POSTED' where id = '${transaction}';
    `);

    const posted = await database.query<{ status: string; posted_at: Date | string }>(
      "select status, posted_at from ledger_transactions where id = $1",
      [transaction],
    );
    expect(posted.rows[0]?.status).toBe("POSTED");
    expect(posted.rows[0]?.posted_at).toBeTruthy();

    await expect(
      database.exec(`update ledger_entries set memo = 'tampered' where transaction_id = '${transaction}'`),
    ).rejects.toThrow(/immutable/i);
    await expect(
      database.exec(`update ledger_transactions set description = 'tampered' where id = '${transaction}'`),
    ).rejects.toThrow(/immutable/i);
  });

  it("blocks payout until verification, dispute, and hold authorities all permit it", async () => {
    const payout = "00000000-0000-4000-8000-000000000040";
    const dispute = "00000000-0000-4000-8000-000000000041";

    await expect(
      database.exec(`
        insert into payouts (
          id,
          order_id,
          creator_profile_id,
          payout_account_id,
          provider,
          idempotency_key,
          status,
          amount_krw
        ) values (
          '${payout}',
          '${ids.order}',
          '${ids.creatorProfile}',
          '${ids.payoutAccount}',
          'sandbox',
          'payout-order-test',
          'READY',
          880000
        )
      `),
    ).rejects.toThrow(/verified seller and payout account are required/i);

    await database.exec(`
      update seller_verifications
         set status = 'VERIFIED', verified_at = now()
       where id = '${ids.sellerVerification}';
      update payout_accounts
         set status = 'VERIFIED', is_default = true
       where id = '${ids.payoutAccount}';

      insert into disputes (
        id, order_id, opened_by_user_id, reason_code, description
      ) values (
        '${dispute}', '${ids.order}', '${ids.buyer}', 'BRIEF_MISMATCH', 'Structured dispute evidence pending'
      );
    `);

    const holds = await database.query<{ count: number }>(
      "select count(*)::int as count from payout_holds where order_id = $1 and status = 'ACTIVE'",
      [ids.order],
    );
    expect(holds.rows[0]?.count).toBe(1);

    await expect(
      database.exec(`
        insert into payouts (
          id,
          order_id,
          creator_profile_id,
          payout_account_id,
          provider,
          idempotency_key,
          status,
          amount_krw
        ) values (
          '${payout}',
          '${ids.order}',
          '${ids.creatorProfile}',
          '${ids.payoutAccount}',
          'sandbox',
          'payout-order-test',
          'READY',
          880000
        )
      `),
    ).rejects.toThrow(/active dispute blocks payout/i);

    await database.exec(`
      update disputes set status = 'RESOLVED', resolved_at = now() where id = '${dispute}';
      update payout_holds
         set status = 'RELEASED', released_at = now(), release_reason = 'Decision recorded'
       where order_id = '${ids.order}' and status = 'ACTIVE';

      insert into payouts (
        id,
        order_id,
        creator_profile_id,
        payout_account_id,
        provider,
        idempotency_key,
        status,
        amount_krw
      ) values (
        '${payout}',
        '${ids.order}',
        '${ids.creatorProfile}',
        '${ids.payoutAccount}',
        'sandbox',
        'payout-order-test',
        'READY',
        880000
      );
      update payouts set status = 'PAID', paid_at = now() where id = '${payout}';
    `);

    const payoutResult = await database.query<{ status: string }>(
      "select status from payouts where id = $1",
      [payout],
    );
    expect(payoutResult.rows[0]?.status).toBe("PAID");

    await expect(
      database.exec(`update payouts set status = 'FAILED' where id = '${payout}'`),
    ).rejects.toThrow(/paid payouts are immutable/i);
    await expect(
      database.exec(`delete from payouts where id = '${payout}'`),
    ).rejects.toThrow(/payout records cannot be deleted|paid payouts are immutable/i);
  });

  it("rejects aggregate refunds above provider-funded amount", async () => {
    await database.exec(`
      insert into refunds (
        order_id,
        payment_intent_id,
        requested_by_user_id,
        idempotency_key,
        amount_krw,
        reason_code
      ) values (
        '${ids.order}',
        '${ids.paymentIntent}',
        '${ids.buyer}',
        'refund-part-one',
        700000,
        'PARTIAL_DISPUTE_RESOLUTION'
      )
    `);

    await expect(
      database.exec(`
        insert into refunds (
          order_id,
          payment_intent_id,
          requested_by_user_id,
          idempotency_key,
          amount_krw,
          reason_code
        ) values (
          '${ids.order}',
          '${ids.paymentIntent}',
          '${ids.buyer}',
          'refund-part-two',
          400000,
          'PARTIAL_DISPUTE_RESOLUTION'
        )
      `),
    ).rejects.toThrow(/aggregate refund amount exceeds payment amount/i);
  });

  it("keeps contract versions and audit evidence append-only", async () => {
    await expect(
      database.exec(`
        update contract_versions
           set html_snapshot = '<p>tampered</p>'
         where id = '${ids.contractVersion}'
      `),
    ).rejects.toThrow(/append-only/i);

    const auditId = "00000000-0000-4000-8000-000000000050";
    await database.exec(`
      insert into audit_logs (
        id, actor_user_id, action, target_type, target_id, reason, request_id, evidence_hash
      ) values (
        '${auditId}', '${ids.buyer}', 'ORDER_VIEWED', 'ORDER', '${ids.order}', 'Integration evidence', 'request-test', 'audit-hash'
      )
    `);

    await expect(
      database.exec(`update audit_logs set reason = 'tampered' where id = '${auditId}'`),
    ).rejects.toThrow(/append-only/i);
  });
});
