import { fingerprintIdempotentRequest } from "../../domain/idempotency";
import type { AuthenticatedActor } from "../../lib/server/authorization";
import { OrderCollaborationNotFoundError } from "./errors";
import type {
  ApproveOrderDeliverableInput,
  CollaborationMutationResult,
  CollaborationRequestContext,
  OrderCollaborationAuthorization,
  OrderCollaborationRepository,
  OrderMessagePageRequest,
  OrderWorkspace,
  RequestOrderRevisionInput,
  ReviewOrderDeliverableInput,
  SendOrderMessageInput,
} from "./types";

export interface OrderCollaborationServiceOptions {
  readonly now?: () => Date;
}

export class OrderCollaborationService {
  private readonly now: () => Date;

  constructor(
    private readonly repository: OrderCollaborationRepository,
    private readonly authorization: OrderCollaborationAuthorization,
    options: OrderCollaborationServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async getWorkspace(
    actor: AuthenticatedActor,
    orderLocator: string,
    messagePage: OrderMessagePageRequest = {},
  ): Promise<Readonly<OrderWorkspace>> {
    const scope = await this.repository.findAccessScope(orderLocator);
    if (scope === null) throw new OrderCollaborationNotFoundError();
    await this.authorization.assertAuthorized(actor, "READ_WORKSPACE", scope);
    const workspace = await this.repository.getWorkspace(scope.orderId, messagePage);
    if (workspace === null) throw new OrderCollaborationNotFoundError();
    return workspace;
  }

  async sendMessage(
    actor: AuthenticatedActor,
    orderLocator: string,
    input: SendOrderMessageInput,
    request: CollaborationRequestContext,
  ): Promise<CollaborationMutationResult> {
    const scope = await this.requireScope(actor, orderLocator, "SEND_MESSAGE");
    const context = this.mutationContext(actor, request, orderLocator, input);
    return this.repository.sendMessage(scope.orderId, input, context);
  }

  async reviewDeliverable(
    actor: AuthenticatedActor,
    orderLocator: string,
    input: ReviewOrderDeliverableInput,
    request: CollaborationRequestContext,
  ): Promise<CollaborationMutationResult> {
    const scope = await this.requireScope(
      actor,
      orderLocator,
      "REVIEW_DELIVERABLE",
    );
    const context = this.mutationContext(actor, request, orderLocator, input);
    if (input.action === "REQUEST_REVISION") {
      return this.repository.requestRevision(scope.orderId, input, context);
    }
    return this.repository.approveDeliverable(scope.orderId, input, context);
  }

  private async requireScope(
    actor: AuthenticatedActor,
    orderLocator: string,
    action: "SEND_MESSAGE" | "REVIEW_DELIVERABLE",
  ) {
    const scope = await this.repository.findAccessScope(orderLocator);
    if (scope === null) throw new OrderCollaborationNotFoundError();
    await this.authorization.assertAuthorized(actor, action, scope);
    return scope;
  }

  private mutationContext(
    actor: AuthenticatedActor,
    request: CollaborationRequestContext,
    orderLocator: string,
    body: SendOrderMessageInput | RequestOrderRevisionInput | ApproveOrderDeliverableInput,
  ) {
    const occurredAt = this.now();
    if (!Number.isFinite(occurredAt.getTime())) throw new TypeError("clock is invalid");
    return Object.freeze({
      actorUserId: actor.userId,
      actorRole: actor.roles[0] ?? null,
      idempotencyKey: request.idempotencyKey,
      requestId: request.requestId,
      requestSha256: fingerprintIdempotentRequest({
        method: "POST",
        route: `/api/orders/${orderLocator}/collaboration`,
        principalId: actor.userId,
        body: { ...body },
      }),
      occurredAt: occurredAt.toISOString(),
    });
  }
}
