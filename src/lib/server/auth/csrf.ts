import "server-only";

import { requireSameOrigin } from "@/lib/server/request-security";
import { digestToken, digestsEqual, isOpaqueToken, tokensEqual } from "./token";

export class CsrfValidationError extends Error {
  constructor() {
    super("CSRF validation failed");
    this.name = "CsrfValidationError";
  }
}

export function requireValidCsrf(input: Readonly<{
  request: Request;
  applicationOrigin: string;
  csrfCookieToken: string | null;
  storedCsrfDigest: string;
  pepper: string;
}>): void {
  try {
    requireSameOrigin(input.request, input.applicationOrigin);
  } catch {
    throw new CsrfValidationError();
  }

  const headerToken = input.request.headers.get("x-csrf-token");
  if (
    !isOpaqueToken(headerToken) ||
    !isOpaqueToken(input.csrfCookieToken) ||
    !tokensEqual(headerToken, input.csrfCookieToken)
  ) {
    throw new CsrfValidationError();
  }

  const presentedDigest = digestToken(headerToken, "csrf", input.pepper);
  if (!digestsEqual(presentedDigest, input.storedCsrfDigest)) {
    throw new CsrfValidationError();
  }
}
