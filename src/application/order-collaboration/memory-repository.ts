import { randomUUID } from "node:crypto";

import { canTransitionOrder } from "../../domain/order-workflow";
import {
  createOrderMessagePageMetadata,
  normalizeOrderMessagePageRequest,
  type OrderMessageCursor,
} from "./message-pagination";
import {
  DeliverableVersionConflictError,
  DuplicateClientMessageError,
  IdempotencyConflictError,
  InvalidOrderCollaborationStateError,
  OrderCollaborationAccessError,
  OrderCollaborationNotFoundError,
  OrderRevisionLimitError,
  OrderVersionConflictError,
} from "./errors";
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
} from "./types";

export const ORDER_COLLABORATION_DEMO = Object.freeze({
  orderId: "10000000-0000-4000-8000-000000000001",
  orderNumber: "TBM-20260802-001",
  buyerUserId: "00000000-0000-4000-8000-00000000d001",
  creatorUserId: "00000000-0000-4000-8000-00000000d002",
  buyerOrganizationId: "10000000-0000-4000-8000-000000000004",
  deliverableId: "10000000-0000-4000-8000-000000000005",
  deliverableVersionId: "10000000-0000-4000-8000-000000000006",
});

export const ORDER_COLLABORATION_E2E_ORDER_NUMBERS = Object.freeze([
  "TBM-20260802-E2E-R0",
  "TBM-20260802-E2E-R1",
  "TBM-20260802-E2E-R2",
] as const);

export interface MemoryOrderCollaborationSeed {
  readonly scope: OrderAccessScope;
  readonly workspace: OrderWorkspace;
}

export interface MemoryCollaborationEvent {
  readonly type: "MESSAGE_SENT" | "REVISION_REQUESTED" | "DELIVERABLE_APPROVED";
  readonly orderId: string;
  readonly orderVersion: number;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
}

type StoredIdempotency = Readonly<{
  requestSha256: string;
  result: CollaborationMutationResult;
}>;

type Mutable<Value> = Value extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : Value extends object
    ? { -readonly [Key in keyof Value]: Mutable<Value[Key]> }
    : Value;

type MutableWorkspace = Mutable<OrderWorkspace>;

function snapshot(workspace: OrderWorkspace): MutableWorkspace {
  return structuredClone(workspace) as MutableWorkspace;
}

function isBeforeCursor(
  message: OrderWorkspace["messages"][number],
  cursor: OrderMessageCursor,
): boolean {
  return (
    message.createdAt < cursor.createdAt ||
    (message.createdAt === cursor.createdAt && message.id < cursor.id)
  );
}

function projectWorkspace(
  workspace: OrderWorkspace,
  request: OrderMessagePageRequest = {},
): MutableWorkspace {
  const page = normalizeOrderMessagePageRequest(request);
  const candidates = workspace.messages
    .filter((message) => page.before === null || isBeforeCursor(message, page.before));
  candidates.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
  );
  const hasMore = candidates.length > page.limit;
  const messages = candidates.slice(0, page.limit).reverse();
  const projected = snapshot(workspace);
  projected.messages = structuredClone(messages) as MutableWorkspace["messages"];
  projected.messagePage = createOrderMessagePageMetadata(
    page.limit,
    messages,
    hasMore,
  );
  return projected;
}

type DemoFixture = Readonly<{
  orderId: string;
  orderNumber: string;
  deliverableId: string;
  deliverableVersionId: string;
}>;

function demoSeed(fixture: DemoFixture = ORDER_COLLABORATION_DEMO): MemoryOrderCollaborationSeed {
  const submittedAt = "2026-08-02T00:00:00.000Z";
  return {
    scope: {
      orderId: fixture.orderId,
      orderNumber: fixture.orderNumber,
      buyerUserId: ORDER_COLLABORATION_DEMO.buyerUserId,
      buyerOrganizationId: ORDER_COLLABORATION_DEMO.buyerOrganizationId,
      creatorUserId: ORDER_COLLABORATION_DEMO.creatorUserId,
      status: "DRAFT_SUBMITTED",
      version: 1,
    },
    workspace: {
      order: {
        id: fixture.orderId,
        orderNumber: fixture.orderNumber,
        status: "DRAFT_SUBMITTED",
        version: 1,
        revisionCount: 0,
        revisionLimit: 2,
      },
      messages: [],
      messagePage: { limit: 100, returned: 0, hasMore: false, nextCursor: null },
      deliverables: [
        {
          id: fixture.deliverableId,
          type: "SHORTS_DRAFT",
          title: "1차 숏폼 시안",
          status: "SUBMITTED",
          currentVersion: 1,
          approvedAt: null,
          version: {
            id: fixture.deliverableVersionId,
            version: 1,
            status: "SUBMITTED",
            submissionNote: "검토용 1차 시안입니다.",
            feedback: null,
            revisionRequest: null,
            submittedAt,
            reviewedAt: null,
          },
        },
      ],
    },
  };
}

/** Explicit test/demo repository. Production wiring must never fall back to it. */
export class MemoryOrderCollaborationRepository
  implements OrderCollaborationRepository
{
  private readonly scopes = new Map<string, OrderAccessScope>();
  private readonly workspaces = new Map<string, MutableWorkspace>();
  private readonly idempotency = new Map<string, StoredIdempotency>();
  private readonly recordedEvents: MemoryCollaborationEvent[] = [];
  private queue: Promise<void> = Promise.resolve();

  constructor(seeds: readonly MemoryOrderCollaborationSeed[]) {
    for (const seed of seeds) {
      const workspace = snapshot(seed.workspace);
      const scope = structuredClone(seed.scope);
      this.scopes.set(scope.orderId, scope);
      this.scopes.set(scope.orderNumber, scope);
      this.workspaces.set(scope.orderId, workspace);
    }
  }

  static createLoopbackDemo(): MemoryOrderCollaborationRepository {
    const retryFixtures = ORDER_COLLABORATION_E2E_ORDER_NUMBERS.map(
      (orderNumber, index): DemoFixture => {
        const suffix = String((index + 1) * 10).padStart(12, "0");
        const deliverableSuffix = String((index + 1) * 10 + 1).padStart(12, "0");
        const versionSuffix = String((index + 1) * 10 + 2).padStart(12, "0");
        return {
          orderId: `10000000-0000-4000-8000-${suffix}`,
          orderNumber,
          deliverableId: `10000000-0000-4000-8000-${deliverableSuffix}`,
          deliverableVersionId: `10000000-0000-4000-8000-${versionSuffix}`,
        };
      },
    );
    return new MemoryOrderCollaborationRepository([
      demoSeed(),
      ...retryFixtures.map((fixture) => demoSeed(fixture)),
    ]);
  }

  get events(): readonly MemoryCollaborationEvent[] {
    return Object.freeze(structuredClone(this.recordedEvents));
  }

  async findAccessScope(orderLocator: string): Promise<OrderAccessScope | null> {
    const scope = this.scopes.get(orderLocator);
    if (scope === undefined) return null;
    const workspace = this.workspaces.get(scope.orderId);
    if (workspace === undefined) return null;
    return {
      ...scope,
      status: workspace.order.status,
      version: workspace.order.version,
    };
  }

  async getWorkspace(
    orderId: string,
    messagePage: OrderMessagePageRequest = {},
  ): Promise<Readonly<OrderWorkspace> | null> {
    const workspace = this.workspaces.get(orderId);
    return workspace === undefined ? null : projectWorkspace(workspace, messagePage);
  }

  sendMessage(
    orderId: string,
    input: SendOrderMessageInput,
    context: RepositoryMutationContext,
  ): Promise<CollaborationMutationResult> {
    return this.mutate(orderId, "send-message", context, (workspace, scope) => {
      this.assertParticipant(scope, context.actorUserId);
      this.assertVersion(workspace, input.expectedVersion);
      this.assertUniqueClientMessage(workspace, context.actorUserId, input.clientMessageId);
      if (
        input.replyToMessageId !== undefined &&
        !workspace.messages.some((message) => message.id === input.replyToMessageId)
      ) {
        throw new OrderCollaborationNotFoundError();
      }
      workspace.messages.push({
        id: randomUUID(),
        senderUserId: context.actorUserId,
        type: "TEXT",
        body: input.body,
        replyToMessageId: input.replyToMessageId ?? null,
        clientMessageId: input.clientMessageId,
        createdAt: context.occurredAt,
      });
      this.recordedEvents.push({
        type: "MESSAGE_SENT",
        orderId,
        orderVersion: workspace.order.version,
        idempotencyKey: context.idempotencyKey,
        occurredAt: context.occurredAt,
      });
    });
  }

  requestRevision(
    orderId: string,
    input: RequestOrderRevisionInput,
    context: RepositoryMutationContext,
  ): Promise<CollaborationMutationResult> {
    return this.mutate(orderId, "request-revision", context, (workspace, scope) => {
      this.assertBuyer(scope, context.actorUserId);
      this.assertVersion(workspace, input.expectedVersion);
      if (workspace.order.revisionCount >= workspace.order.revisionLimit) {
        throw new OrderRevisionLimitError();
      }
      if (!canTransitionOrder(workspace.order.status, "REVISION_REQUESTED")) {
        throw new InvalidOrderCollaborationStateError();
      }
      const deliverable = this.requireDeliverable(
        workspace,
        input.deliverableId,
        input.deliverableVersion,
      );
      if (
        deliverable.status !== "SUBMITTED" ||
        deliverable.version === null ||
        !["SUBMITTED", "UNDER_REVIEW"].includes(deliverable.version.status)
      ) {
        throw new InvalidOrderCollaborationStateError();
      }
      this.assertUniqueClientMessage(workspace, context.actorUserId, input.clientMessageId);
      deliverable.status = "REVISION_REQUESTED";
      deliverable.version.status = "REVISION_REQUESTED";
      deliverable.version.revisionRequest = input.reason;
      deliverable.version.reviewedAt = context.occurredAt;
      workspace.order.status = "REVISION_REQUESTED";
      workspace.order.version += 1;
      workspace.order.revisionCount += 1;
      workspace.messages.push({
        id: randomUUID(),
        senderUserId: context.actorUserId,
        type: "REVISION_REQUEST",
        body: input.reason,
        replyToMessageId: null,
        clientMessageId: input.clientMessageId,
        createdAt: context.occurredAt,
      });
      this.recordedEvents.push({
        type: "REVISION_REQUESTED",
        orderId,
        orderVersion: workspace.order.version,
        idempotencyKey: context.idempotencyKey,
        occurredAt: context.occurredAt,
      });
    });
  }

  approveDeliverable(
    orderId: string,
    input: ApproveOrderDeliverableInput,
    context: RepositoryMutationContext,
  ): Promise<CollaborationMutationResult> {
    return this.mutate(orderId, "approve-deliverable", context, (workspace, scope) => {
      this.assertBuyer(scope, context.actorUserId);
      this.assertVersion(workspace, input.expectedVersion);
      if (workspace.order.status !== "DRAFT_SUBMITTED") {
        throw new InvalidOrderCollaborationStateError();
      }
      const deliverable = this.requireDeliverable(
        workspace,
        input.deliverableId,
        input.deliverableVersion,
      );
      if (
        deliverable.status !== "SUBMITTED" ||
        deliverable.version === null ||
        !["SUBMITTED", "UNDER_REVIEW"].includes(deliverable.version.status)
      ) {
        throw new InvalidOrderCollaborationStateError();
      }
      this.assertUniqueClientMessage(workspace, context.actorUserId, input.clientMessageId);
      deliverable.status = "APPROVED";
      deliverable.approvedAt = context.occurredAt;
      deliverable.version.status = "APPROVED";
      deliverable.version.feedback = input.feedback ?? null;
      deliverable.version.reviewedAt = context.occurredAt;
      if (workspace.deliverables.every((item) => item.status === "APPROVED")) {
        workspace.order.status = "FINAL_APPROVAL_PENDING";
      }
      workspace.order.version += 1;
      workspace.messages.push({
        id: randomUUID(),
        senderUserId: context.actorUserId,
        type: "APPROVAL",
        body: input.feedback ?? "승인되었습니다.",
        replyToMessageId: null,
        clientMessageId: input.clientMessageId,
        createdAt: context.occurredAt,
      });
      this.recordedEvents.push({
        type: "DELIVERABLE_APPROVED",
        orderId,
        orderVersion: workspace.order.version,
        idempotencyKey: context.idempotencyKey,
        occurredAt: context.occurredAt,
      });
    });
  }

  private mutate(
    orderId: string,
    action: string,
    context: RepositoryMutationContext,
    mutation: (workspace: MutableWorkspace, scope: OrderAccessScope) => void,
  ): Promise<CollaborationMutationResult> {
    const operation = this.queue.then(() => {
      const key = `${orderId}:${action}:${context.idempotencyKey}`;
      const existing = this.idempotency.get(key);
      if (existing !== undefined) {
        if (existing.requestSha256 !== context.requestSha256) {
          throw new IdempotencyConflictError();
        }
        return { workspace: snapshot(existing.result.workspace), replayed: true };
      }
      const current = this.workspaces.get(orderId);
      const scope = this.scopes.get(orderId);
      if (current === undefined || scope === undefined) {
        throw new OrderCollaborationNotFoundError();
      }
      const candidate = snapshot(current);
      mutation(candidate, scope);
      this.workspaces.set(orderId, candidate);
      const result = { workspace: projectWorkspace(candidate), replayed: false } as const;
      this.idempotency.set(key, {
        requestSha256: context.requestSha256,
        result,
      });
      return result;
    });
    this.queue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private assertParticipant(scope: OrderAccessScope, actorUserId: string): void {
    if (actorUserId !== scope.buyerUserId && actorUserId !== scope.creatorUserId) {
      throw new OrderCollaborationAccessError();
    }
  }

  private assertBuyer(scope: OrderAccessScope, actorUserId: string): void {
    if (actorUserId !== scope.buyerUserId) throw new OrderCollaborationAccessError();
  }

  private assertVersion(workspace: OrderWorkspace, expectedVersion: number): void {
    if (workspace.order.version !== expectedVersion) throw new OrderVersionConflictError();
  }

  private assertUniqueClientMessage(
    workspace: MutableWorkspace,
    actorUserId: string,
    clientMessageId: string,
  ): void {
    if (
      workspace.messages.some(
        (message) =>
          message.senderUserId === actorUserId &&
          message.clientMessageId === clientMessageId,
      )
    ) {
      throw new DuplicateClientMessageError();
    }
  }

  private requireDeliverable(
    workspace: MutableWorkspace,
    deliverableId: string,
    expectedVersion: number,
  ): MutableWorkspace["deliverables"][number] {
    const deliverable = workspace.deliverables.find((item) => item.id === deliverableId);
    if (deliverable === undefined) throw new OrderCollaborationNotFoundError();
    if (deliverable.currentVersion !== expectedVersion) {
      throw new DeliverableVersionConflictError();
    }
    return deliverable;
  }
}
