import "server-only";

import { extname } from "node:path";

const allowedTypes: Readonly<Record<string, readonly string[]>> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "application/pdf": [".pdf"],
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
};

export const MAX_PRIVATE_UPLOAD_BYTES = 250 * 1024 * 1024;

export function validatePrivateUpload(input: Readonly<{ name: string; declaredMime: string; detectedMime: string; sizeBytes: number }>): void {
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > MAX_PRIVATE_UPLOAD_BYTES) throw new Error("Upload size is not allowed");
  const extensions = allowedTypes[input.detectedMime];
  if (!extensions || input.declaredMime !== input.detectedMime) throw new Error("Upload MIME type is not allowed");
  const extension = extname(input.name).toLowerCase();
  if (!extensions.includes(extension)) throw new Error("Upload extension does not match content");
  if (input.name.includes("\0") || input.name.includes("/") || input.name.includes("\\")) throw new Error("Upload filename is not allowed");
}

export function createPrivateObjectKey(input: Readonly<{ orderId: string; attachmentId: string; extension: string }>): string {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(input.orderId) || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.attachmentId)) throw new Error("Invalid object identifier");
  if (!/^\.[a-z0-9]{1,8}$/.test(input.extension)) throw new Error("Invalid object extension");
  return `private/orders/${input.orderId}/attachments/${input.attachmentId}${input.extension}`;
}
