export class ProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigurationError";
  }
}

export class ProviderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderValidationError";
  }
}

/** Sanitized provider failure. Raw response bodies must never be included. */
export class ProviderHttpError extends Error {
  readonly status: number;
  readonly providerCode: string;

  constructor(status: number, providerCode: string, message = "Provider request failed") {
    super(message);
    this.name = "ProviderHttpError";
    this.status = status;
    this.providerCode = providerCode;
  }
}

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}
