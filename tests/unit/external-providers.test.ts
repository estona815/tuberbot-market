import { generateKeyPair, SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import { exchangeGoogleCode, verifyGoogleIdentity } from "@/providers/google-identity";
import { lookupYouTubeChannel, parseYouTubeChannelInput } from "@/providers/youtube";
describe("Google identity validation", () => {
  it("validates signatures, issuer, audience, nonce and verified email", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const token = await new SignJWT({ nonce: "nonce-for-test", email: "a@example.com", email_verified: true, name: "테스트" }).setProtectedHeader({ alg: "RS256" }).setSubject("subject-123").setIssuer("https://accounts.google.com").setAudience("client-test").setIssuedAt().setExpirationTime("5m").sign(privateKey);
    const identity = await verifyGoogleIdentity(token,"client-test","nonce-for-test",async () => publicKey);
    expect(identity.subject).toBe("subject-123");
    await expect(verifyGoogleIdentity(token,"wrong-client","nonce-for-test",async () => publicKey)).rejects.toThrow();
    await expect(verifyGoogleIdentity(token,"client-test","wrong-nonce",async () => publicKey)).rejects.toThrow();
    const other = await generateKeyPair("RS256");
    await expect(verifyGoogleIdentity(token,"client-test","nonce-for-test",async () => other.publicKey)).rejects.toThrow();
  });
  it.each([false, "true", undefined])("rejects unverified email %s", async (email_verified) => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const token = await new SignJWT({ nonce: "n", email: "a@example.com", email_verified }).setProtectedHeader({ alg: "RS256" }).setSubject("123").setIssuer("https://accounts.google.com").setAudience("c").setIssuedAt().setExpirationTime("5m").sign(privateKey);
    await expect(verifyGoogleIdentity(token,"c","n",async () => publicKey)).rejects.toThrow();
  });
  it("sends PKCE only to the fixed HTTPS token endpoint, rejects tokenless response", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id_token: "test-token" }), { status: 200 }));
    expect(await exchangeGoogleCode({ code: "test-code", verifier: "verifier", clientId: "c", clientSecret: "secret", redirectUri: "https://example.com/callback" },request)).toBe("test-token");
    expect(request.mock.calls[0]?.[0]).toBe("https://oauth2.googleapis.com/token");
    expect(String(request.mock.calls[0]?.[1]?.body)).toContain("code_verifier=verifier");
    request.mockResolvedValue(new Response("{}"));
    await expect(exchangeGoogleCode({ code: "c", verifier: "v", clientId: "c", clientSecret: "s", redirectUri: "https://example.com" },request)).rejects.toThrow();
  });
});
describe("YouTube raw channel lookup", () => {
  it("parses IDs and handles without fetching arbitrary URLs", () => {
    expect(parseYouTubeChannelInput("UC1234567890123456789012")).toEqual({ kind: "id", value: "UC1234567890123456789012" });
    expect(parseYouTubeChannelInput("https://www.youtube.com/@테스트핸들")).toEqual({ kind: "forHandle", value: "@테스트핸들" });
  });
  it.each(["https://youtube.com.evil.test/@test", "https://127.0.0.1", "javascript:alert(1)", "https://u:p@youtube.com/@test", "https://youtube.com/watch?v=abcdefghijk", "not a handle"])("rejects unsafe lookup %s", (input) => { expect(() => parseYouTubeChannelInput(input)).toThrow(); });
  it("returns raw source data with timestamp and no rate estimate or ownership claim", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ items: [{ id: "UC1234567890123456789012", snippet: { title: "검증 채널", description: "설명" }, statistics: { hiddenSubscriberCount: false, subscriberCount: "123000", viewCount: "500000" } }] })));
    const result = await lookupYouTubeChannel("@testing", "test-key-not-real", request);
    expect(result?.subscribers).toBe("123000"); expect(result?.rateEstimate).toBeNull(); expect(result?.ownershipVerified).toBe(false);
    expect(new URL(String(request.mock.calls[0]?.[0])).hostname).toBe("www.googleapis.com");
  });
  it("does not reconstruct hidden subscriber counts or fall back to invented data", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ items: [{ id: "UC1234567890123456789012", snippet: { title: "T", description: "" }, statistics: { hiddenSubscriberCount: true, subscriberCount: "1000" } }] })));
    expect((await lookupYouTubeChannel("@testing", "test-key-not-real", request))?.subscribers).toBeNull();
    request.mockResolvedValue(new Response(JSON.stringify({ items: [] })));
    expect(await lookupYouTubeChannel("@testing", "test-key-not-real", request)).toBeNull();
    request.mockResolvedValue(new Response("{}", { status: 403 }));
    await expect(lookupYouTubeChannel("@testing", "test-key-not-real", request)).rejects.toThrow();
  });
});
