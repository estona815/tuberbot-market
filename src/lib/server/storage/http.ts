import "server-only";

import { z } from "zod";

import { AuthorizationError } from "@/lib/server/authorization";
import { ApiRequestError, getRequestId, noStoreJson, parseBoundedJson, publicApiError } from "@/lib/server/api-envelope";
import { UnsafeRequestError, requireIdempotencyHeader, requireSameOrigin } from "@/lib/server/request-security";
import { ProviderConfigurationError } from "@/providers/errors";
import { StorageStateError, StorageValidationError } from "@/providers/storage";

import { PrivateUploadConflictError, PrivateUploadNotFoundError, PrivateUploadUnavailableError, PrivateUploadValidationError } from "./errors";
import type { PrivateUploadService } from "./private-upload-service";

const initiateSchema = z
  .object({
    orderId: z.uuid(),
    filename: z.string().min(1).max(255),
    declaredMimeType: z.string().min(1).max(100),
    expectedSizeBytes: z.number().int().positive(),
  })
  .strict();

const completeSchema = z.object({ attachmentId: z.uuid() }).strict();

export class UploadAuthenticationError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "UploadAuthenticationError";
  }
}

export interface UploadHttpDependencies {
  readonly applicationOrigin: string;
  readonly service: PrivateUploadService;
  readonly authenticate: (request: Request) => Promise<Readonly<{ userId: string }>>;
  readonly verifyCsrf: (
    request: Request,
    actor: Readonly<{ userId: string }>,
  ) => Promise<boolean>;
}

async function requireMutationActor(
  request: Request,
  dependencies: UploadHttpDependencies,
): Promise<Readonly<{ userId: string }>> {
  requireSameOrigin(request, dependencies.applicationOrigin);
  const actor = await dependencies.authenticate(request);
  if (!request.headers.has("x-csrf-token") || !(await dependencies.verifyCsrf(request, actor))) {
    throw new UnsafeRequestError("CSRF validation failed");
  }
  return actor;
}

function errorResponse(error: unknown, requestId: string): Response {
  if (error instanceof ApiRequestError) return publicApiError(error.code, error.status, requestId);
  if (error instanceof UploadAuthenticationError) return publicApiError("AUTHENTICATION_REQUIRED", 401, requestId);
  if (error instanceof UnsafeRequestError) return publicApiError("REQUEST_REJECTED", 403, requestId);
  if (error instanceof AuthorizationError || error instanceof PrivateUploadNotFoundError) {
    return publicApiError("UPLOAD_NOT_FOUND", 404, requestId);
  }
  if (error instanceof PrivateUploadConflictError) return publicApiError(error.code, 409, requestId);
  if (error instanceof PrivateUploadUnavailableError) return publicApiError(error.code, 423, requestId);
  if (error instanceof PrivateUploadValidationError) {
    return publicApiError(error.code, error.code === "INVALID_SIZE" ? 413 : 400, requestId);
  }
  if (error instanceof StorageValidationError) return publicApiError("UPLOAD_REJECTED", 400, requestId);
  if (error instanceof StorageStateError) return publicApiError("UPLOAD_UNAVAILABLE", 423, requestId);
  if (error instanceof ProviderConfigurationError) return publicApiError("STORAGE_UNAVAILABLE", 503, requestId);
  if (error instanceof z.ZodError || error instanceof TypeError || error instanceof SyntaxError) {
    return publicApiError("INVALID_REQUEST", 400, requestId);
  }
  return publicApiError("INTERNAL_ERROR", 500, requestId);
}

export async function handleInitiateUpload(request: Request, dependencies: UploadHttpDependencies): Promise<Response> {
  const requestId = getRequestId(request);
  try {
    const idempotencyKey = requireIdempotencyHeader(request);
    const actor = await requireMutationActor(request, dependencies);
    const body = initiateSchema.parse(await parseBoundedJson(request));
    const result = await dependencies.service.initiate({
      actorId: actor.userId,
      idempotencyKey,
      ...body,
    });
    return noStoreJson({ upload: result, requestId }, { status: 201, requestId });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function handleCompleteUpload(request: Request, dependencies: UploadHttpDependencies): Promise<Response> {
  const requestId = getRequestId(request);
  try {
    const idempotencyKey = requireIdempotencyHeader(request);
    const actor = await requireMutationActor(request, dependencies);
    const body = completeSchema.parse(await parseBoundedJson(request));
    const result = await dependencies.service.complete({
      actorId: actor.userId,
      attachmentId: body.attachmentId,
      idempotencyKey,
    });
    return noStoreJson({ upload: result, requestId }, { status: 202, requestId });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function handleCreateDownload(
  request: Request,
  attachmentId: string,
  dependencies: UploadHttpDependencies,
): Promise<Response> {
  const requestId = getRequestId(request);
  try {
    const parsedAttachmentId = z.uuid().parse(attachmentId);
    const actor = await dependencies.authenticate(request);
    const grant = await dependencies.service.createDownload({ actorId: actor.userId, attachmentId: parsedAttachmentId });
    return noStoreJson({ download: grant, requestId }, { requestId });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
