import "server-only";

import { extname } from "node:path";

import { MAX_PRIVATE_UPLOAD_BYTES } from "../upload-policy";
import { PrivateUploadValidationError } from "./errors";

const allowedTypes: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "application/pdf": Object.freeze([".pdf"]),
  "image/jpeg": Object.freeze([".jpg", ".jpeg"]),
  "image/png": Object.freeze([".png"]),
  "video/mp4": Object.freeze([".mp4"]),
  "video/quicktime": Object.freeze([".mov"]),
});

export interface ValidatedUploadDeclaration {
  readonly filename: string;
  readonly declaredMimeType: string;
  readonly expectedSizeBytes: number;
}

function validFilename(filename: string): boolean {
  return (
    filename.length > 0 &&
    filename.length <= 255 &&
    filename !== "." &&
    filename !== ".." &&
    !/[\u0000-\u001f\u007f/\\]/u.test(filename)
  );
}

export function validateUploadDeclaration(input: Readonly<{
  filename: string;
  declaredMimeType: string;
  expectedSizeBytes: number;
}>): ValidatedUploadDeclaration {
  if (!validFilename(input.filename)) {
    throw new PrivateUploadValidationError("INVALID_FILENAME");
  }
  if (!Number.isSafeInteger(input.expectedSizeBytes) || input.expectedSizeBytes <= 0 || input.expectedSizeBytes > MAX_PRIVATE_UPLOAD_BYTES) {
    throw new PrivateUploadValidationError("INVALID_SIZE");
  }
  const declaredMimeType = input.declaredMimeType.trim().toLowerCase();
  const extensions = allowedTypes[declaredMimeType];
  if (extensions === undefined) {
    throw new PrivateUploadValidationError("DECLARED_MIME_NOT_ALLOWED");
  }
  if (!extensions.includes(extname(input.filename).toLowerCase())) {
    throw new PrivateUploadValidationError("EXTENSION_MIME_MISMATCH");
  }
  return Object.freeze({
    filename: input.filename,
    declaredMimeType,
    expectedSizeBytes: input.expectedSizeBytes,
  });
}

export function validateCompletedUpload(
  declaration: ValidatedUploadDeclaration,
  inspection: Readonly<{ detectedMimeType: string; sizeBytes: number }>,
): void {
  if (inspection.sizeBytes !== declaration.expectedSizeBytes) {
    throw new PrivateUploadValidationError("SIZE_MISMATCH");
  }
  if (inspection.detectedMimeType !== declaration.declaredMimeType) {
    throw new PrivateUploadValidationError("DETECTED_MIME_MISMATCH");
  }
  const extensions = allowedTypes[inspection.detectedMimeType];
  if (extensions === undefined || !extensions.includes(extname(declaration.filename).toLowerCase())) {
    throw new PrivateUploadValidationError("DETECTED_EXTENSION_MISMATCH");
  }
}

export function createOpaquePrivateObjectKey(opaqueId: string): string {
  if (!/^[A-Za-z0-9_-]{22,128}$/u.test(opaqueId)) {
    throw new PrivateUploadValidationError("INVALID_OPAQUE_ID");
  }
  return `private/${opaqueId}`;
}
