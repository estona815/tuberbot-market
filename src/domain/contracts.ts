import { createHash } from "node:crypto";

export type CanonicalJsonPrimitive = string | number | boolean | null;
export type CanonicalJsonValue =
  | CanonicalJsonPrimitive
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

export interface ContractPartyAcceptance {
  readonly partyId: string;
  readonly role: "ADVERTISER" | "CREATOR";
  readonly acceptedAt: string;
  readonly evidenceId: string;
}

export interface ContractPolicyVersions {
  readonly marketplaceTerms: string;
  readonly refundPolicy: string;
  readonly privacyPolicy: string;
  readonly feeRuleId: string;
  readonly feeRuleVersion: number;
}

export interface ContractSnapshotInput {
  readonly contractId: string;
  readonly version: number;
  readonly proposalVersionId: string;
  readonly createdAt: string;
  readonly parties: readonly ContractPartyAcceptance[];
  /** Amounts in terms must be decimal strings, never JSON numbers. */
  readonly terms: CanonicalJsonValue;
  readonly policies: ContractPolicyVersions;
}

export interface ContractSnapshotDocument {
  readonly schemaVersion: 1;
  readonly contractId: string;
  readonly version: number;
  readonly proposalVersionId: string;
  readonly createdAt: string;
  readonly parties: readonly ContractPartyAcceptance[];
  readonly terms: CanonicalJsonValue;
  readonly policies: ContractPolicyVersions;
  readonly legalReviewStatus: "DRAFT_NEEDS_COUNSEL";
}

export interface ContractSnapshot {
  readonly document: Readonly<ContractSnapshotDocument>;
  readonly canonicalJson: string;
  readonly sha256: string;
}

export class CanonicalJsonError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalJsonError";
  }
}

function assertText(value: string, field: string, maxLength = 256): void {
  if (value.trim().length === 0 || value.length > maxLength) {
    throw new TypeError(`${field} must contain 1-${maxLength} characters`);
  }
}

function assertTimestamp(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new TypeError(`${field} must be an ISO-8601 timestamp`);
  }
}

function canonicalize(value: unknown, ancestors: Set<object>): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new CanonicalJsonError("Canonical JSON does not support non-finite numbers");
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new CanonicalJsonError(`Unsupported canonical JSON value: ${typeof value}`);
  }
  if (ancestors.has(value)) {
    throw new CanonicalJsonError("Canonical JSON cannot contain cycles");
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => canonicalize(item, ancestors)).join(",")}]`;
    }

    const prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CanonicalJsonError("Canonical JSON objects must be plain objects");
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key], ancestors)}`)
      .join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

/** Deterministic JSON serialization used as the contract hash input. */
export function canonicalizeJson(value: unknown): string {
  return canonicalize(value, new Set<object>());
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): Readonly<T> {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested, seen);
  }
  return Object.freeze(value);
}

export function createContractSnapshot(
  input: ContractSnapshotInput,
): Readonly<ContractSnapshot> {
  assertText(input.contractId, "contractId");
  assertText(input.proposalVersionId, "proposalVersionId");
  assertTimestamp(input.createdAt, "createdAt");
  if (!Number.isSafeInteger(input.version) || input.version <= 0) {
    throw new RangeError("version must be a positive safe integer");
  }
  if (input.parties.length !== 2) {
    throw new TypeError("a contract requires exactly two party acceptances");
  }
  const roles = new Set(input.parties.map((party) => party.role));
  if (!roles.has("ADVERTISER") || !roles.has("CREATOR")) {
    throw new TypeError("advertiser and creator acceptances are both required");
  }
  for (const [index, party] of input.parties.entries()) {
    assertText(party.partyId, `parties[${index}].partyId`);
    assertText(party.evidenceId, `parties[${index}].evidenceId`);
    assertTimestamp(party.acceptedAt, `parties[${index}].acceptedAt`);
  }
  if (
    !Number.isSafeInteger(input.policies.feeRuleVersion) ||
    input.policies.feeRuleVersion <= 0
  ) {
    throw new RangeError("policies.feeRuleVersion must be a positive safe integer");
  }
  for (const [field, value] of Object.entries(input.policies)) {
    if (field !== "feeRuleVersion") assertText(String(value), `policies.${field}`);
  }

  // Validate the caller-owned terms before copying so undefined and exotic values fail.
  const canonicalTerms = canonicalizeJson(input.terms);
  const terms = JSON.parse(canonicalTerms) as CanonicalJsonValue;
  const document: ContractSnapshotDocument = {
    schemaVersion: 1,
    contractId: input.contractId,
    version: input.version,
    proposalVersionId: input.proposalVersionId,
    createdAt: input.createdAt,
    parties: input.parties.map((party) => ({ ...party })),
    terms,
    policies: { ...input.policies },
    legalReviewStatus: "DRAFT_NEEDS_COUNSEL",
  };
  const canonicalJson = canonicalizeJson(document);

  return deepFreeze({
    document,
    canonicalJson,
    sha256: sha256Hex(canonicalJson),
  });
}

export function verifyContractSnapshot(snapshot: ContractSnapshot): boolean {
  return (
    canonicalizeJson(snapshot.document) === snapshot.canonicalJson &&
    sha256Hex(snapshot.canonicalJson) === snapshot.sha256
  );
}
