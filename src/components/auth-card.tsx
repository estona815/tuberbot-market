"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

type AuthCardProps = {
  mode: "login" | "signup";
  role?: string;
  returnTo?: string;
};

type SessionActor = {
  displayName?: string;
  role?: string;
};

type SessionState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "authenticated"; actor?: SessionActor }
  | { status: "unavailable" }
  | { status: "error"; message: string };

function safeReturnTo(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  const destination = new URL(value, window.location.origin);
  return destination.origin === window.location.origin
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : "/dashboard";
}

export function AuthCard({ mode, role, returnTo }: AuthCardProps) {
  const signup = mode === "signup";
  const nextPath = role === "creator" ? "/onboarding/creator" : role === "agency" ? "/onboarding/advertiser?type=agency" : "/onboarding/advertiser";
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [isEntering, startEntering] = useTransition();

  useEffect(() => {
    if (signup) {
      return;
    }

    const controller = new AbortController();
    void fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("session_lookup_failed");
        }

        const payload = (await response.json()) as {
          authenticated?: boolean;
          localDemoAvailable?: boolean;
          actor?: SessionActor;
        };

        if (payload.authenticated) {
          setSession({ status: "authenticated", actor: payload.actor });
        } else if (payload.localDemoAvailable) {
          setSession({ status: "ready" });
        } else {
          setSession({ status: "unavailable" });
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSession({ status: "error", message: "세션 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." });
        }
      });

    return () => controller.abort();
  }, [signup]);

  function enterLocalDemo(persona: "ADVERTISER" | "CREATOR") {
    setSession({ status: "ready" });
    startEntering(async () => {
      try {
        const response = await fetch("/api/auth/demo-session", {
          body: JSON.stringify({ persona, returnTo: returnTo ?? "/dashboard" }),
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json().catch(() => ({}))) as { returnTo?: unknown };

        if (!response.ok) {
          throw new Error("demo_session_failed");
        }

        window.location.assign(safeReturnTo(payload.returnTo));
      } catch {
        setSession({ status: "error", message: "로컬 데모 세션을 시작하지 못했습니다. 실행 환경 설정을 확인해 주세요." });
      }
    });
  }

  return (
    <div className="auth-page">
      <section className="auth-intro">
        <p>튜버봇 마켓</p>
        <h1>{signup ? "거래 역할을 선택하고 시작하세요." : "다시 만나서 반갑습니다."}</h1>
        <span>{signup ? "채널 인증과 광고 캠페인은 각 역할의 온보딩에서 이어집니다." : "계약, 검수와 지급 준비 상태를 한곳에서 확인하세요."}</span>
      </section>
      <section className="auth-card">
        <h2>{signup ? "온보딩 미리보기" : "로컬 데모 입장"}</h2>
        <p className="auth-card__notice">외부 인증이 연결되기 전의 로컬 전용 프리뷰입니다. 운영 계정이나 실제 개인정보를 입력하지 마세요.</p>
        {signup ? (
          <div className="role-options" aria-label="온보딩 역할">
            <Link className={role === "creator" ? "is-selected" : ""} href="/signup?role=creator"><strong>유튜버</strong><span>채널 인증 후 광고 상품을 등록해요.</span></Link>
            <Link className={role === "advertiser" || !role ? "is-selected" : ""} href="/signup?role=advertiser"><strong>광고주</strong><span>상품을 찾고 캠페인을 등록해요.</span></Link>
            <Link className={role === "agency" ? "is-selected" : ""} href="/signup?role=agency"><strong>광고대행사</strong><span>조직별 고객 캠페인을 관리해요.</span></Link>
          </div>
        ) : null}
        {signup ? (
          <Link className="button button--full auth-card__primary" href={nextPath}>선택한 역할의 화면 보기</Link>
        ) : (
          <div aria-live="polite" className="demo-session-state">
            {session.status === "loading" ? <p>로컬 데모 사용 가능 여부를 확인하고 있습니다.</p> : null}
            {session.status === "ready" ? (
              <div className="demo-session-actions">
                <button className="button button--full" disabled={isEntering} onClick={() => enterLocalDemo("ADVERTISER")} type="button">광고주 로컬 데모</button>
                <button className="button button--quiet button--full" disabled={isEntering} onClick={() => enterLocalDemo("CREATOR")} type="button">유튜버 로컬 데모</button>
                {isEntering ? <p>격리된 데모 세션을 준비하고 있습니다.</p> : null}
              </div>
            ) : null}
            {session.status === "authenticated" ? (
              <div className="demo-session-current">
                <p><strong>{session.actor?.displayName ?? "로컬 데모 사용자"}</strong> 세션이 활성화되어 있습니다.</p>
                <Link className="button button--full" href="/dashboard">대시보드로 이동</Link>
              </div>
            ) : null}
            {session.status === "unavailable" ? <p>이 배포 환경에서는 로컬 데모 로그인이 비활성화되어 있습니다.</p> : null}
            {session.status === "error" ? <p className="auth-card__error" role="alert">{session.message}</p> : null}
          </div>
        )}
        <p className="auth-switch">{signup ? "로컬 데모를 사용하시겠어요?" : "역할별 화면을 먼저 볼까요?"} <Link href={signup ? "/login" : "/signup"}>{signup ? "데모 입장" : "온보딩 보기"}</Link></p>
      </section>
    </div>
  );
}
