import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createOrderCollaborationAuthorization,
  OrderCollaborationService,
} from "../../src/application/order-collaboration";
import type { AuthenticatedActor } from "../../src/lib/server/authorization";
import { loadMigrationFiles } from "../../src/lib/server/db/migrations";
import {
  PostgresOrderCollaborationRepository,
  type OrderSqlExecutor,
  type OrderTransactionalDatabase,
} from "../../src/lib/server/repositories/order-collaboration-repository";

const ids = {
  buyer: "20000000-0000-4000-8000-000000000001",
  creator: "20000000-0000-4000-8000-000000000002",
  channel: "20000000-0000-4000-8000-000000000010",
  creatorProfile: "20000000-0000-4000-8000-000000000011",
  advertiserProfile: "20000000-0000-4000-8000-000000000012",
  creatorPackage: "20000000-0000-4000-8000-000000000013",
  proposal: "20000000-0000-4000-8000-000000000014",
  proposalVersion: "20000000-0000-4000-8000-000000000015",
  contract: "20000000-0000-4000-8000-000000000016",
  contractVersion: "20000000-0000-4000-8000-000000000017",
  feeRule: "20000000-0000-4000-8000-000000000018",
  feeSnapshot: "20000000-0000-4000-8000-000000000019",
  order: "20000000-0000-4000-8000-000000000020",
  deliverable: "20000000-0000-4000-8000-000000000021",
  deliverableVersion1: "20000000-0000-4000-8000-000000000022",
  deliverableVersion2: "20000000-0000-4000-8000-000000000023",
} as const;

const buyer: AuthenticatedActor = {
  userId: ids.buyer,
  roles: ["ADVERTISER"],
  organizationIds: [],
  mfaVerified: false,
  sessionId: "integration-buyer-session",
};

interface Queryable {
  query<Row extends Record<string, unknown>>(
    statement: string,
    parameters?: unknown[],
  ): Promise<Readonly<{ rows: Row[]; affectedRows?: number }>>;
}

function executor(queryable: Queryable): OrderSqlExecutor {
  return {
    async query<Row extends Record<string, unknown>>(
      statement: string,
      parameters: readonly unknown[] = [],
    ) {
      return queryable.query<Row>(statement, [...parameters]);
    },
  };
}

function databaseAdapter(database: PGlite): OrderTransactionalDatabase {
  return {
    ...executor(database),
    transaction<Result>(
      callback: (transaction: OrderSqlExecutor) => Promise<Result>,
    ): Promise<Result> {
      return database.transaction((transaction) =>
        callback(executor(transaction)),
      );
    },
  };
}

async function migrate(database: PGlite): Promise<void> {
  for (const migration of await loadMigrationFiles()) {
    await database.exec(migration.sql);
  }
}

async function seed(database: PGlite): Promise<void> {
  await database.exec(`
    insert into users (id, email, display_name)
    values
      ('${ids.buyer}', 'collaboration-buyer@example.invalid', 'Buyer'),
      ('${ids.creator}', 'collaboration-creator@example.invalid', 'Creator');

    insert into youtube_channels (
      id, external_channel_id, title, source, source_updated_at, source_authorization
    ) values (
      '${ids.channel}', 'UC_COLLABORATION', 'Collaboration channel',
      'legacy-import', now(), 'public-metadata'
    );

    insert into creator_profiles (
      id, user_id, youtube_channel_id, public_slug, marketplace_status, display_name
    ) values (
      '${ids.creatorProfile}', '${ids.creator}', '${ids.channel}',
      'collaboration-creator', 'PAYOUT_READY', 'Creator'
    );

    insert into advertiser_profiles (
      id, user_id, public_name, business_type, verification_status
    ) values (
      '${ids.advertiserProfile}', '${ids.buyer}', 'Advertiser', 'INDIVIDUAL', 'VERIFIED'
    );

    insert into creator_packages (
      id, creator_profile_id, public_slug, title, description, category, format,
      base_price_krw, production_days, cancellation_policy_version, status
    ) values (
      '${ids.creatorPackage}', '${ids.creatorProfile}', 'collaboration-package',
      'Collaboration package', 'Test package', 'TECH', 'SHORTS', 1000000, 7,
      'refund-draft-v1', 'PUBLISHED'
    );

    insert into proposals (
      id, package_id, advertiser_profile_id, creator_profile_id, created_by_user_id,
      status, current_version, accepted_at
    ) values (
      '${ids.proposal}', '${ids.creatorPackage}', '${ids.advertiserProfile}',
      '${ids.creatorProfile}', '${ids.buyer}', 'ACCEPTED', 1, now()
    );

    insert into proposal_versions (
      id, proposal_id, version, created_by_user_id, cash_compensation_krw,
      product_value_krw, terms, canonical_sha256
    ) values (
      '${ids.proposalVersion}', '${ids.proposal}', 1, '${ids.buyer}', 1000000, 0,
      '{"format":"SHORTS"}'::jsonb, 'collaboration-proposal-hash'
    );

    insert into contracts (
      id, proposal_id, advertiser_profile_id, creator_profile_id, status,
      current_version, executed_at
    ) values (
      '${ids.contract}', '${ids.proposal}', '${ids.advertiserProfile}',
      '${ids.creatorProfile}', 'EXECUTED', 1, now()
    );

    insert into contract_versions (
      id, contract_id, proposal_version_id, version, status, html_snapshot,
      canonical_json, canonical_sha256, terms_version, fee_rule_version,
      refund_policy_version, buyer_accepted_at, creator_accepted_at, executed_at
    ) values (
      '${ids.contractVersion}', '${ids.contract}', '${ids.proposalVersion}', 1,
      'EXECUTED', '<p>Contract</p>', '{"amountKrw":1000000}'::jsonb,
      'collaboration-contract-hash', 'marketplace-draft-v1',
      'MARKETPLACE_STANDARD:1', 'refund-draft-v1', now(), now(), now()
    );

    insert into fee_rules (
      id, code, version, seller_fee_bps, buyer_fee_bps, minimum_order_krw,
      effective_from
    ) values (
      '${ids.feeRule}', 'MARKETPLACE_STANDARD', 1, 1200, 0, 100000, now()
    );

    insert into fee_snapshots (
      id, fee_rule_id, fee_rule_code, fee_rule_version, seller_fee_bps,
      buyer_fee_bps, gross_amount_krw, seller_fee_krw, buyer_fee_krw,
      snapshot_json, accepted_at
    ) values (
      '${ids.feeSnapshot}', '${ids.feeRule}', 'MARKETPLACE_STANDARD', 1,
      1200, 0, 1000000, 120000, 0, '{"sellerFeeBps":1200}'::jsonb, now()
    );

    insert into orders (
      id, order_number, package_id, proposal_version_id, contract_version_id,
      fee_snapshot_id, buyer_user_id, advertiser_profile_id, creator_profile_id,
      workflow_status, gross_amount_krw, buyer_total_krw, seller_fee_krw,
      seller_receivable_krw, revision_limit, revision_count, brief_snapshot, version
    ) values (
      '${ids.order}', 'TBM-20260802-001', '${ids.creatorPackage}',
      '${ids.proposalVersion}', '${ids.contractVersion}', '${ids.feeSnapshot}',
      '${ids.buyer}', '${ids.advertiserProfile}', '${ids.creatorProfile}',
      'DRAFT_SUBMITTED', 1000000, 1000000, 120000, 880000, 1, 0,
      '{"summary":"collaboration fixture"}'::jsonb, 1
    );

    insert into deliverables (
      id, order_id, type, title, current_version, status, required
    ) values (
      '${ids.deliverable}', '${ids.order}', 'SHORTS_DRAFT', 'First draft',
      1, 'SUBMITTED', true
    );

    insert into deliverable_versions (
      id, deliverable_id, version, submitted_by_user_id, status, submission_note,
      submitted_at
    ) values (
      '${ids.deliverableVersion1}', '${ids.deliverable}', 1, '${ids.creator}',
      'SUBMITTED', 'First draft', '2026-08-02T00:00:00.000Z'
    );
  `);
}

describe.sequential("Postgres order collaboration repository", () => {
  const database = new PGlite();
  let service: OrderCollaborationService;

  beforeAll(async () => {
    await migrate(database);
    await seed(database);
    service = new OrderCollaborationService(
      new PostgresOrderCollaborationRepository(databaseAdapter(database)),
      createOrderCollaborationAuthorization((actor, _permission, scope) =>
        [scope.buyerUserId, scope.creatorUserId].includes(actor.userId),
      ),
      { now: () => new Date("2026-08-02T02:00:00.000Z") },
    );
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it("commits a message, audit, outbox, and replay record exactly once", async () => {
    const input = {
      body: "메시지를 확인했습니다.",
      clientMessageId: "integration-message-1",
      expectedVersion: 1,
    };
    const request = {
      idempotencyKey: "integration-message-idempotency",
      requestId: "integration-request-message",
    };

    const first = await service.sendMessage(buyer, ids.order, input, request);
    const replay = await service.sendMessage(buyer, ids.order, input, request);
    const counts = await database.query<{
      messages: number;
      audits: number;
      outbox: number;
      idempotency: number;
    }>(`
      select
        (select count(*)::int from messages) as messages,
        (select count(*)::int from audit_logs where action = 'ORDER_MESSAGE_SENT') as audits,
        (select count(*)::int from outbox_events where event_type = 'order.message.created') as outbox,
        (select count(*)::int from idempotency_keys where status = 'COMPLETED') as idempotency
    `);

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.workspace.messages).toHaveLength(1);
    expect(counts.rows[0]).toEqual({
      messages: 1,
      audits: 1,
      outbox: 1,
      idempotency: 1,
    });
  });

  it("atomically requests one revision and rolls back a stale retry", async () => {
    const input = {
      action: "REQUEST_REVISION" as const,
      expectedVersion: 1,
      deliverableId: ids.deliverable,
      deliverableVersion: 1,
      reason: "브랜드 로고 노출 시간을 늘려 주세요.",
      clientMessageId: "integration-revision-1",
    };
    const request = {
      idempotencyKey: "integration-revision-idempotency",
      requestId: "integration-request-revision",
    };

    const first = await service.reviewDeliverable(buyer, ids.order, input, request);
    const replay = await service.reviewDeliverable(buyer, ids.order, input, request);
    await expect(
      service.reviewDeliverable(buyer, ids.order, input, {
        idempotencyKey: "integration-stale-revision",
        requestId: "integration-request-stale",
      }),
    ).rejects.toMatchObject({ name: "OrderVersionConflictError" });

    const counts = await database.query<{
      statusEvents: number;
      revisionMessages: number;
      revisionOutbox: number;
      revisionAudits: number;
      revisionCount: number;
      idempotency: number;
    }>(`
      select
        (select count(*)::int from order_status_events where reason_code = 'BUYER_REQUESTED_REVISION') as "statusEvents",
        (select count(*)::int from messages where message_type = 'REVISION_REQUEST') as "revisionMessages",
        (select count(*)::int from outbox_events where event_type = 'order.revision.requested') as "revisionOutbox",
        (select count(*)::int from audit_logs where action = 'ORDER_REVISION_REQUESTED') as "revisionAudits",
        (select revision_count from orders where id = '${ids.order}') as "revisionCount",
        (select count(*)::int from idempotency_keys where status = 'COMPLETED') as idempotency
    `);

    expect(first).toMatchObject({
      replayed: false,
      workspace: {
        order: { status: "REVISION_REQUESTED", version: 2, revisionCount: 1 },
      },
    });
    expect(replay.replayed).toBe(true);
    expect(counts.rows[0]).toEqual({
      statusEvents: 1,
      revisionMessages: 1,
      revisionOutbox: 1,
      revisionAudits: 1,
      revisionCount: 1,
      idempotency: 2,
    });
  });

  it("approves the resubmitted required deliverable with an optimistic transition", async () => {
    await database.exec(`
      update orders
      set workflow_status = 'DRAFT_SUBMITTED', version = 3, updated_at = now()
      where id = '${ids.order}';

      update deliverables
      set current_version = 2, status = 'SUBMITTED', approved_at = null, updated_at = now()
      where id = '${ids.deliverable}';

      insert into deliverable_versions (
        id, deliverable_id, version, submitted_by_user_id, status, submission_note,
        submitted_at
      ) values (
        '${ids.deliverableVersion2}', '${ids.deliverable}', 2, '${ids.creator}',
        'SUBMITTED', 'Revised draft', '2026-08-02T03:00:00.000Z'
      );
    `);

    const approved = await service.reviewDeliverable(
      buyer,
      ids.order,
      {
        action: "APPROVE_DELIVERABLE",
        expectedVersion: 3,
        deliverableId: ids.deliverable,
        deliverableVersion: 2,
        feedback: "승인합니다.",
        clientMessageId: "integration-approval-1",
      },
      {
        idempotencyKey: "integration-approval-idempotency",
        requestId: "integration-request-approval",
      },
    );
    const counts = await database.query<{
      statusEvents: number;
      approvalMessages: number;
      approvalOutbox: number;
      approvalAudits: number;
    }>(`
      select
        (select count(*)::int from order_status_events where reason_code = 'REQUIRED_DELIVERABLES_APPROVED') as "statusEvents",
        (select count(*)::int from messages where message_type = 'APPROVAL') as "approvalMessages",
        (select count(*)::int from outbox_events where event_type = 'order.deliverable.approved') as "approvalOutbox",
        (select count(*)::int from audit_logs where action = 'ORDER_DELIVERABLE_APPROVED') as "approvalAudits"
    `);

    expect(approved).toMatchObject({
      replayed: false,
      workspace: {
        order: { status: "FINAL_APPROVAL_PENDING", version: 4 },
        deliverables: [
          {
            id: ids.deliverable,
            status: "APPROVED",
            currentVersion: 2,
            version: { version: 2, status: "APPROVED" },
          },
        ],
      },
    });
    expect(counts.rows[0]).toEqual({
      statusEvents: 1,
      approvalMessages: 1,
      approvalOutbox: 1,
      approvalAudits: 1,
    });
  });

  it("bounds SQL pages, mutation responses, and persisted idempotency JSON", async () => {
    await database.exec(`
      insert into messages (
        conversation_id, sender_user_id, body, message_type, client_message_id,
        created_at
      )
      select
        c.id,
        '${ids.buyer}',
        'bulk-message-' || series.value,
        'TEXT',
        'bulk-client-' || series.value,
        '2026-07-01T00:00:00.000Z'::timestamptz + series.value * interval '1 second'
      from conversations c
      cross join generate_series(1, 105) as series(value)
      where c.order_id = '${ids.order}' and c.kind = 'ORDER_ROOM';
    `);

    const recent = await service.getWorkspace(buyer, ids.order);
    expect(recent.messages).toHaveLength(100);
    expect(recent.messagePage).toMatchObject({
      limit: 100,
      returned: 100,
      hasMore: true,
    });
    expect(recent.messagePage.nextCursor).not.toBeNull();

    const older = await service.getWorkspace(buyer, ids.order, {
      before: recent.messagePage.nextCursor ?? undefined,
    });
    expect(older.messages.length).toBeGreaterThan(0);
    expect(
      new Set([
        ...recent.messages.map((message) => message.id),
        ...older.messages.map((message) => message.id),
      ]).size,
    ).toBe(recent.messages.length + older.messages.length);
    expect(older.messagePage.hasMore).toBe(false);

    const request = {
      idempotencyKey: "integration-bounded-message-idempotency",
      requestId: "integration-bounded-message-request",
    };
    const input = {
      body: "bounded SQL mutation",
      clientMessageId: "integration-bounded-message",
      expectedVersion: 4,
    };
    const mutation = await service.sendMessage(buyer, ids.order, input, request);
    const replay = await service.sendMessage(buyer, ids.order, input, request);
    const stored = await database.query<{
      messageCount: number;
      returned: number;
      hasMore: boolean;
    }>(`
      select
        jsonb_array_length(response_body -> 'messages') as "messageCount",
        (response_body -> 'messagePage' ->> 'returned')::int as returned,
        (response_body -> 'messagePage' ->> 'hasMore')::boolean as "hasMore"
      from idempotency_keys
      where key = 'integration-bounded-message-idempotency'
    `);

    expect(mutation.workspace.messages).toHaveLength(100);
    expect(mutation.workspace.messagePage.hasMore).toBe(true);
    expect(replay.replayed).toBe(true);
    expect(replay.workspace.messages).toHaveLength(100);
    expect(stored.rows[0]).toEqual({
      messageCount: 100,
      returned: 100,
      hasMore: true,
    });
  });
});
