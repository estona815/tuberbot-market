import "server-only";

import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

const runtimeSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ORIGIN: z.string().url().default("http://localhost:3000"),
  PAYMENT_PROVIDER: z.enum(["sandbox", "toss"]).default("sandbox"),
  PAYMENT_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  ENABLE_LIVE_PAYMENTS: booleanString.default(false),
  ENABLE_PAYOUTS: booleanString.default(false),
  ENABLE_SAFE_PAYMENT_BADGE: booleanString.default(false),
  TOSS_CLIENT_KEY: z.string().default(""),
  TOSS_SECRET_KEY: z.string().default(""),
  TOSS_WEBHOOK_SECURITY_KEY: z.string().default(""),
  TOSS_PAYOUT_SECURITY_KEY: z.string().default(""),
  PG_CONTRACT_CONFIRMED: booleanString.default(false),
  LEGAL_REVIEW_CONFIRMED: booleanString.default(false),
  TAX_REVIEW_CONFIRMED: booleanString.default(false),
  REFUND_POLICY_VERSION: z.string().default(""),
  TERMS_VERSION: z.string().default(""),
  PRIVACY_VERSION: z.string().default(""),
  SUPPORT_CONTACT: z.string().email().default("support@example.invalid"),
  DISPUTE_CONTACT: z.string().email().default("disputes@example.invalid"),
  RECONCILIATION_SCHEDULE: z.string().default(""),
  BACKUP_VERIFIED_AT: z.string().default(""),
  MONITORING_HEALTHCHECK_URL: z.string().default(""),
});

export type RuntimeConfig = z.infer<typeof runtimeSchema>;

let cachedConfig: RuntimeConfig | undefined;

export function getRuntimeConfig(): Readonly<RuntimeConfig> {
  cachedConfig ??= runtimeSchema.parse(process.env);
  return Object.freeze({ ...cachedConfig });
}

export type LiveReadinessCode =
  | "LIVE_MODE_REQUIRED"
  | "TOSS_PROVIDER_REQUIRED"
  | "LIVE_KEYS_MISSING"
  | "WEBHOOK_SECURITY_MISSING"
  | "PAYOUT_SECURITY_MISSING"
  | "PAYOUT_DISABLED"
  | "PG_CONTRACT_UNCONFIRMED"
  | "LEGAL_REVIEW_UNCONFIRMED"
  | "TAX_REVIEW_UNCONFIRMED"
  | "POLICY_VERSIONS_MISSING"
  | "SUPPORT_CONTACT_MISSING"
  | "DISPUTE_CONTACT_MISSING"
  | "RECONCILIATION_UNSCHEDULED"
  | "BACKUP_UNVERIFIED"
  | "MONITORING_MISSING"
  | "SAFE_PAYMENT_BADGE_BLOCKED";

export function evaluateLivePaymentReadiness(config = getRuntimeConfig()): Readonly<{
  allowed: boolean;
  blockers: readonly LiveReadinessCode[];
}> {
  const blockers: LiveReadinessCode[] = [];
  if (config.PAYMENT_MODE !== "live" || !config.ENABLE_LIVE_PAYMENTS) blockers.push("LIVE_MODE_REQUIRED");
  if (config.PAYMENT_PROVIDER !== "toss") blockers.push("TOSS_PROVIDER_REQUIRED");
  if (!config.TOSS_CLIENT_KEY || !config.TOSS_SECRET_KEY) blockers.push("LIVE_KEYS_MISSING");
  if (!config.TOSS_WEBHOOK_SECURITY_KEY) blockers.push("WEBHOOK_SECURITY_MISSING");
  if (!config.TOSS_PAYOUT_SECURITY_KEY) blockers.push("PAYOUT_SECURITY_MISSING");
  if (!config.ENABLE_PAYOUTS) blockers.push("PAYOUT_DISABLED");
  if (!config.PG_CONTRACT_CONFIRMED) blockers.push("PG_CONTRACT_UNCONFIRMED");
  if (!config.LEGAL_REVIEW_CONFIRMED) blockers.push("LEGAL_REVIEW_UNCONFIRMED");
  if (!config.TAX_REVIEW_CONFIRMED) blockers.push("TAX_REVIEW_UNCONFIRMED");
  if (!config.REFUND_POLICY_VERSION || !config.TERMS_VERSION || !config.PRIVACY_VERSION) blockers.push("POLICY_VERSIONS_MISSING");
  if (config.SUPPORT_CONTACT.endsWith(".invalid")) blockers.push("SUPPORT_CONTACT_MISSING");
  if (config.DISPUTE_CONTACT.endsWith(".invalid")) blockers.push("DISPUTE_CONTACT_MISSING");
  if (!config.RECONCILIATION_SCHEDULE) blockers.push("RECONCILIATION_UNSCHEDULED");
  if (!config.BACKUP_VERIFIED_AT || !Number.isFinite(Date.parse(config.BACKUP_VERIFIED_AT))) blockers.push("BACKUP_UNVERIFIED");
  if (!config.MONITORING_HEALTHCHECK_URL) blockers.push("MONITORING_MISSING");
  if (config.ENABLE_SAFE_PAYMENT_BADGE && blockers.length > 0) blockers.push("SAFE_PAYMENT_BADGE_BLOCKED");
  return Object.freeze({ allowed: blockers.length === 0, blockers: Object.freeze(blockers) });
}

export function assertLivePaymentReady(config = getRuntimeConfig()): void {
  const readiness = evaluateLivePaymentReadiness(config);
  if (!readiness.allowed) {
    throw new Error(`Live payment activation blocked: ${readiness.blockers.join(", ")}`);
  }
}

export function resetRuntimeConfigForTests(): void {
  if (process.env.NODE_ENV !== "test") throw new Error("runtime config cache can only be reset in tests");
  cachedConfig = undefined;
}
