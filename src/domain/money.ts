export const BASIS_POINTS_DENOMINATOR = 10_000n;

export type BasisPoints = number;
export type KrwAmount = bigint;

export class MoneyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyValidationError";
  }
}

export function assertKrwAmount(
  amount: bigint,
  fieldName = "amountKrw",
): asserts amount is KrwAmount {
  if (amount < 0n) {
    throw new MoneyValidationError(`${fieldName} must be non-negative`);
  }
}

export function assertPositiveKrwAmount(
  amount: bigint,
  fieldName = "amountKrw",
): asserts amount is KrwAmount {
  if (amount <= 0n) {
    throw new MoneyValidationError(`${fieldName} must be positive`);
  }
}

export function assertBasisPoints(
  basisPoints: number,
  fieldName = "basisPoints",
): asserts basisPoints is BasisPoints {
  if (
    !Number.isInteger(basisPoints) ||
    basisPoints < 0 ||
    basisPoints > Number(BASIS_POINTS_DENOMINATOR)
  ) {
    throw new MoneyValidationError(
      `${fieldName} must be an integer between 0 and 10000`,
    );
  }
}

/**
 * Calculates a fee in integer KRW. Fractional won are always rounded down.
 * The rounding rule is intentionally explicit and is persisted in fee snapshots.
 */
export function calculateBpsFloor(
  amountKrw: KrwAmount,
  basisPoints: BasisPoints,
): KrwAmount {
  assertKrwAmount(amountKrw);
  assertBasisPoints(basisPoints);

  return (amountKrw * BigInt(basisPoints)) / BASIS_POINTS_DENOMINATOR;
}

/** Converts bigint KRW to the safe JSON number required by Toss APIs. */
export function krwToSafeNumber(amountKrw: KrwAmount): number {
  assertKrwAmount(amountKrw);
  if (amountKrw > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new MoneyValidationError("amountKrw exceeds JavaScript safe integer range");
  }

  return Number(amountKrw);
}

export function safeNumberToKrw(value: number, fieldName = "amount"): KrwAmount {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new MoneyValidationError(
      `${fieldName} must be a non-negative safe integer`,
    );
  }

  return BigInt(value);
}
