import "server-only";

import type { SessionPolicy } from "./types";
import { DEFAULT_SESSION_POLICY } from "./types";

export type AuthRuntimeConfig = Readonly<{
  applicationOrigin: string;
  cookieSecure: boolean;
  enableLocalDemoAuth: boolean;
  sessionHashPepper: string;
  sessionPolicy: SessionPolicy;
}>;

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

function parseBoolean(name: string, value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new AuthConfigurationError(`${name} must be true or false`);
}

function parseApplicationOrigin(rawValue: string | undefined): URL {
  if (!rawValue) throw new AuthConfigurationError("APP_ORIGIN is required");

  let origin: URL;
  try {
    origin = new URL(rawValue);
  } catch {
    throw new AuthConfigurationError("APP_ORIGIN must be an absolute HTTP(S) origin");
  }

  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    rawValue !== origin.origin
  ) {
    throw new AuthConfigurationError("APP_ORIGIN must contain only a canonical HTTP(S) origin");
  }

  return origin;
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/u, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function validatePepper(value: string | undefined): string {
  if (!value || value.length < 32) {
    throw new AuthConfigurationError("SESSION_HASH_PEPPER must contain at least 32 characters");
  }

  const normalized = value.toLowerCase();
  if (
    normalized.startsWith("replace-") ||
    normalized.includes("change-me") ||
    normalized.includes("example")
  ) {
    throw new AuthConfigurationError("SESSION_HASH_PEPPER must not use an example value");
  }
  return value;
}

export function loadAuthRuntimeConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthRuntimeConfig {
  const applicationOrigin = parseApplicationOrigin(environment.APP_ORIGIN);
  const isProduction = environment.NODE_ENV === "production";
  if (isProduction && applicationOrigin.protocol !== "https:") {
    throw new AuthConfigurationError("Production APP_ORIGIN must use HTTPS");
  }

  const explicitSecure = parseBoolean("SESSION_COOKIE_SECURE", environment.SESSION_COOKIE_SECURE, false);
  const requestedLocalDemo = parseBoolean(
    "ENABLE_LOCAL_DEMO_AUTH",
    environment.ENABLE_LOCAL_DEMO_AUTH,
    false,
  );
  const livePaymentsEnabled = parseBoolean(
    "ENABLE_LIVE_PAYMENTS",
    environment.ENABLE_LIVE_PAYMENTS,
    false,
  );

  const enableLocalDemoAuth =
    requestedLocalDemo &&
    !isProduction &&
    isLoopbackHostname(applicationOrigin.hostname) &&
    environment.PAYMENT_MODE === "sandbox" &&
    !livePaymentsEnabled;

  return Object.freeze({
    applicationOrigin: applicationOrigin.origin,
    cookieSecure: isProduction || applicationOrigin.protocol === "https:" || explicitSecure,
    enableLocalDemoAuth,
    sessionHashPepper: validatePepper(environment.SESSION_HASH_PEPPER),
    sessionPolicy: DEFAULT_SESSION_POLICY,
  });
}

export function isLocalDemoRequest(config: AuthRuntimeConfig, request: Request): boolean {
  if (!config.enableLocalDemoAuth) return false;

  let requestUrl: URL;
  let configuredUrl: URL;
  try {
    requestUrl = new URL(request.url);
    configuredUrl = new URL(config.applicationOrigin);
  } catch {
    return false;
  }

  const requestPort = requestUrl.port || (requestUrl.protocol === "https:" ? "443" : "80");
  const configuredPort = configuredUrl.port || (configuredUrl.protocol === "https:" ? "443" : "80");
  return (
    isLoopbackHostname(requestUrl.hostname) &&
    isLoopbackHostname(configuredUrl.hostname) &&
    requestUrl.protocol === configuredUrl.protocol &&
    requestPort === configuredPort
  );
}
