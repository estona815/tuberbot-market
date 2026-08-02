import { ProviderConfigurationError } from "../errors";
import { SandboxPrivateObjectStorage, type SandboxStorageDependencies } from "./sandbox";
import type { PrivateObjectStorage } from "./types";

export type StorageProviderConfiguration =
  | Readonly<{ mode: "SANDBOX"; sandbox?: SandboxStorageDependencies }>
  | Readonly<{ mode: "LIVE" }>;

/** No live adapter is silently substituted with memory storage. */
export function createPrivateObjectStorage(configuration: StorageProviderConfiguration): PrivateObjectStorage {
  if (configuration.mode === "SANDBOX") {
    return new SandboxPrivateObjectStorage(configuration.sandbox);
  }
  throw new ProviderConfigurationError("Live private object storage is not configured");
}
