import "server-only";

import { randomUUID } from "node:crypto";

export const DEFAULT_JSON_BODY_LIMIT_BYTES = 64 * 1024;

const requestIdPattern = /^[a-zA-Z0-9_-]{8,64}$/u;

export class ApiRequestError extends Error {
  constructor(
    readonly code: "CONTENT_TYPE_REQUIRED" | "PAYLOAD_TOO_LARGE" | "INVALID_JSON",
    readonly status: 400 | 413 | 415,
  ) {
    super(code);
    this.name = "ApiRequestError";
  }
}

export function getRequestId(request: Request): string {
  const provided = request.headers.get("x-request-id") ?? "";
  return requestIdPattern.test(provided) ? provided : randomUUID();
}

export async function parseBoundedJson(
  request: Request,
  maximumBytes = DEFAULT_JSON_BODY_LIMIT_BYTES,
): Promise<unknown> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    throw new TypeError("maximumBytes must be a positive safe integer");
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new ApiRequestError("CONTENT_TYPE_REQUIRED", 415);
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0 || parsedLength > maximumBytes) {
      throw new ApiRequestError("PAYLOAD_TOO_LARGE", 413);
    }
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const reader = request.body?.getReader();
  if (reader !== undefined) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > maximumBytes) {
          await reader.cancel().catch(() => undefined);
          throw new ApiRequestError("PAYLOAD_TOO_LARGE", 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  try {
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new ApiRequestError("INVALID_JSON", 400);
  }
}

export function noStoreJson(
  body: unknown,
  options: Readonly<{ status?: number; requestId?: string; headers?: HeadersInit }> = {},
): Response {
  const headers = new Headers(options.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  if (options.requestId) headers.set("X-Request-Id", options.requestId);
  return new Response(JSON.stringify(body), { status: options.status ?? 200, headers });
}

export function publicApiError(
  code: string,
  status: number,
  requestId: string,
): Response {
  return noStoreJson({ error: { code }, requestId }, { status, requestId });
}
