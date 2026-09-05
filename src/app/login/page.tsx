import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { GoogleLogin } from "@/components/workspace/account-panel";
import { releaseStatus } from "@/lib/server/release-status";
export const metadata: Metadata = { title: "로그인", robots: { index: false, follow: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; error?: string }> }) {
  const { returnTo, error } = await searchParams;
  const status = releaseStatus();
  const local = process.env.NODE_ENV === "development" && process.env.ENABLE_LOCAL_DEMO_AUTH === "true";
  return <>{local ? <AuthCard mode="login" returnTo={returnTo} /> : <div className="page-shell"><h1>튜버봇 로그인</h1>{error === "external_login_failed" && <p role="alert">Google 인증을 완료하지 못했습니다. 인증을 다시 시작하거나 운영 연결 상태를 확인하세요.</p>}<GoogleLogin configured={status.identityConfigured} returnTo={returnTo} /></div>}</>;
}
