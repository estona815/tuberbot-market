import "server-only";
import { z } from "zod";
import { actionSchema, appendWorkspaceCommand, deriveWorkspace, newWorkspace, workspaceDocumentSchema, WorkspaceError } from "@/domain/workspace";
import { authenticateSessionRequest, requireSessionRequestCsrf } from "./auth/runtime";
import { ApiRequestError, getRequestId, noStoreJson, parseBoundedJson, publicApiError } from "./api-envelope";
import { getDatabase } from "./db/client";
import { consumeServiceLimit } from "./service-limits";
const requestSchema = z.strictObject({ key: z.string().uuid(), expectedRevision: z.number().int().min(0).max(200), action: actionSchema });
const createSchema = z.strictObject({ creatorUserId: z.string().uuid() });
class HttpFailure extends Error { constructor(readonly status: number, readonly code: string) { super(code); } }
async function identity(request: Request, write: boolean) {
  if (process.env.ENABLE_CONNECTED_WORKSPACE !== "true") throw new HttpFailure(503, "CONNECTED_WORKSPACE_NOT_ENABLED");
  const auth = await authenticateSessionRequest(request);
  if (!auth || auth.session.authMethod !== "EXTERNAL_PROVIDER") throw new HttpFailure(401, "EXTERNAL_LOGIN_REQUIRED");
  if (write) {
    try { requireSessionRequestCsrf(request, auth); } catch { throw new HttpFailure(403, "CSRF_REJECTED"); }
    if (!await consumeServiceLimit(`workspace-write:${auth.actor.userId}`, 120, 60)) throw new HttpFailure(429, "RATE_LIMITED");
  }
  return auth;
}
async function respond(request: Request, fn: () => Promise<Response>): Promise<Response> {
  try { return await fn(); }
  catch (error) {
    if (error instanceof HttpFailure) return publicApiError(error.code, error.status, getRequestId(request));
    if (error instanceof WorkspaceError) return noStoreJson({ error: { code: error.code, message: error.message } }, { status: 409, requestId: getRequestId(request) });
    if (error instanceof z.ZodError) return publicApiError("INVALID_INPUT", 400, getRequestId(request));
    if (error instanceof ApiRequestError) return publicApiError(error.code, error.status, getRequestId(request));
    return publicApiError("WORKSPACE_UNAVAILABLE", 503, getRequestId(request));
  }
}
export function listProjects(request: Request): Promise<Response> {
  return respond(request, async () => {
    const auth = await identity(request, false), sql = getDatabase().queryClient;
    if (!await consumeServiceLimit(`workspace-read:${auth.actor.userId}`, 120, 60)) throw new HttpFailure(429, "RATE_LIMITED");
    const rows = await sql<{ document: unknown; advertiser_id: string; creator_id: string }[]>`SELECT document, advertiser_id, creator_id FROM workspace_projects WHERE advertiser_id = ${auth.actor.userId} OR creator_id = ${auth.actor.userId} ORDER BY updated_at DESC, id LIMIT 31`;
    return noStoreJson({ mode: "SERVER_SANDBOX", userId: auth.actor.userId, projects: rows.slice(0, 30).map((row) => ({ document: workspaceDocumentSchema.parse(row.document), role: row.advertiser_id === auth.actor.userId ? "ADVERTISER" : "CREATOR" })), hasMore: rows.length > 30 });
  });
}
export function createProject(request: Request): Promise<Response> {
  return respond(request, async () => {
    const auth = await identity(request, true);
    if (!auth.actor.roles.includes("ADVERTISER") && !auth.actor.roles.includes("AGENCY")) throw new HttpFailure(403, "ADVERTISER_REQUIRED");
    const input = createSchema.parse(await parseBoundedJson(request, 2048));
    const key = z.string().uuid().parse(request.headers.get("idempotency-key"));
    if (input.creatorUserId === auth.actor.userId) throw new HttpFailure(400, "DISTINCT_PARTIES_REQUIRED");
    const sql = getDatabase().queryClient;
    const document = await sql.begin(async (tx) => {
      const self = await tx<{ display_name: string }[]>`SELECT display_name FROM users WHERE id = ${auth.actor.userId} AND status = 'ACTIVE' AND deleted_at IS NULL FOR UPDATE`;
      if (!self[0]) throw new HttpFailure(401, "ACCOUNT_UNAVAILABLE");
      const existing = await tx<{ document: unknown; creator_id: string; advertiser_id: string }[]>`SELECT document, creator_id, advertiser_id FROM workspace_projects WHERE id = ${key}`;
      if (existing[0]) {
        if (existing[0].advertiser_id !== auth.actor.userId || existing[0].creator_id !== input.creatorUserId) throw new HttpFailure(409, "IDEMPOTENCY_CONFLICT");
        return workspaceDocumentSchema.parse(existing[0].document);
      }
      const count = await tx<{ total: number }[]>`SELECT count(*)::int AS total FROM workspace_projects WHERE advertiser_id = ${auth.actor.userId}`;
      if ((count[0]?.total ?? 30) >= 30) throw new HttpFailure(409, "PROJECT_LIMIT");
      const creator = await tx<{ display_name: string }[]>`SELECT u.display_name FROM users u WHERE u.id = ${input.creatorUserId} AND u.status = 'ACTIVE' AND u.deleted_at IS NULL AND EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'CREATOR' AND r.revoked_at IS NULL) LIMIT 1`;
      if (!creator[0]) throw new HttpFailure(404, "CREATOR_ACCOUNT_NOT_FOUND");
      const doc = newWorkspace({ id: key, mode: "SERVER_SANDBOX", advertiserLabel: self[0].display_name, creatorLabel: creator[0].display_name, createdAt: new Date().toISOString(), feeBps: 1200 });
      await tx`INSERT INTO workspace_projects (id, advertiser_id, creator_id, document) VALUES (${key}, ${auth.actor.userId}, ${input.creatorUserId}, ${JSON.stringify(doc)}::jsonb)`;
      return doc;
    });
    return noStoreJson({ document }, { status: 201, requestId: getRequestId(request) });
  });
}
export function projectCommand(request: Request, id: string): Promise<Response> {
  return respond(request, async () => {
    z.string().uuid().parse(id);
    const auth = await identity(request, true), input = requestSchema.parse(await parseBoundedJson(request, 8192));
    const sql = getDatabase().queryClient;
    const result = await sql.begin(async (tx) => {
      const rows = await tx<{ document: unknown; advertiser_id: string; creator_id: string }[]>`SELECT document, advertiser_id, creator_id FROM workspace_projects WHERE id = ${id} AND (advertiser_id = ${auth.actor.userId} OR creator_id = ${auth.actor.userId}) FOR UPDATE`;
      const row = rows[0]; if (!row) throw new HttpFailure(404, "PROJECT_NOT_FOUND");
      const actor = row.advertiser_id === auth.actor.userId ? "ADVERTISER" : "CREATOR";
      const before = workspaceDocumentSchema.parse(row.document), command = { ...input, actor, at: new Date().toISOString() };
      const applied = await appendWorkspaceCommand(before, command);
      if (applied.replayed) return applied;
      await tx`UPDATE workspace_projects SET document = ${JSON.stringify(applied.document)}::jsonb, revision = ${applied.state.revision}, updated_at = now() WHERE id = ${id}`;
      await tx`INSERT INTO workspace_command_events (project_id, sequence, request_key, actor_id, command) VALUES (${id}, ${applied.state.revision}, ${input.key}, ${auth.actor.userId}, ${JSON.stringify(command)}::jsonb)`;
      if (applied.state.contract && !(await deriveWorkspace(before)).contract) await tx`INSERT INTO workspace_contract_records (project_id, version, snapshot, sha256) VALUES (${id}, ${applied.state.contract.version}, ${JSON.stringify(applied.state.contract)}::jsonb, ${applied.state.contract.sha256})`;
      return applied;
    });
    return noStoreJson(result, { requestId: getRequestId(request) });
  });
}
