import { canTransitionOrder, type OrderStatus } from "../../../domain/order-workflow";
import { sha256Hex } from "../../../domain/contracts";
import {
  DeliverableVersionConflictError,
  DuplicateClientMessageError,
  IdempotencyConflictError,
  IdempotencyInProgressError,
  InvalidOrderCollaborationStateError,
  OrderCollaborationAccessError,
  OrderCollaborationNotFoundError,
  OrderRevisionLimitError,
  OrderVersionConflictError,
} from "../../../application/order-collaboration/errors";
import { orderWorkspaceSchema } from "../../../application/order-collaboration/schemas";
import {
  createOrderMessagePageMetadata,
  normalizeOrderMessagePageRequest,
} from "../../../application/order-collaboration/message-pagination";
import type {
  ApproveOrderDeliverableInput,
  CollaborationMutationResult,
  OrderAccessScope,
  OrderCollaborationRepository,
  OrderMessagePageRequest,
  OrderWorkspace,
  RepositoryMutationContext,
  RequestOrderRevisionInput,
  SendOrderMessageInput,
} from "../../../application/order-collaboration/types";

export interface OrderSqlResult<Row extends Record<string, unknown>> {
  readonly rows: readonly Row[];
  readonly affectedRows?: number;
}

export interface OrderSqlExecutor {
  query<Row extends Record<string, unknown>>(
    statement: string,
    parameters?: readonly unknown[],
  ): Promise<OrderSqlResult<Row>>;
}

export interface OrderTransactionalDatabase extends OrderSqlExecutor {
  transaction<Result>(
    callback: (transaction: OrderSqlExecutor) => Promise<Result>,
  ): Promise<Result>;
}

type OrderRow = Readonly<{
  id: string;
  orderNumber: string;
  buyerUserId: string;
  buyerOrganizationId: string | null;
  creatorUserId: string;
  status: OrderStatus;
  version: number;
  revisionCount: number;
  revisionLimit: number;
}>;

type DeliverableLockRow = Readonly<{
  id: string;
  orderId: string;
  currentVersion: number;
  status: string;
  versionId: string;
  versionStatus: string;
}>;

type IdempotencyRow = Readonly<{
  requestSha256: string;
  status: string;
  responseBody: unknown;
}>;

const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1_000;
const IDEMPOTENCY_LOCK_MS = 5 * 60 * 1_000;

function requireSingle<Row extends Record<string, unknown>>(
  result: OrderSqlResult<Row>,
): Row | null {
  return result.rows[0] ?? null;
}

function isoTimestamp(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new TypeError("Database timestamp is invalid");
  return date.toISOString();
}

function optionalIsoTimestamp(value: unknown): string | null {
  return value === null || value === undefined ? null : isoTimestamp(value);
}

function integer(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new TypeError(`${field} is invalid`);
  return parsed;
}

function derivedKey(context: RepositoryMutationContext, suffix: string): string {
  return sha256Hex(
    `${context.requestSha256}:${context.idempotencyKey}:${suffix}`,
  );
}

function idempotencyScope(orderId: string, action: string): string {
  return `order-collaboration:${orderId}:${action}`;
}

function mapOrder(row: Record<string, unknown>): OrderRow {
  return {
    id: String(row.id),
    orderNumber: String(row.orderNumber),
    buyerUserId: String(row.buyerUserId),
    buyerOrganizationId:
      row.buyerOrganizationId === null ? null : String(row.buyerOrganizationId),
    creatorUserId: String(row.creatorUserId),
    status: row.status as OrderStatus,
    version: integer(row.version, "order.version"),
    revisionCount: integer(row.revisionCount, "order.revisionCount"),
    revisionLimit: integer(row.revisionLimit, "order.revisionLimit"),
  };
}

function assertParticipant(order: OrderRow, actorUserId: string): void {
  if (actorUserId !== order.buyerUserId && actorUserId !== order.creatorUserId) {
    throw new OrderCollaborationAccessError();
  }
}

function assertBuyer(order: OrderRow, actorUserId: string): void {
  if (actorUserId !== order.buyerUserId) throw new OrderCollaborationAccessError();
}

function assertExpectedVersion(order: OrderRow, expectedVersion: number): void {
  if (order.version !== expectedVersion) throw new OrderVersionConflictError();
}

export class PostgresOrderCollaborationRepository
  implements OrderCollaborationRepository
{
  constructor(private readonly database: OrderTransactionalDatabase) {}

  async findAccessScope(orderLocator: string): Promise<OrderAccessScope | null> {
    const row = requireSingle(
      await this.database.query<Record<string, unknown>>(
        `select
           o.id, o.order_number as "orderNumber", o.buyer_user_id as "buyerUserId",
           o.buyer_organization_id as "buyerOrganizationId", cp.user_id as "creatorUserId",
           o.workflow_status as status, o.version,
           o.revision_count as "revisionCount", o.revision_limit as "revisionLimit"
         from orders o
         join creator_profiles cp on cp.id = o.creator_profile_id
         where (o.id::text = $1 or o.order_number = $1)
           and cp.user_id is not null
         limit 1`,
        [orderLocator],
      ),
    );
    if (row === null) return null;
    const order = mapOrder(row);
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      buyerUserId: order.buyerUserId,
      buyerOrganizationId: order.buyerOrganizationId,
      creatorUserId: order.creatorUserId,
      status: order.status,
      version: order.version,
    };
  }

  getWorkspace(
    orderId: string,
    messagePage: OrderMessagePageRequest = {},
  ): Promise<Readonly<OrderWorkspace> | null> {
    return this.readWorkspace(this.database, orderId, messagePage);
  }

  async sendMessage(
    orderId: string,
    input: SendOrderMessageInput,
    context: RepositoryMutationContext,
  ): Promise<CollaborationMutationResult> {
    return this.withIdempotency(
      orderId,
      "send-message",
      context,
      async (transaction) => {
        const order = await this.lockOrder(transaction, orderId);
        assertParticipant(order, context.actorUserId);
        assertExpectedVersion(order, input.expectedVersion);
        const conversationId = await this.requireConversation(
          transaction,
          order,
          context.actorUserId,
          context.occurredAt,
        );
        await this.assertReplyBelongsToConversation(
          transaction,
          conversationId,
          input.replyToMessageId,
        );
        await this.insertMessage(transaction, {
          conversationId,
          senderUserId: context.actorUserId,
          body: input.body,
          messageType: "TEXT",
          replyToMessageId: input.replyToMessageId ?? null,
          clientMessageId: input.clientMessageId,
          occurredAt: context.occurredAt,
        });
        await this.touchConversation(transaction, conversationId, context.occurredAt);
        await this.appendOutbox(transaction, order, context, "order.message.created", {
          clientMessageId: input.clientMessageId,
          orderVersion: order.version,
        });
        await this.appendAudit(transaction, order, context, "ORDER_MESSAGE_SENT", {
          clientMessageId: input.clientMessageId,
          orderVersion: order.version,
        });
      },
    );
  }

  async requestRevision(
    orderId: string,
    input: RequestOrderRevisionInput,
    context: RepositoryMutationContext,
  ): Promise<CollaborationMutationResult> {
    return this.withIdempotency(
      orderId,
      "request-revision",
      context,
      async (transaction) => {
        const order = await this.lockOrder(transaction, orderId);
        assertBuyer(order, context.actorUserId);
        assertExpectedVersion(order, input.expectedVersion);
        if (order.revisionCount >= order.revisionLimit) throw new OrderRevisionLimitError();
        this.assertTransition(order.status, "REVISION_REQUESTED");
        const deliverable = await this.lockDeliverable(
          transaction,
          order.id,
          input.deliverableId,
          input.deliverableVersion,
        );
        if (
          deliverable.status !== "SUBMITTED" ||
          !["SUBMITTED", "UNDER_REVIEW"].includes(deliverable.versionStatus)
        ) {
          throw new InvalidOrderCollaborationStateError();
        }

        const nextVersion = order.version + 1;
        const update = await transaction.query<Record<string, unknown>>(
          `update orders
           set workflow_status = 'REVISION_REQUESTED', revision_count = revision_count + 1,
               version = version + 1, updated_at = $1
           where id = $2 and version = $3 and workflow_status = $4
           returning id`,
          [context.occurredAt, order.id, order.version, order.status],
        );
        if (update.rows.length !== 1) throw new OrderVersionConflictError();
        await transaction.query(
          `update deliverables
           set status = 'REVISION_REQUESTED', updated_at = $1
           where id = $2`,
          [context.occurredAt, deliverable.id],
        );
        await transaction.query(
          `update deliverable_versions
           set status = 'REVISION_REQUESTED', revision_request = $1,
               reviewed_by_user_id = $2, reviewed_at = $3
           where id = $4`,
          [input.reason, context.actorUserId, context.occurredAt, deliverable.versionId],
        );
        const conversationId = await this.requireConversation(
          transaction,
          order,
          context.actorUserId,
          context.occurredAt,
        );
        await this.insertMessage(transaction, {
          conversationId,
          senderUserId: context.actorUserId,
          body: input.reason,
          messageType: "REVISION_REQUEST",
          replyToMessageId: null,
          clientMessageId: input.clientMessageId,
          occurredAt: context.occurredAt,
        });
        await this.touchConversation(transaction, conversationId, context.occurredAt);
        await this.appendStatusEvent(
          transaction,
          order,
          "REVISION_REQUESTED",
          context,
          "BUYER_REQUESTED_REVISION",
          input.reason,
          nextVersion,
        );
        await this.appendOutbox(transaction, order, context, "order.revision.requested", {
          deliverableId: deliverable.id,
          deliverableVersion: input.deliverableVersion,
          orderVersion: nextVersion,
        });
        await this.appendAudit(transaction, order, context, "ORDER_REVISION_REQUESTED", {
          deliverableId: deliverable.id,
          deliverableVersion: input.deliverableVersion,
          fromStatus: order.status,
          orderVersion: nextVersion,
          toStatus: "REVISION_REQUESTED",
        });
      },
    );
  }

  async approveDeliverable(
    orderId: string,
    input: ApproveOrderDeliverableInput,
    context: RepositoryMutationContext,
  ): Promise<CollaborationMutationResult> {
    return this.withIdempotency(
      orderId,
      "approve-deliverable",
      context,
      async (transaction) => {
        const order = await this.lockOrder(transaction, orderId);
        assertBuyer(order, context.actorUserId);
        assertExpectedVersion(order, input.expectedVersion);
        if (order.status !== "DRAFT_SUBMITTED") {
          throw new InvalidOrderCollaborationStateError();
        }
        const deliverable = await this.lockDeliverable(
          transaction,
          order.id,
          input.deliverableId,
          input.deliverableVersion,
        );
        if (
          deliverable.status !== "SUBMITTED" ||
          !["SUBMITTED", "UNDER_REVIEW"].includes(deliverable.versionStatus)
        ) {
          throw new InvalidOrderCollaborationStateError();
        }

        await transaction.query(
          `update deliverables
           set status = 'APPROVED', approved_at = $1, updated_at = $1
           where id = $2`,
          [context.occurredAt, deliverable.id],
        );
        await transaction.query(
          `update deliverable_versions
           set status = 'APPROVED', feedback = $1, reviewed_by_user_id = $2, reviewed_at = $3
           where id = $4`,
          [input.feedback ?? null, context.actorUserId, context.occurredAt, deliverable.versionId],
        );
        const remaining = requireSingle(
          await transaction.query<Record<string, unknown>>(
            `select count(*)::int as count
             from deliverables
             where order_id = $1 and required = true and status <> 'APPROVED'`,
            [order.id],
          ),
        );
        if (remaining === null) throw new Error("Deliverable count failed");
        const allRequiredApproved = integer(remaining.count, "deliverable count") === 0;
        const nextStatus: OrderStatus = allRequiredApproved
          ? "FINAL_APPROVAL_PENDING"
          : order.status;
        if (nextStatus !== order.status) this.assertTransition(order.status, nextStatus);
        const nextVersion = order.version + 1;
        const update = await transaction.query<Record<string, unknown>>(
          `update orders
           set workflow_status = $1, version = version + 1, updated_at = $2
           where id = $3 and version = $4 and workflow_status = $5
           returning id`,
          [nextStatus, context.occurredAt, order.id, order.version, order.status],
        );
        if (update.rows.length !== 1) throw new OrderVersionConflictError();
        const conversationId = await this.requireConversation(
          transaction,
          order,
          context.actorUserId,
          context.occurredAt,
        );
        await this.insertMessage(transaction, {
          conversationId,
          senderUserId: context.actorUserId,
          body: input.feedback ?? "승인되었습니다.",
          messageType: "APPROVAL",
          replyToMessageId: null,
          clientMessageId: input.clientMessageId,
          occurredAt: context.occurredAt,
        });
        await this.touchConversation(transaction, conversationId, context.occurredAt);
        if (nextStatus !== order.status) {
          await this.appendStatusEvent(
            transaction,
            order,
            nextStatus,
            context,
            "REQUIRED_DELIVERABLES_APPROVED",
            input.feedback ?? null,
            nextVersion,
          );
        }
        await this.appendOutbox(transaction, order, context, "order.deliverable.approved", {
          deliverableId: deliverable.id,
          deliverableVersion: input.deliverableVersion,
          orderStatus: nextStatus,
          orderVersion: nextVersion,
        });
        await this.appendAudit(transaction, order, context, "ORDER_DELIVERABLE_APPROVED", {
          deliverableId: deliverable.id,
          deliverableVersion: input.deliverableVersion,
          fromStatus: order.status,
          orderVersion: nextVersion,
          toStatus: nextStatus,
        });
      },
    );
  }

  private async withIdempotency(
    orderId: string,
    action: string,
    context: RepositoryMutationContext,
    mutation: (transaction: OrderSqlExecutor) => Promise<void>,
  ): Promise<CollaborationMutationResult> {
    return this.database.transaction(async (transaction) => {
      const scope = idempotencyScope(orderId, action);
      const occurredAt = new Date(context.occurredAt);
      const lockedUntil = new Date(occurredAt.getTime() + IDEMPOTENCY_LOCK_MS).toISOString();
      const expiresAt = new Date(
        occurredAt.getTime() + IDEMPOTENCY_RETENTION_MS,
      ).toISOString();
      const inserted = await transaction.query<Record<string, unknown>>(
        `insert into idempotency_keys
           (scope, key, actor_user_id, request_sha256, status, locked_until, expires_at, created_at)
         values ($1, $2, $3, $4, 'IN_PROGRESS', $5, $6, $7)
         on conflict (scope, key) do nothing
         returning id`,
        [
          scope,
          context.idempotencyKey,
          context.actorUserId,
          context.requestSha256,
          lockedUntil,
          expiresAt,
          context.occurredAt,
        ],
      );
      if (inserted.rows.length === 0) {
        const existing = requireSingle(
          await transaction.query<Record<string, unknown>>(
            `select request_sha256 as "requestSha256", status,
                    response_body as "responseBody"
             from idempotency_keys
             where scope = $1 and key = $2
             for update`,
            [scope, context.idempotencyKey],
          ),
        ) as IdempotencyRow | null;
        if (existing === null) throw new IdempotencyInProgressError();
        if (existing.requestSha256 !== context.requestSha256) {
          throw new IdempotencyConflictError();
        }
        if (existing.status !== "COMPLETED") throw new IdempotencyInProgressError();
        const workspace = orderWorkspaceSchema.parse(existing.responseBody);
        return { workspace, replayed: true };
      }

      await mutation(transaction);
      const workspace = await this.readWorkspace(transaction, orderId);
      if (workspace === null) throw new OrderCollaborationNotFoundError();
      const completed = await transaction.query<Record<string, unknown>>(
        `update idempotency_keys
         set status = 'COMPLETED', response_status = 200, response_body = $1::jsonb,
             completed_at = $2, locked_until = null
         where scope = $3 and key = $4 and request_sha256 = $5 and status = 'IN_PROGRESS'
         returning id`,
        [
          JSON.stringify(workspace),
          context.occurredAt,
          scope,
          context.idempotencyKey,
          context.requestSha256,
        ],
      );
      if (completed.rows.length !== 1) throw new IdempotencyInProgressError();
      return { workspace, replayed: false };
    });
  }

  private async lockOrder(
    transaction: OrderSqlExecutor,
    orderId: string,
  ): Promise<OrderRow> {
    const row = requireSingle(
      await transaction.query<Record<string, unknown>>(
        `select
           o.id, o.order_number as "orderNumber", o.buyer_user_id as "buyerUserId",
           o.buyer_organization_id as "buyerOrganizationId", cp.user_id as "creatorUserId",
           o.workflow_status as status, o.version,
           o.revision_count as "revisionCount", o.revision_limit as "revisionLimit"
         from orders o
         join creator_profiles cp on cp.id = o.creator_profile_id
         where o.id = $1 and cp.user_id is not null
         for update of o`,
        [orderId],
      ),
    );
    if (row === null) throw new OrderCollaborationNotFoundError();
    return mapOrder(row);
  }

  private async lockDeliverable(
    transaction: OrderSqlExecutor,
    orderId: string,
    deliverableId: string,
    expectedVersion: number,
  ): Promise<DeliverableLockRow> {
    const row = requireSingle(
      await transaction.query<Record<string, unknown>>(
        `select d.id, d.order_id as "orderId", d.current_version as "currentVersion",
                d.status, dv.id as "versionId", dv.status as "versionStatus"
         from deliverables d
         join deliverable_versions dv
           on dv.deliverable_id = d.id and dv.version = d.current_version
         where d.id = $1 and d.order_id = $2
         for update of d, dv`,
        [deliverableId, orderId],
      ),
    );
    if (row === null) throw new OrderCollaborationNotFoundError();
    const mapped: DeliverableLockRow = {
      id: String(row.id),
      orderId: String(row.orderId),
      currentVersion: integer(row.currentVersion, "deliverable.currentVersion"),
      status: String(row.status),
      versionId: String(row.versionId),
      versionStatus: String(row.versionStatus),
    };
    if (mapped.currentVersion !== expectedVersion) {
      throw new DeliverableVersionConflictError();
    }
    return mapped;
  }

  private assertTransition(from: OrderStatus, to: OrderStatus): void {
    if (!canTransitionOrder(from, to)) throw new InvalidOrderCollaborationStateError();
  }

  private async requireConversation(
    transaction: OrderSqlExecutor,
    order: OrderRow,
    actorUserId: string,
    occurredAt: string,
  ): Promise<string> {
    const existing = requireSingle(
      await transaction.query<Record<string, unknown>>(
        `select id, status from conversations
         where order_id = $1 and kind = 'ORDER_ROOM'
         for update`,
        [order.id],
      ),
    );
    let conversationId: string;
    if (existing === null) {
      const inserted = requireSingle(
        await transaction.query<Record<string, unknown>>(
          `insert into conversations
             (order_id, kind, status, created_by_user_id, created_at, updated_at)
           values ($1, 'ORDER_ROOM', 'OPEN', $2, $3, $3)
           returning id`,
          [order.id, actorUserId, occurredAt],
        ),
      );
      if (inserted === null) throw new Error("Conversation creation failed");
      conversationId = String(inserted.id);
      await transaction.query(
        `insert into conversation_members (conversation_id, user_id, role, joined_at)
         values ($1, $2, 'BUYER', $4), ($1, $3, 'CREATOR', $4)
         on conflict (conversation_id, user_id) do nothing`,
        [conversationId, order.buyerUserId, order.creatorUserId, occurredAt],
      );
    } else {
      if (existing.status !== "OPEN") throw new InvalidOrderCollaborationStateError();
      conversationId = String(existing.id);
    }
    const member = requireSingle(
      await transaction.query<Record<string, unknown>>(
        `select 1 as present from conversation_members
         where conversation_id = $1 and user_id = $2 and left_at is null`,
        [conversationId, actorUserId],
      ),
    );
    if (member === null) throw new OrderCollaborationAccessError();
    return conversationId;
  }

  private async assertReplyBelongsToConversation(
    transaction: OrderSqlExecutor,
    conversationId: string,
    replyToMessageId: string | undefined,
  ): Promise<void> {
    if (replyToMessageId === undefined) return;
    const reply = requireSingle(
      await transaction.query<Record<string, unknown>>(
        `select 1 as present from messages
         where id = $1 and conversation_id = $2 and deleted_at is null`,
        [replyToMessageId, conversationId],
      ),
    );
    if (reply === null) throw new OrderCollaborationNotFoundError();
  }

  private async insertMessage(
    transaction: OrderSqlExecutor,
    message: Readonly<{
      conversationId: string;
      senderUserId: string;
      body: string;
      messageType: "TEXT" | "REVISION_REQUEST" | "APPROVAL";
      replyToMessageId: string | null;
      clientMessageId: string;
      occurredAt: string;
    }>,
  ): Promise<void> {
    const duplicate = requireSingle(
      await transaction.query<Record<string, unknown>>(
        `select 1 as present from messages
         where sender_user_id = $1 and client_message_id = $2`,
        [message.senderUserId, message.clientMessageId],
      ),
    );
    if (duplicate !== null) throw new DuplicateClientMessageError();
    await transaction.query(
      `insert into messages
         (conversation_id, sender_user_id, body, message_type, structured_payload,
          reply_to_message_id, client_message_id, created_at)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
      [
        message.conversationId,
        message.senderUserId,
        message.body,
        message.messageType,
        JSON.stringify({ schemaVersion: 1 }),
        message.replyToMessageId,
        message.clientMessageId,
        message.occurredAt,
      ],
    );
  }

  private async touchConversation(
    transaction: OrderSqlExecutor,
    conversationId: string,
    occurredAt: string,
  ): Promise<void> {
    await transaction.query(
      `update conversations set last_message_at = $1, updated_at = $1 where id = $2`,
      [occurredAt, conversationId],
    );
  }

  private async appendStatusEvent(
    transaction: OrderSqlExecutor,
    order: OrderRow,
    toStatus: OrderStatus,
    context: RepositoryMutationContext,
    reasonCode: string,
    reason: string | null,
    orderVersion: number,
  ): Promise<void> {
    await transaction.query(
      `insert into order_status_events
         (order_id, authority, from_status, to_status, actor_user_id, reason_code,
          reason, idempotency_key, occurred_at, event_metadata)
       values ($1, 'WORKFLOW', $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        order.id,
        order.status,
        toStatus,
        context.actorUserId,
        reasonCode,
        reason,
        derivedKey(context, "status-event"),
        context.occurredAt,
        JSON.stringify({ orderVersion, requestId: context.requestId, schemaVersion: 1 }),
      ],
    );
  }

  private async appendOutbox(
    transaction: OrderSqlExecutor,
    order: OrderRow,
    context: RepositoryMutationContext,
    eventType: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await transaction.query(
      `insert into outbox_events
         (aggregate_type, aggregate_id, event_type, payload, idempotency_key,
          status, available_at, created_at)
       values ('ORDER', $1, $2, $3::jsonb, $4, 'PENDING', $5, $5)`,
      [
        order.id,
        eventType,
        JSON.stringify({ ...payload, schemaVersion: 1 }),
        derivedKey(context, "outbox"),
        context.occurredAt,
      ],
    );
  }

  private async appendAudit(
    transaction: OrderSqlExecutor,
    order: OrderRow,
    context: RepositoryMutationContext,
    action: string,
    after: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await transaction.query(
      `insert into audit_logs
         (actor_user_id, actor_role, organization_id, action, target_type, target_id,
          request_id, idempotency_key, before_redacted, after_redacted, evidence_hash,
          occurred_at)
       values ($1, $2, $3, $4, 'ORDER', $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)`,
      [
        context.actorUserId,
        context.actorRole,
        order.buyerOrganizationId,
        action,
        order.id,
        context.requestId,
        derivedKey(context, "audit"),
        JSON.stringify({ orderStatus: order.status, orderVersion: order.version }),
        JSON.stringify(after),
        context.requestSha256,
        context.occurredAt,
      ],
    );
  }

  private async readWorkspace(
    executor: OrderSqlExecutor,
    orderId: string,
    messagePageRequest: OrderMessagePageRequest = {},
  ): Promise<Readonly<OrderWorkspace> | null> {
    const messagePage = normalizeOrderMessagePageRequest(messagePageRequest);
    const order = requireSingle(
      await executor.query<Record<string, unknown>>(
        `select id, order_number as "orderNumber", workflow_status as status,
                version, revision_count as "revisionCount", revision_limit as "revisionLimit"
         from orders where id = $1`,
        [orderId],
      ),
    );
    if (order === null) return null;
    const messageRows = (
      await executor.query<Record<string, unknown>>(
        `select m.id, m.sender_user_id as "senderUserId", m.message_type as type,
                m.body, m.reply_to_message_id as "replyToMessageId",
                m.client_message_id as "clientMessageId", m.created_at as "createdAt"
         from messages m
         join conversations c on c.id = m.conversation_id
         where c.order_id = $1 and c.kind = 'ORDER_ROOM' and m.deleted_at is null
           and ($2::timestamptz is null or (m.created_at, m.id) < ($2::timestamptz, $3::uuid))
         order by m.created_at desc, m.id desc
         limit $4`,
        [
          orderId,
          messagePage.before?.createdAt ?? null,
          messagePage.before?.id ?? null,
          messagePage.limit + 1,
        ],
      )
    ).rows;
    const deliverableRows = (
      await executor.query<Record<string, unknown>>(
        `select d.id, d.type, d.title, d.status, d.current_version as "currentVersion",
                d.approved_at as "approvedAt", dv.id as "versionId",
                dv.version as "deliverableVersion", dv.status as "versionStatus",
                dv.submission_note as "submissionNote", dv.feedback,
                dv.revision_request as "revisionRequest", dv.submitted_at as "submittedAt",
                dv.reviewed_at as "reviewedAt"
         from deliverables d
         left join deliverable_versions dv
           on dv.deliverable_id = d.id and dv.version = d.current_version
         where d.order_id = $1
         order by d.created_at asc, d.id asc`,
        [orderId],
      )
    ).rows;

    const hasMoreMessages = messageRows.length > messagePage.limit;
    const messages = messageRows
      .slice(0, messagePage.limit)
      .map((message) => ({
        id: String(message.id),
        senderUserId: String(message.senderUserId),
        type: message.type as OrderWorkspace["messages"][number]["type"],
        body: message.body === null ? null : String(message.body),
        replyToMessageId:
          message.replyToMessageId === null ? null : String(message.replyToMessageId),
        clientMessageId: String(message.clientMessageId),
        createdAt: isoTimestamp(message.createdAt),
      }))
      .reverse();

    return orderWorkspaceSchema.parse({
      order: {
        id: String(order.id),
        orderNumber: String(order.orderNumber),
        status: order.status,
        version: integer(order.version, "order.version"),
        revisionCount: integer(order.revisionCount, "order.revisionCount"),
        revisionLimit: integer(order.revisionLimit, "order.revisionLimit"),
      },
      messages,
      messagePage: createOrderMessagePageMetadata(
        messagePage.limit,
        messages,
        hasMoreMessages,
      ),
      deliverables: deliverableRows.map((deliverable) => ({
        id: String(deliverable.id),
        type: deliverable.type,
        title: String(deliverable.title),
        status: deliverable.status,
        currentVersion: integer(deliverable.currentVersion, "deliverable.currentVersion"),
        approvedAt: optionalIsoTimestamp(deliverable.approvedAt),
        version:
          deliverable.versionId === null
            ? null
            : {
                id: String(deliverable.versionId),
                version: integer(
                  deliverable.deliverableVersion,
                  "deliverable.version",
                ),
                status: deliverable.versionStatus,
                submissionNote:
                  deliverable.submissionNote === null
                    ? null
                    : String(deliverable.submissionNote),
                feedback:
                  deliverable.feedback === null ? null : String(deliverable.feedback),
                revisionRequest:
                  deliverable.revisionRequest === null
                    ? null
                    : String(deliverable.revisionRequest),
                submittedAt: isoTimestamp(deliverable.submittedAt),
                reviewedAt: optionalIsoTimestamp(deliverable.reviewedAt),
              },
      })),
    });
  }
}
