import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
const GOOGLE_KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"), { timeoutDuration: 10000 });
export type GoogleIdentity = { subject: string; email: string; displayName: string };
export async function verifyGoogleIdentity(idToken: string, clientId: string, nonce: string, keys: JWTVerifyGetKey = GOOGLE_KEYS): Promise<GoogleIdentity> {
  if (idToken.length > 16384 || !nonce) throw new Error("Invalid identity response");
  const { payload } = await jwtVerify(idToken, keys, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: clientId, algorithms: ["RS256"], requiredClaims: ["sub", "iat", "exp", "nonce", "email", "email_verified"], maxTokenAge: "10m", clockTolerance: 5 });
  if (payload.nonce !== nonce || (payload.azp !== undefined && payload.azp !== clientId) || (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== clientId)) throw new Error("Identity binding failed");
  if (typeof payload.sub !== "string" || !/^[A-Za-z0-9_-]{1,255}$/u.test(payload.sub) || payload.email_verified !== true || typeof payload.email !== "string" || payload.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(payload.email)) throw new Error("Verified identity required");
  const displayName = typeof payload.name === "string" ? payload.name.trim().replace(/[\u0000-\u001f\u007f]/gu, "").slice(0, 80) : "튜버봇 사용자";
  return { subject: payload.sub, email: payload.email, displayName: displayName || "튜버봇 사용자" };
}
export async function exchangeGoogleCode(input: { code: string; verifier: string; clientId: string; clientSecret: string; redirectUri: string }, request: typeof fetch = fetch): Promise<string> {
  const response = await request("https://oauth2.googleapis.com/token", { method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(12000), headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code: input.code, code_verifier: input.verifier, client_id: input.clientId, client_secret: input.clientSecret, redirect_uri: input.redirectUri, grant_type: "authorization_code" }) });
  if (!response.ok) throw new Error("Google token exchange failed");
  const text = await response.text();
  if (text.length > 64000) throw new Error("Identity response too large");
  const body: unknown = JSON.parse(text);
  if (!body || typeof body !== "object" || !("id_token" in body) || typeof body.id_token !== "string") throw new Error("ID token missing");
  return body.id_token;
}
