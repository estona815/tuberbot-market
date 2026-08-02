import "server-only";

export class PrivateUploadValidationError extends Error {
  readonly code: string;

  constructor(code: string, message = "Upload request rejected") {
    super(message);
    this.name = "PrivateUploadValidationError";
    this.code = code;
  }
}

export class PrivateUploadConflictError extends Error {
  readonly code = "IDEMPOTENCY_CONFLICT";

  constructor() {
    super("Idempotency key was reused for a different upload request");
    this.name = "PrivateUploadConflictError";
  }
}

export class PrivateUploadNotFoundError extends Error {
  readonly code = "UPLOAD_NOT_FOUND";

  constructor() {
    super("Upload is unavailable");
    this.name = "PrivateUploadNotFoundError";
  }
}

export class PrivateUploadUnavailableError extends Error {
  readonly code: "SCAN_PENDING" | "UPLOAD_REJECTED" | "STORAGE_UNAVAILABLE";

  constructor(code: "SCAN_PENDING" | "UPLOAD_REJECTED" | "STORAGE_UNAVAILABLE") {
    super("Upload is unavailable");
    this.name = "PrivateUploadUnavailableError";
    this.code = code;
  }
}
