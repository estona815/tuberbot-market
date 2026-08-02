import type { AuthenticatedActor } from "../../lib/server/authorization";
import type { OrderStatus } from "../../domain/order-workflow";

export type OrderCollaborationAction =
  | "READ_WORKSPACE"
  | "SEND_MESSAGE"
  | "REVIEW_DELIVERABLE";

export interface OrderAccessScope {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly buyerUserId: string;
  readonly buyerOrganizationId: string | null;
  readonly creatorUserId: string;
  readonly status: OrderStatus;
  readonly version: number;
}

export interface OrderWorkspaceMessage {
  readonly id: string;
  readonly senderUserId: string;
  readonly type:
    | "TEXT"
    | "SYSTEM"
    | "PROPOSAL"
    | "DELIVERABLE"
    | "REVISION_REQUEST"
    | "APPROVAL";
  readonly body: string | null;
  readonly replyToMessageId: string | null;
  readonly clientMessageId: string;
  readonly createdAt: string;
}

export interface OrderMessagePageRequest {
  readonly before?: string;
  readonly limit?: number;
}

export interface OrderMessagePageMetadata {
  readonly limit: number;
  readonly returned: number;
  readonly hasMore: boolean;
  /** Pass as the next request's `before` query parameter to load older messages. */
  readonly nextCursor: string | null;
}

export interface OrderDeliverableVersion {
  readonly id: string;
  readonly version: number;
  readonly status:
    | "SUBMITTED"
    | "UNDER_REVIEW"
    | "REVISION_REQUESTED"
    | "APPROVED"
    | "REJECTED";
  readonly submissionNote: string | null;
  readonly feedback: string | null;
  readonly revisionRequest: string | null;
  readonly submittedAt: string;
  readonly reviewedAt: string | null;
}

export interface OrderWorkspaceDeliverable {
  readonly id: string;
  readonly type:
    | "SCRIPT"
    | "STORYBOARD"
    | "THUMBNAIL"
    | "SHORTS_DRAFT"
    | "LONGFORM_DRAFT"
    | "FINAL_VIDEO"
    | "COMMUNITY_POST"
    | "PUBLICATION_URL"
    | "PERFORMANCE_REPORT";
  readonly title: string;
  readonly status:
    | "PENDING"
    | "SUBMITTED"
    | "REVISION_REQUESTED"
    | "APPROVED"
    | "REJECTED"
    | "CANCELED";
  readonly currentVersion: number;
  readonly approvedAt: string | null;
  readonly version: OrderDeliverableVersion | null;
}

export interface OrderWorkspace {
  readonly order: Readonly<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    version: number;
    revisionCount: number;
    revisionLimit: number;
  }>;
  readonly messages: readonly Readonly<OrderWorkspaceMessage>[];
  readonly messagePage: Readonly<OrderMessagePageMetadata>;
  readonly deliverables: readonly Readonly<OrderWorkspaceDeliverable>[];
}

export interface CollaborationMutationResult {
  readonly workspace: Readonly<OrderWorkspace>;
  readonly replayed: boolean;
}

export interface OrderCollaborationAuthorization {
  assertAuthorized(
    actor: AuthenticatedActor,
    action: OrderCollaborationAction,
    scope: OrderAccessScope,
  ): void | Promise<void>;
}

export interface CollaborationRequestContext {
  readonly idempotencyKey: string;
  readonly requestId: string;
}

export interface SendOrderMessageInput {
  readonly body: string;
  readonly clientMessageId: string;
  readonly expectedVersion: number;
  readonly replyToMessageId?: string;
}

export interface RequestOrderRevisionInput {
  readonly action: "REQUEST_REVISION";
  readonly expectedVersion: number;
  readonly deliverableId: string;
  readonly deliverableVersion: number;
  readonly reason: string;
  readonly clientMessageId: string;
}

export interface ApproveOrderDeliverableInput {
  readonly action: "APPROVE_DELIVERABLE";
  readonly expectedVersion: number;
  readonly deliverableId: string;
  readonly deliverableVersion: number;
  readonly feedback?: string;
  readonly clientMessageId: string;
}

export type ReviewOrderDeliverableInput =
  | RequestOrderRevisionInput
  | ApproveOrderDeliverableInput;

export interface RepositoryMutationContext extends CollaborationRequestContext {
  readonly actorUserId: string;
  readonly actorRole: string | null;
  readonly requestSha256: string;
  readonly occurredAt: string;
}

export interface OrderCollaborationRepository {
  findAccessScope(orderLocator: string): Promise<OrderAccessScope | null>;
  getWorkspace(
    orderId: string,
    messagePage?: OrderMessagePageRequest,
  ): Promise<Readonly<OrderWorkspace> | null>;
  sendMessage(
    orderId: string,
    input: SendOrderMessageInput,
    context: RepositoryMutationContext,
  ): Promise<CollaborationMutationResult>;
  requestRevision(
    orderId: string,
    input: RequestOrderRevisionInput,
    context: RepositoryMutationContext,
  ): Promise<CollaborationMutationResult>;
  approveDeliverable(
    orderId: string,
    input: ApproveOrderDeliverableInput,
    context: RepositoryMutationContext,
  ): Promise<CollaborationMutationResult>;
}
