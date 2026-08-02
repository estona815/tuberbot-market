export const LICENSE_EXPIRY_NOTICE_DAYS = [30, 14, 3, 0] as const;

export type LicenseExpiryState =
  | "PERPETUAL"
  | "ACTIVE"
  | "EXPIRING"
  | "EXPIRES_TODAY"
  | "EXPIRED";

export interface LicenseExpiryInput {
  readonly perpetual: boolean;
  readonly endAt: string | null;
  readonly now: string;
  readonly sentNoticeDays?: readonly number[];
}

export interface LicenseExpiryDecision {
  readonly state: LicenseExpiryState;
  readonly daysUntilExpiry: number | null;
  readonly noticeDueDays: (typeof LICENSE_EXPIRY_NOTICE_DAYS)[number] | null;
}

function parseTimestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${field} must be an ISO-8601 timestamp`);
  }
  return parsed;
}

export function evaluateLicenseExpiry(
  input: LicenseExpiryInput,
): Readonly<LicenseExpiryDecision> {
  const nowMs = parseTimestamp(input.now, "now");
  if (input.perpetual) {
    if (input.endAt !== null) {
      throw new TypeError("perpetual licenses must not have endAt");
    }
    return Object.freeze({
      state: "PERPETUAL",
      daysUntilExpiry: null,
      noticeDueDays: null,
    });
  }
  if (input.endAt === null) {
    throw new TypeError("non-perpetual licenses require endAt");
  }
  const endMs = parseTimestamp(input.endAt, "endAt");
  const exactDays = (endMs - nowMs) / (24 * 60 * 60 * 1_000);
  const daysUntilExpiry = Math.ceil(exactDays);
  const sent = new Set(input.sentNoticeDays ?? []);
  const noticeCandidate = LICENSE_EXPIRY_NOTICE_DAYS.find(
    (days) => days === daysUntilExpiry && !sent.has(days),
  );

  let state: LicenseExpiryState;
  if (endMs <= nowMs) state = "EXPIRED";
  else if (daysUntilExpiry === 0) state = "EXPIRES_TODAY";
  else if (daysUntilExpiry <= 30) state = "EXPIRING";
  else state = "ACTIVE";

  return Object.freeze({
    state,
    daysUntilExpiry,
    noticeDueDays: state === "EXPIRED" ? null : (noticeCandidate ?? null),
  });
}
