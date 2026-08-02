import "server-only";

import { ProviderConfigurationError } from "@/providers/errors";

import type { UploadHttpDependencies } from "./http";

export type UploadRouteDependencyResolver = () => UploadHttpDependencies;

let resolver: UploadRouteDependencyResolver | undefined;

/**
 * Called by trusted server composition code. No sandbox or live implementation
 * is inferred from environment variables, and an unconfigured process is 503.
 */
export function installUploadRouteDependencies(nextResolver: UploadRouteDependencyResolver): void {
  if (resolver !== undefined) throw new ProviderConfigurationError("Upload route dependencies are already installed");
  resolver = nextResolver;
}

export function getUploadRouteDependencies(): UploadHttpDependencies {
  if (resolver === undefined) throw new ProviderConfigurationError("Private upload routes are not configured");
  const dependencies = resolver();
  if (process.env.NODE_ENV === "production" && dependencies.service.storageMode !== "LIVE") {
    throw new ProviderConfigurationError("Sandbox storage is disabled in production");
  }
  return dependencies;
}
