import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { z } from "zod";
import { exchangeGoogleCode, verifyGoogleIdentity } from "@/providers/google-identity";
import { getDatabase } from "../db/client";
import { noStoreJson, parseBoundedJson, publicApiError, getRequestId } from "../api-envelope";
import { requireSameOrigin } from "../request-security";
import { consumeServiceLimit } from "../service-limits";
import { loadAuthRuntimeConfig } from "./config";
import { createAuthCookieHeaders } from "./cookies";
import { PostgresSessionRepository } from "./postgres-repository";
import { createOpaqueToken, digestToken } from "./token";
import { parseReturnTo } from "./return-to";
const COOKIE = "__Host-tb_google_flow";
const redirectPath = "/api/auth/google/callback";
const startSchema = z.strictObject({ role: z.enum(["ADVERTISER", "CREATOR"]), returnTo: z.string().max(2048).optional(), acceptedPolicies: z.literal(true) });
const flowSchema = z.object({ state: z.string().min(40).max(64), verifier: z.string().min(40).max(128), nonce: z.string().min(40).max(64), role: z.enum(["ADVERTISER", "CREATOR"]), returnTo: z.string(), terms: z.string(), privacy: z.string() });
function configuration() {
  const auth = loadAuthRuntimeConfig();
  if (process.env.ENABLE_GOOGLE_LOGIN !== "true" || !process.env.DATABASE_URL || !process.env.GOOGLE_OAUTH_CLIENT_ID?.endsWith(".apps.googleusercontent.com") || !process.env.GOOGLE_OAUTH_CLIENT_SECRET || !process.env.TERMS_VERSION || !process.env.PRIVACY_VERSION || process.env.LEGAL_REVIEW_CONFIRMED !== "true" || !auth.applicationOrigin.startsWith("https://")) throw new Error("External login not configured");
  return { auth, clientId: process.env.GOOGLE_OAUTH_CLIENT_ID, clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET, terms: process.env.TERMS_VERSION, privacy: process.env.PRIVACY_VERSION, redirectUri: `${auth.applicationOrigin}${redirectPath}`, key: createHash("sha256").update(`tuberbot-google-flow-v1:${auth.sessionHashPepper}`).digest() };
}
export function googleLoginConfigured(): boolean { try { configuration(); return true; } catch { return false; } }
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export async function startGoogleLogin(request: Request): Promise<Response> {
  try {
    const config = configuration();
    try { requireSameOrigin(request, config.auth.applicationOrigin); } catch { return publicApiError("ORIGIN_REJECTED", 403, getRequestId(request)); }
    const input = startSchema.parse(await parseBoundedJson(request, 4096));
    if (!await consumeServiceLimit("google-login:global", 300, 3600)) return publicApiError("RATE_LIMITED", 429, getRequestId(request));
    const flow = { state: randomBytes(32).toString("base64url"), verifier: randomBytes(32).toString("base64url"), nonce: randomBytes(32).toString("base64url"), role: input.role, returnTo: parseReturnTo(input.returnTo, "/account"), terms: config.terms, privacy: config.privacy };
    const encoded = await new EncryptJWT(flow).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setAudience("tuberbot-google-flow").setIssuedAt().setExpirationTime("10m").encrypt(config.key);
    const sql = getDatabase().queryClient;
    await sql`DELETE FROM oauth_login_flows WHERE expires_at < now() - interval '1 day'`;
    await sql`INSERT INTO oauth_login_flows(state_digest, expires_at) VALUES(${hash(flow.state)}, now() + interval '10 minutes')`;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", scope: "openid email profile", access_type: "online", prompt: "select_account", state: flow.state, nonce: flow.nonce, code_challenge: createHash("sha256").update(flow.verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
    const response = noStoreJson({ authorizationUrl: url.href });
    response.headers.append("Set-Cookie", `${COOKIE}=${encoded}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`);
    return response;
  } catch (error) {
    return publicApiError(error instanceof z.ZodError ? "INVALID_LOGIN_REQUEST" : "GOOGLE_LOGIN_UNAVAILABLE", error instanceof z.ZodError ? 400 : 503, getRequestId(request));
  }
}
export async function finishGoogleLogin(request: Request): Promise<Response> {
  const clearCookie = `${COOKIE}=; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
  try {
    const config = configuration(), url = new URL(request.url);
    if (url.searchParams.has("error")) throw new Error("Authorization declined");
    if (url.searchParams.get("iss") && url.searchParams.get("iss") !== "https://accounts.google.com") throw new Error("Issuer mismatch");
    const code = z.string().min(1).max(4096).parse(url.searchParams.get("code"));
    const cookies = (request.headers.get("cookie") ?? "").split(";").map((v) => v.trim()).filter((v) => v.startsWith(`${COOKIE}=`));
    if (cookies.length !== 1 || cookies[0]!.length > 4096) throw new Error("Flow cookie missing");
    const { payload } = await jwtDecrypt(cookies[0]!.slice(COOKIE.length + 1), config.key, { audience: "tuberbot-google-flow", keyManagementAlgorithms: ["dir"], contentEncryptionAlgorithms: ["A256GCM"], requiredClaims: ["exp", "iat"], maxTokenAge: "10m" });
    const flow = flowSchema.parse(payload);
    if (flow.state !== url.searchParams.get("state") || flow.terms !== config.terms || flow.privacy !== config.privacy) throw new Error("Flow binding failed");
    const sql = getDatabase().queryClient;
    const consumed = await sql`UPDATE oauth_login_flows SET consumed_at=now() WHERE state_digest=${hash(flow.state)} AND consumed_at IS NULL AND expires_at>now() RETURNING state_digest`;
    if (consumed.length !== 1) throw new Error("Login flow expired or already used");
    const token = await exchangeGoogleCode({ code, verifier: flow.verifier, clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri });
    const identity = await verifyGoogleIdentity(token, config.clientId, flow.nonce);
    const userId = await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`google:${identity.subject}`},0))`;
      const existing = await tx<{ user_id: string }[]>`SELECT user_id FROM external_identities WHERE provider='GOOGLE' AND subject=${identity.subject}`;
      if (existing[0]) return existing[0].user_id;
      // Do not automatically link by email: a verified subject is the identity key.
      const collision = await tx`SELECT id FROM users WHERE lower(email)=lower(${identity.email}) AND deleted_at IS NULL`;
      if (collision.length) throw new Error("Account linking requires explicit review");
      const id = randomUUID();
      await tx`INSERT INTO users(id,email,display_name) VALUES(${id},${identity.email},${identity.displayName})`;
      await tx`INSERT INTO external_identities(provider,subject,user_id) VALUES('GOOGLE',${identity.subject},${id})`;
      await tx`INSERT INTO user_roles(user_id,role,reason) VALUES(${id},${flow.role},${`Self-registration; terms=${flow.terms}; privacy=${flow.privacy}; no seller verification`})`;
      return id;
    });
    const repository = new PostgresSessionRepository(getDatabase());
    const registered = await repository.loadIdentity(userId);
    if (!registered.active) throw new Error("Account is inactive");
    const now = new Date(), policy = config.auth.sessionPolicy;
    const expires = new Date(now.getTime() + policy.tokenLifetimeMs);
    const sessionToken = createOpaqueToken(), csrfToken = createOpaqueToken();
    await repository.createSession({ userId, tokenDigest: digestToken(sessionToken,"session",config.auth.sessionHashPepper), csrfTokenDigest: digestToken(csrfToken,"csrf",config.auth.sessionHashPepper), authMethod: "EXTERNAL_PROVIDER", demoRole: null, rotatedFromSessionId: null, rotationGeneration: 0, expiresAt: expires, idleExpiresAt: new Date(now.getTime()+policy.idleLifetimeMs), absoluteExpiresAt: new Date(now.getTime()+policy.absoluteLifetimeMs), lastSeenAt: now, mfaVerifiedAt: null, createdAt: now, updatedAt: now });
    const response = new Response(null, { status: 303, headers: { Location: new URL(parseReturnTo(flow.returnTo,"/account"), config.auth.applicationOrigin).href, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    response.headers.append("Set-Cookie", clearCookie);
    for (const cookie of createAuthCookieHeaders(config.auth,sessionToken,csrfToken,expires,now)) response.headers.append("Set-Cookie",cookie);
    return response;
  } catch {
    // Never include codes, credentials, upstream token bodies or subject/email in error output.
    return new Response(null, { status: 303, headers: { Location: "/login?error=external_login_failed", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Set-Cookie": clearCookie } });
  }
}
