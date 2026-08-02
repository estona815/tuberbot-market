export class StorageValidationError extends Error {
  readonly code: string;

  constructor(code: string, message = "Storage request rejected") {
    super(message);
    this.name = "StorageValidationError";
    this.code = code;
  }
}

export class StorageStateError extends Error {
  readonly code: string;

  constructor(code: string, message = "Storage object is not available") {
    super(message);
    this.name = "StorageStateError";
    this.code = code;
  }
}
