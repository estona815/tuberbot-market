import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import {
  createOrderCollaborationAuthorization,
  MemoryOrderCollaborationRepository,
  ORDER_COLLABORATION_DEMO,
  OrderCollaborationService,
} from "../../src/application/order-collaboration";
import { createOrderCollaborationRouteHandlers } from "../../src/app/api/orders/_shared/route-factory";
import type { OrderCollaborationRouteDependencies } from "../../src/app/api/orders/_shared/route-factory";
import type { AuthenticatedActor } from "../../src/lib/server/authorization";

const buyer: AuthenticatedActor = {
  userId: ORDER_COLLABORATION_DEMO.buyerUserId,
  roles: ["ADVERTISER"],
  organizationIds: [ORDER_COLLABORATION_DEMO.buyerOrganizationId],
  mfaVerified: false,
  sessionId: "buyer-session",
};

const creator: AuthenticatedActor = {
  userId: ORDER_COLLABORATION_DEMO.creatorUserId,
  roles: ["CREATOR"],
  organizationIds: [],
  mfaVerified: false,
  sessionId: "creator-session",
};

function context() {
  return { params: Promise.resolve({ id: ORDER_COLLABORATION_DEMO.orderNumber }) };
}

function postRequest(path: string, body: unknown, idempotencyKey: string): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
      "x-csrf-token": "valid-csrf",
      "x-request-id": "request_12345678",
    },
    body: JSON.stringify(body),
  });
}

describe("order collaboration route factory", () => {
  let currentActor: AuthenticatedActor | null;
  let repository: MemoryOrderCollaborationRepository;
  let reportError: NonNullable<OrderCollaborationRouteDependencies["reportError"]>;
  let service: OrderCollaborationService;

  beforeEach(() => {
    currentActor = buyer;
    reportError = vi.fn<NonNullable<OrderCollaborationRouteDependencies["reportError"]>>();
    repository = MemoryOrderCollaborationRepository.createLoopbackDemo();
    service = new OrderCollaborationService(
      repository,
      createOrderCollaborationAuthorization((actor, _permission, scope) =>
        [scope.buyerUserId, scope.creatorUserId].includes(actor.userId),
      ),
      { now: () => new Date("2026-08-02T01:02:03.000Z") },
    );
  });

  function handlers() {
    return createOrderCollaborationRouteHandlers({
      applicationOrigin: "http://localhost:3000",
      authenticate: async () => currentActor,
      verifyCsrf: async (request) =>
        request.headers.get("x-csrf-token") === "valid-csrf",
      getService: () => service,
      reportError,
    });
  }

  it("fails closed before resolving a workspace", async () => {
    currentActor = null;
    const response = await handlers().workspace(
      new Request(
        `http://localhost:3000/api/orders/${ORDER_COLLABORATION_DEMO.orderNumber}/workspace`,
      ),
      context(),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("returns the stable workspace envelope", async () => {
    const response = await handlers().workspace(
      new Request(
        `http://localhost:3000/api/orders/${ORDER_COLLABORATION_DEMO.orderNumber}/workspace`,
        { headers: { "x-request-id": "request_12345678" } },
      ),
      context(),
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      replayed: false,
      workspace: { order: { orderNumber: "TBM-20260802-001", version: 1 } },
    });
    expect(response.headers.get("x-request-id")).toBe("request_12345678");
  });

  it("validates and exposes bounded message pagination metadata", async () => {
    const bounded = await handlers().workspace(
      new Request(
        `http://localhost:3000/api/orders/${ORDER_COLLABORATION_DEMO.orderNumber}/workspace?limit=1`,
      ),
      context(),
    );
    const invalid = await handlers().workspace(
      new Request(
        `http://localhost:3000/api/orders/${ORDER_COLLABORATION_DEMO.orderNumber}/workspace?limit=101`,
      ),
      context(),
    );

    expect(bounded.status).toBe(200);
    expect(await bounded.json()).toMatchObject({
      workspace: {
        messages: [],
        messagePage: {
          limit: 1,
          returned: 0,
          hasMore: false,
          nextCursor: null,
        },
      },
    });
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
    expect(reportError).not.toHaveBeenCalled();
  });

  it("persists a message once and replays the idempotent response", async () => {
    const path = `/api/orders/${ORDER_COLLABORATION_DEMO.orderNumber}/messages`;
    const payload = {
      body: "수정 포인트를 확인했습니다.",
      clientMessageId: "buyer-message-1",
      expectedVersion: 1,
    };

    const first = await handlers().messages(
      postRequest(path, payload, "message-idempotency-1"),
      context(),
    );
    const replay = await handlers().messages(
      postRequest(path, payload, "message-idempotency-1"),
      context(),
    );

    expect(first.status).toBe(200);
    expect(first.headers.get("idempotency-replayed")).toBe("false");
    expect(replay.status).toBe(200);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.json()).toMatchObject({
      replayed: true,
      workspace: { messages: [{ clientMessageId: "buyer-message-1" }] },
    });
    expect(repository.events).toHaveLength(1);
  });

  it("rejects changed payloads that reuse an idempotency key", async () => {
    const path = `/api/orders/${ORDER_COLLABORATION_DEMO.orderNumber}/messages`;
    await handlers().messages(
      postRequest(
        path,
        { body: "first", clientMessageId: "message-1", expectedVersion: 1 },
        "same-key",
      ),
      context(),
    );
    const conflict = await handlers().messages(
      postRequest(
        path,
        { body: "changed", clientMessageId: "message-2", expectedVersion: 1 },
        "same-key",
      ),
      context(),
    );

    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({
      error: { code: "IDEMPOTENCY_CONFLICT" },
    });
  });

  it("maps request input and origin failures without reporting them as internal", async () => {
    const path = `/api/orders/${ORDER_COLLABORATION_DEMO.orderNumber}/messages`;
    const invalid = await handlers().messages(
      postRequest(path, { body: "missing fields" }, "invalid-message"),
      context(),
    );
    const invalidLocator = await handlers().workspace(
      new Request("http://localhost:3000/api/orders/invalid/workspace"),
      { params: Promise.resolve({ id: "" }) },
    );
    const invalidPagination = await handlers().workspace(
      new Request(
        `http://localhost:3000/api/orders/${ORDER_COLLABORATION_DEMO.orderNumber}/workspace?limit=0`,
      ),
      context(),
    );
    const duplicatePagination = await handlers().workspace(
      new Request(
        `http://localhost:3000/api/orders/${ORDER_COLLABORATION_DEMO.orderNumber}/workspace?limit=10&limit=20`,
      ),
      context(),
    );
    const crossSiteRequest = postRequest(
      path,
      { body: "hello", clientMessageId: "message-3", expectedVersion: 1 },
      "cross-site",
    );
    crossSiteRequest.headers.set("origin", "https://attacker.invalid");
    const crossSite = await handlers().messages(crossSiteRequest, context());

    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
    expect(invalidLocator.status).toBe(422);
    expect(await invalidLocator.json()).toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
    expect(invalidPagination.status).toBe(422);
    expect(await invalidPagination.json()).toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
    expect(duplicatePagination.status).toBe(422);
    expect(await duplicatePagination.json()).toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
    expect(crossSite.status).toBe(403);
    expect(await crossSite.json()).toMatchObject({
      error: { code: "ORIGIN_OR_CSRF_REJECTED" },
    });
    expect(reportError).not.toHaveBeenCalled();
  });

  it.each([
    ["TypeError", () => new TypeError("Database timestamp is invalid")],
    [
      "ZodError",
      () => {
        const result = z
          .object({ status: z.literal("ACTIVE") })
          .safeParse({ status: "CORRUPT" });
        if (result.success) throw new Error("Expected an invariant error fixture");
        return result.error;
      },
    ],
  ])("reports an internal %s and returns a sanitized 500", async (errorName, createError) => {
    vi.spyOn(repository, "getWorkspace").mockRejectedValueOnce(createError());

    const response = await handlers().workspace(
      new Request(
        `http://localhost:3000/api/orders/${ORDER_COLLABORATION_DEMO.orderNumber}/workspace`,
        { headers: { "x-request-id": "request_internal_123" } },
      ),
      context(),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "INTERNAL_ERROR" },
      requestId: "request_internal_123",
    });
    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledWith({
      errorName,
      requestId: "request_internal_123",
      route: `/api/orders/${ORDER_COLLABORATION_DEMO.orderNumber}/workspace`,
    });
  });

  it("keeps deliverable review buyer-only and uses an IDOR-safe response", async () => {
    currentActor = creator;
    const response = await handlers().transitions(
      postRequest(
        `/api/orders/${ORDER_COLLABORATION_DEMO.orderNumber}/transitions`,
        {
          action: "APPROVE_DELIVERABLE",
          expectedVersion: 1,
          deliverableId: ORDER_COLLABORATION_DEMO.deliverableId,
          deliverableVersion: 1,
          clientMessageId: "creator-approval",
        },
        "creator-review",
      ),
      context(),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: "ORDER_WORKSPACE_NOT_FOUND" },
    });
  });
});
