import "server-only";

import { z } from "zod";

import {
  ApiRequestError,
  getRequestId,
  noStoreJson,
  parseBoundedJson,
  publicApiError,
} from "@/lib/server/api-envelope";
import { requireSameOrigin } from "@/lib/server/request-security";
import type { AuthRuntimeConfig } from "./config";
import { isLocalDemoRequest } from "./config";
import {
  createAuthCookieHeaders,
  createClearedAuthCookieHeaders,
  parseAuthCookies,
} from "./cookies";
import { CsrfValidationError, requireValidCsrf } from "./csrf";
import type { SensitiveActionRateLimiter } from "./rate-limit";
import { parseReturnTo } from "./return-to";
import type { AuthSessionService } from "./service";

const demoSessionSchema = z.strictObject({
  persona: z.enum(["ADVERTISER", "CREATOR"]),
  returnTo: z.string().max(2_048).optional(),
});

export type AuthHttpHandlers = Readonly<{
  getSession(request: Request): Promise<Response>;
  createDemoSession(request: Request): Promise<Response>;
  rotateSession(request: Request): Promise<Response>;
  deleteSession(request: Request): Promise<Response>;
}>;

function appendSetCookies(response: Response, cookies: readonly string[]): Response {
  for (const cookie of cookies) response.headers.append("Set-Cookie", cookie);
  return response;
}

function clearAuthResponse(
  response: Response,
  config: AuthRuntimeConfig,
): Response {
  return appendSetCookies(response, createClearedAuthCookieHeaders(config));
}

function sessionActorPayload(
  actor: Readonly<{
    userId: string;
    roles: readonly string[];
    organizationIds: readonly string[];
    mfaVerified: boolean;
    sessionId: string;
  }>,
  localDemo: boolean,
): Readonly<Record<string, unknown>> {
  const role = actor.roles[0];
  return Object.freeze({
    userId: actor.userId,
    roles: actor.roles,
    role,
    mfaVerified: actor.mfaVerified,
    ...(localDemo
      ? {
          displayName: role === "CREATOR" ? "로컬 데모 크리에이터" : "로컬 데모 광고주",
        }
      : {}),
  });
}

function unavailableResponse(request: Request): Response {
  return publicApiError("AUTH_SERVICE_UNAVAILABLE", 503, getRequestId(request));
}

function stateChangeRejected(request: Request): Response {
  return publicApiError("STATE_CHANGE_REJECTED", 403, getRequestId(request));
}

export function createAuthHttpHandlers(dependencies: Readonly<{
  config: AuthRuntimeConfig;
  service: AuthSessionService;
  rateLimiter: SensitiveActionRateLimiter;
  now?: () => Date;
}>): AuthHttpHandlers {
  const now = dependencies.now ?? (() => new Date());

  return Object.freeze({
    async getSession(request: Request): Promise<Response> {
      const requestId = getRequestId(request);
      const localDemoAvailable = isLocalDemoRequest(dependencies.config, request);
      const cookies = parseAuthCookies(request);
      if (cookies.malformed) {
        return clearAuthResponse(
          noStoreJson({ authenticated: false, localDemoAvailable }, { requestId }),
          dependencies.config,
        );
      }
      if (cookies.sessionToken === null) {
        return noStoreJson({ authenticated: false, localDemoAvailable }, { requestId });
      }

      try {
        const authenticated = await dependencies.service.authenticate(cookies.sessionToken, now());
        if (authenticated === null) {
          return clearAuthResponse(
            noStoreJson({ authenticated: false, localDemoAvailable }, { requestId }),
            dependencies.config,
          );
        }
        return noStoreJson(
          {
            authenticated: true,
            localDemoAvailable,
            actor: sessionActorPayload(
              authenticated.actor,
              authenticated.session.authMethod === "LOCAL_DEMO",
            ),
          },
          { requestId },
        );
      } catch {
        return unavailableResponse(request);
      }
    },

    async createDemoSession(request: Request): Promise<Response> {
      const requestId = getRequestId(request);
      if (!isLocalDemoRequest(dependencies.config, request)) {
        return publicApiError("LOCAL_DEMO_AUTH_UNAVAILABLE", 404, requestId);
      }
      try {
        requireSameOrigin(request, dependencies.config.applicationOrigin);
      } catch {
        return stateChangeRejected(request);
      }

      let rateDecision;
      try {
        rateDecision = await dependencies.rateLimiter.consume("local-demo-session", now());
      } catch {
        return unavailableResponse(request);
      }
      if (!rateDecision.allowed) {
        const response = publicApiError("RATE_LIMITED", 429, requestId);
        response.headers.set("Retry-After", String(Math.max(1, rateDecision.retryAfterSeconds)));
        return response;
      }

      let body: z.infer<typeof demoSessionSchema>;
      let returnTo: string;
      try {
        const parsed = demoSessionSchema.safeParse(await parseBoundedJson(request, 4 * 1_024));
        if (!parsed.success) return publicApiError("INVALID_REQUEST", 400, requestId);
        body = parsed.data;
        returnTo = parseReturnTo(body.returnTo, "/dashboard");
      } catch (error) {
        if (error instanceof ApiRequestError) {
          return publicApiError(error.code, error.status, requestId);
        }
        return publicApiError("INVALID_REQUEST", 400, requestId);
      }

      try {
        const issuedAt = now();
        const issued = await dependencies.service.issueLocalDemo(body.persona, issuedAt);
        const response = noStoreJson(
          {
            authenticated: true,
            mode: "LOCAL_DEMO_PREVIEW",
            actor: sessionActorPayload(issued.actor, true),
            returnTo,
          },
          { status: 201, requestId },
        );
        return appendSetCookies(
          response,
          createAuthCookieHeaders(
            dependencies.config,
            issued.sessionToken,
            issued.csrfToken,
            issued.session.expiresAt,
            issuedAt,
          ),
        );
      } catch {
        return unavailableResponse(request);
      }
    },

    async rotateSession(request: Request): Promise<Response> {
      const requestId = getRequestId(request);
      try {
        requireSameOrigin(request, dependencies.config.applicationOrigin);
      } catch {
        return stateChangeRejected(request);
      }

      const cookies = parseAuthCookies(request);
      if (cookies.malformed || cookies.sessionToken === null) {
        return clearAuthResponse(
          publicApiError("AUTHENTICATION_REQUIRED", 401, requestId),
          dependencies.config,
        );
      }

      try {
        const rotationTime = now();
        const authenticated = await dependencies.service.authenticate(cookies.sessionToken, rotationTime);
        if (authenticated === null) {
          return clearAuthResponse(
            publicApiError("AUTHENTICATION_REQUIRED", 401, requestId),
            dependencies.config,
          );
        }
        requireValidCsrf({
          request,
          applicationOrigin: dependencies.config.applicationOrigin,
          csrfCookieToken: cookies.csrfToken,
          storedCsrfDigest: authenticated.session.csrfTokenDigest,
          pepper: dependencies.config.sessionHashPepper,
        });
        const issued = await dependencies.service.rotate(authenticated, rotationTime);
        if (issued === null) {
          return clearAuthResponse(
            publicApiError("AUTHENTICATION_REQUIRED", 401, requestId),
            dependencies.config,
          );
        }
        const response = noStoreJson(
          {
            authenticated: true,
            actor: sessionActorPayload(issued.actor, issued.session.authMethod === "LOCAL_DEMO"),
          },
          { requestId },
        );
        return appendSetCookies(
          response,
          createAuthCookieHeaders(
            dependencies.config,
            issued.sessionToken,
            issued.csrfToken,
            issued.session.expiresAt,
            rotationTime,
          ),
        );
      } catch (error) {
        if (error instanceof CsrfValidationError) {
          return publicApiError("CSRF_VALIDATION_FAILED", 403, requestId);
        }
        return unavailableResponse(request);
      }
    },

    async deleteSession(request: Request): Promise<Response> {
      const requestId = getRequestId(request);
      try {
        requireSameOrigin(request, dependencies.config.applicationOrigin);
      } catch {
        return stateChangeRejected(request);
      }

      const cookies = parseAuthCookies(request);
      if (cookies.malformed || cookies.sessionToken === null) {
        return clearAuthResponse(
          publicApiError("AUTHENTICATION_REQUIRED", 401, requestId),
          dependencies.config,
        );
      }

      try {
        const revokeTime = now();
        const authenticated = await dependencies.service.authenticate(cookies.sessionToken, revokeTime);
        if (authenticated === null) {
          return clearAuthResponse(
            publicApiError("AUTHENTICATION_REQUIRED", 401, requestId),
            dependencies.config,
          );
        }
        requireValidCsrf({
          request,
          applicationOrigin: dependencies.config.applicationOrigin,
          csrfCookieToken: cookies.csrfToken,
          storedCsrfDigest: authenticated.session.csrfTokenDigest,
          pepper: dependencies.config.sessionHashPepper,
        });
        await dependencies.service.revoke(authenticated, revokeTime);

        const headers = new Headers({
          "Cache-Control": "no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
          "X-Request-Id": requestId,
        });
        const response = new Response(null, { status: 204, headers });
        return clearAuthResponse(response, dependencies.config);
      } catch (error) {
        if (error instanceof CsrfValidationError) {
          return publicApiError("CSRF_VALIDATION_FAILED", 403, requestId);
        }
        return unavailableResponse(request);
      }
    },
  });
}
