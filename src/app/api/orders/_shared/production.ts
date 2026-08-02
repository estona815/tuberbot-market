import {
  createOrderCollaborationAuthorization,
  MemoryOrderCollaborationRepository,
  OrderCollaborationService,
} from "../../../../application/order-collaboration";
import {
  authenticateSessionRequest,
  requireSessionRequestCsrf,
} from "../../../../lib/server/auth/runtime";
import type { AuthenticatedSession } from "../../../../lib/server/auth/types";
import { isAuthorized } from "../../../../lib/server/authorization";
import { getRuntimeConfig } from "../../../../lib/server/runtime-config";
import { PostgresOrderCollaborationRepository } from "../../../../lib/server/repositories/order-collaboration-repository";
import { createProductionOrderDatabase } from "../../../../lib/server/repositories/order-postgres-adapter";
import {
  createOrderCollaborationRouteHandlers,
  type OrderCollaborationRouteDependencies,
} from "./route-factory";

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function effectivePort(url: URL): string {
  return url.port || (url.protocol === "https:" ? "443" : "80");
}

function matchesConfiguredLoopbackOrigin(request: Request, configuredUrl: URL): boolean {
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return false;
  }
  return (
    isLoopbackHostname(requestUrl.hostname) &&
    isLoopbackHostname(configuredUrl.hostname) &&
    requestUrl.protocol === configuredUrl.protocol &&
    effectivePort(requestUrl) === effectivePort(configuredUrl)
  );
}

function demoRepositoryEnabled(request: Request): boolean {
  const runtime = getRuntimeConfig();
  let configuredOrigin: URL;
  try {
    configuredOrigin = new URL(runtime.APP_ORIGIN);
  } catch {
    return false;
  }
  return (
    process.env.TUBERBOT_ORDER_DEMO_MODE === "true" &&
    process.env.ENABLE_LOCAL_DEMO_AUTH === "true" &&
    process.env.NODE_ENV !== "production" &&
    runtime.PAYMENT_MODE === "sandbox" &&
    !runtime.ENABLE_LIVE_PAYMENTS &&
    matchesConfiguredLoopbackOrigin(request, configuredOrigin)
  );
}

const authorization = createOrderCollaborationAuthorization(
  (actor, permission, scope) =>
    isAuthorized(actor, permission, {
      ownerUserIds: [scope.buyerUserId, scope.creatorUserId],
      organizationId: scope.buyerOrganizationId ?? undefined,
      advertiserUserId: scope.buyerUserId,
      creatorUserId: scope.creatorUserId,
    }),
);

let productionService: OrderCollaborationService | undefined;
let demoService: OrderCollaborationService | undefined;

function getService(request: Request): OrderCollaborationService {
  if (demoRepositoryEnabled(request)) {
    demoService ??= new OrderCollaborationService(
      MemoryOrderCollaborationRepository.createLoopbackDemo(),
      authorization,
    );
    return demoService;
  }
  productionService ??= new OrderCollaborationService(
    new PostgresOrderCollaborationRepository(createProductionOrderDatabase()),
    authorization,
  );
  return productionService;
}

export function createProductionOrderRouteDependencies(): OrderCollaborationRouteDependencies {
  const requestSessions = new WeakMap<Request, AuthenticatedSession>();
  return {
    applicationOrigin: getRuntimeConfig().APP_ORIGIN,
    async authenticate(request) {
      const authenticated = await authenticateSessionRequest(request);
      if (authenticated === null) return null;
      requestSessions.set(request, authenticated);
      return authenticated.actor;
    },
    async verifyCsrf(request, actor) {
      const authenticated = requestSessions.get(request);
      if (
        authenticated === undefined ||
        authenticated.actor.userId !== actor.userId ||
        authenticated.actor.sessionId !== actor.sessionId
      ) {
        return false;
      }
      try {
        requireSessionRequestCsrf(request, authenticated);
        return true;
      } catch {
        return false;
      } finally {
        requestSessions.delete(request);
      }
    },
    getService,
  };
}

export const productionOrderCollaborationHandlers =
  createOrderCollaborationRouteHandlers(createProductionOrderRouteDependencies());
