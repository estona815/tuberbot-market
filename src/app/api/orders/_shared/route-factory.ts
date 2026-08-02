import { ZodError } from "zod";

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
  orderLocatorSchema,
  orderMessagePageRequestSchema,
  reviewOrderDeliverableSchema,
  sendOrderMessageSchema,
  type OrderCollaborationService,
} from "../../../../application/order-collaboration";
import {
  ApiRequestError,
  getRequestId,
  noStoreJson,
  parseBoundedJson,
  publicApiError,
} from "../../../../lib/server/api-envelope";
import type { AuthenticatedActor } from "../../../../lib/server/authorization";
import {
  requireIdempotencyHeader,
  requireSameOrigin,
  UnsafeRequestError,
} from "../../../../lib/server/request-security";

export interface OrderCollaborationRouteDependencies {
  readonly applicationOrigin: string;
  readonly authenticate: (request: Request) => Promise<AuthenticatedActor | null>;
  readonly verifyCsrf: (
    request: Request,
    actor: AuthenticatedActor,
  ) => Promise<boolean>;
  readonly getService: (request: Request) => OrderCollaborationService;
  readonly reportError?: (event: Readonly<{
    errorName: string;
    requestId: string;
    route: string;
  }>) => void;
}

export interface OrderRouteContext {
  readonly params: Promise<Readonly<{ id: string }>>;
}

export interface OrderCollaborationRouteHandlers {
  readonly workspace: (request: Request, context: OrderRouteContext) => Promise<Response>;
  readonly messages: (request: Request, context: OrderRouteContext) => Promise<Response>;
  readonly transitions: (request: Request, context: OrderRouteContext) => Promise<Response>;
}

class OrderRouteInputError extends Error {
  constructor() {
    super("Order route input is invalid");
    this.name = "OrderRouteInputError";
  }
}

function messagePageRequest(request: Request) {
  const query = new URL(request.url).searchParams;
  if (query.getAll("before").length > 1 || query.getAll("limit").length > 1) {
    throw new OrderRouteInputError();
  }
  const before = query.get("before") ?? undefined;
  const rawLimit = query.get("limit") ?? undefined;
  return parseOrderRouteInput(() =>
    orderMessagePageRequestSchema.parse({
      before,
      limit: rawLimit === undefined ? undefined : Number(rawLimit),
    }),
  );
}

function parseOrderRouteInput<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof ZodError) throw new OrderRouteInputError();
    throw error;
  }
}

function errorResponse(
  error: unknown,
  request: Request,
  requestId: string,
  dependencies: OrderCollaborationRouteDependencies,
): Response {
  if (error instanceof ApiRequestError) {
    return publicApiError(error.code, error.status, requestId);
  }
  if (error instanceof OrderRouteInputError) {
    return publicApiError("INVALID_REQUEST", 422, requestId);
  }
  if (error instanceof UnsafeRequestError) {
    return publicApiError("ORIGIN_OR_CSRF_REJECTED", 403, requestId);
  }
  if (
    error instanceof OrderCollaborationNotFoundError ||
    error instanceof OrderCollaborationAccessError
  ) {
    return publicApiError("ORDER_WORKSPACE_NOT_FOUND", 404, requestId);
  }
  if (error instanceof OrderVersionConflictError) {
    return publicApiError("ORDER_VERSION_CONFLICT", 409, requestId);
  }
  if (error instanceof DeliverableVersionConflictError) {
    return publicApiError("DELIVERABLE_VERSION_CONFLICT", 409, requestId);
  }
  if (error instanceof OrderRevisionLimitError) {
    return publicApiError("REVISION_LIMIT_REACHED", 409, requestId);
  }
  if (error instanceof IdempotencyConflictError) {
    return publicApiError("IDEMPOTENCY_CONFLICT", 409, requestId);
  }
  if (error instanceof IdempotencyInProgressError) {
    return publicApiError("IDEMPOTENCY_IN_PROGRESS", 409, requestId);
  }
  if (error instanceof DuplicateClientMessageError) {
    return publicApiError("CLIENT_MESSAGE_CONFLICT", 409, requestId);
  }
  if (error instanceof InvalidOrderCollaborationStateError) {
    return publicApiError("ORDER_STATE_CONFLICT", 409, requestId);
  }
  dependencies.reportError?.({
    errorName: error instanceof Error ? error.name : "UnknownError",
    requestId,
    route: new URL(request.url).pathname,
  });
  return publicApiError("INTERNAL_ERROR", 500, requestId);
}

async function authenticate(
  request: Request,
  requestId: string,
  dependencies: OrderCollaborationRouteDependencies,
): Promise<AuthenticatedActor | Response> {
  const actor = await dependencies.authenticate(request);
  return actor ?? publicApiError("UNAUTHENTICATED", 401, requestId);
}

async function requireMutationSecurity(
  request: Request,
  actor: AuthenticatedActor,
  dependencies: OrderCollaborationRouteDependencies,
): Promise<string> {
  requireSameOrigin(request, dependencies.applicationOrigin);
  if (
    !request.headers.has("x-csrf-token") ||
    !(await dependencies.verifyCsrf(request, actor))
  ) {
    throw new UnsafeRequestError("CSRF validation failed");
  }
  return requireIdempotencyHeader(request);
}

export function createOrderCollaborationRouteHandlers(
  dependencies: OrderCollaborationRouteDependencies,
): OrderCollaborationRouteHandlers {
  return {
    async workspace(request, context) {
      const requestId = getRequestId(request);
      try {
        const actor = await authenticate(request, requestId, dependencies);
        if (actor instanceof Response) return actor;
        const { id } = await context.params;
        const orderLocator = parseOrderRouteInput(() =>
          orderLocatorSchema.parse(id),
        );
        const workspace = await dependencies
          .getService(request)
          .getWorkspace(actor, orderLocator, messagePageRequest(request));
        return noStoreJson({ workspace, replayed: false }, { requestId });
      } catch (error) {
        return errorResponse(error, request, requestId, dependencies);
      }
    },

    async messages(request, context) {
      const requestId = getRequestId(request);
      try {
        const actor = await authenticate(request, requestId, dependencies);
        if (actor instanceof Response) return actor;
        const idempotencyKey = await requireMutationSecurity(
          request,
          actor,
          dependencies,
        );
        const { id } = await context.params;
        const orderLocator = parseOrderRouteInput(() =>
          orderLocatorSchema.parse(id),
        );
        const body = await parseBoundedJson(request);
        const input = parseOrderRouteInput(() => sendOrderMessageSchema.parse(body));
        const result = await dependencies.getService(request).sendMessage(
          actor,
          orderLocator,
          input,
          { idempotencyKey, requestId },
        );
        return noStoreJson(result, {
          requestId,
          headers: { "Idempotency-Replayed": String(result.replayed) },
        });
      } catch (error) {
        return errorResponse(error, request, requestId, dependencies);
      }
    },

    async transitions(request, context) {
      const requestId = getRequestId(request);
      try {
        const actor = await authenticate(request, requestId, dependencies);
        if (actor instanceof Response) return actor;
        const idempotencyKey = await requireMutationSecurity(
          request,
          actor,
          dependencies,
        );
        const { id } = await context.params;
        const orderLocator = parseOrderRouteInput(() =>
          orderLocatorSchema.parse(id),
        );
        const body = await parseBoundedJson(request);
        const input = parseOrderRouteInput(() =>
          reviewOrderDeliverableSchema.parse(body),
        );
        const result = await dependencies.getService(request).reviewDeliverable(
          actor,
          orderLocator,
          input,
          { idempotencyKey, requestId },
        );
        return noStoreJson(result, {
          requestId,
          headers: { "Idempotency-Replayed": String(result.replayed) },
        });
      } catch (error) {
        return errorResponse(error, request, requestId, dependencies);
      }
    },
  };
}
