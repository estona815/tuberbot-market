export class OutboxValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutboxValidationError";
  }
}

export class OutboxConflictError extends Error {
  constructor(message = "Outbox idempotency conflict") {
    super(message);
    this.name = "OutboxConflictError";
  }
}

export class OutboxLeaseError extends Error {
  constructor() {
    super("Outbox lease is no longer owned by this worker");
    this.name = "OutboxLeaseError";
  }
}

/** Sanitized classification; handler exception messages are never persisted. */
export class OutboxDeliveryError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, retryable: boolean) {
    if (!/^[A-Z][A-Z0-9_]{0,63}$/u.test(code)) {
      throw new OutboxValidationError("Outbox delivery error code is invalid");
    }
    super("Outbox delivery failed");
    this.name = "OutboxDeliveryError";
    this.code = code;
    this.retryable = retryable;
  }
}
