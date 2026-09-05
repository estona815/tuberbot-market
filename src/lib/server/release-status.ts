import "server-only";
/** Configuration visibility is not proof that an external integration has been verified. */
export function releaseStatus(env: NodeJS.ProcessEnv = process.env) {
  const databaseConfigured = Boolean(env.DATABASE_URL);
  const identityConfigured = env.ENABLE_GOOGLE_LOGIN === "true" && databaseConfigured && Boolean(env.GOOGLE_OAUTH_CLIENT_ID?.endsWith(".apps.googleusercontent.com") && env.GOOGLE_OAUTH_CLIENT_SECRET && env.SESSION_HASH_PEPPER && env.SESSION_HASH_PEPPER.length >= 32 && env.APP_ORIGIN?.startsWith("https://") && env.TERMS_VERSION && env.PRIVACY_VERSION && env.LEGAL_REVIEW_CONFIRMED === "true");
  return {
    release: "2026-09-05-review-v2", mode: "PUBLIC_REVIEW" as const,
    localWorkspace: true, rateStudio: true,
    identityConfigured,
    connectedWorkspaceConfigured: identityConfigured && env.ENABLE_CONNECTED_WORKSPACE === "true",
    youtubeConfigured: identityConfigured && env.ENABLE_YOUTUBE_LOOKUP === "true" && Boolean(env.YOUTUBE_API_KEY) && env.YOUTUBE_POLICY_REVIEW_CONFIRMED === "true",
    livePayments: false, livePayouts: false,
    termsVersion: env.LEGAL_REVIEW_CONFIRMED === "true" ? env.TERMS_VERSION ?? null : null,
    privacyVersion: env.LEGAL_REVIEW_CONFIRMED === "true" ? env.PRIVACY_VERSION ?? null : null,
    externalVerification: "NOT_ATTESTED" as const,
  };
}
