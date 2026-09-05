"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";
import s from "./workspace.module.css";
const statusSchema = z.object({ identityConfigured: z.boolean(), connectedWorkspaceConfigured: z.boolean(), youtubeConfigured: z.boolean() });
const actorSchema = z.object({ userId: z.string().uuid(), roles: z.array(z.string()) });
export function csrfHeader(): string {
  const values = document.cookie.split(";").map((v) => v.trim()).filter((v) => v.startsWith("tb_csrf="));
  if (values.length !== 1) throw new Error("세션 확인이 필요합니다. 다시 로그인하세요.");
  const token = values[0]!.slice("tb_csrf=".length);
  if (!/^[A-Za-z0-9_-]{43}$/u.test(token)) throw new Error("세션 확인이 필요합니다.");
  return token;
}
export function GoogleLogin({ configured, returnTo = "/account" }: { configured: boolean; returnTo?: string }) {
  const [role, setRole] = useState<"ADVERTISER" | "CREATOR">("ADVERTISER");
  const [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function login() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/google/start", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, returnTo, acceptedPolicies: accepted }) });
      const raw = z.object({ authorizationUrl: z.string().url() }).safeParse(await response.json());
      if (!response.ok || !raw.success) throw new Error("Google 연결을 시작하지 못했습니다. 운영 설정 또는 동의 항목을 확인하세요.");
      const url = new URL(raw.data.authorizationUrl);
      if (url.origin !== "https://accounts.google.com" || url.pathname !== "/o/oauth2/v2/auth") throw new Error("인증 주소를 확인하지 못했습니다.");
      window.location.assign(url.href);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "인증 오류"); setBusy(false); }
  }
  return <section className={s.flow} aria-label="Google 계정 로그인"><h2>운영 계정 연결</h2>{configured ? <><p className={s.helper}>Google 계정을 확인한 뒤 서버에서 광고주 또는 크리에이터 역할을 등록합니다. 크리에이터 등록은 채널 소유권·판매자 인증을 대신하지 않습니다.</p><label className={s.label}>처음 등록할 역할<select value={role} onChange={(e) => setRole(e.target.value as typeof role)}><option value="ADVERTISER">광고주</option><option value="CREATOR">크리에이터</option></select></label><label className={s.check}><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /><span><Link href="/terms" target="_blank">이용약관</Link>과 <Link href="/privacy" target="_blank">개인정보 처리방침</Link>을 확인하고 계정 생성에 동의합니다.</span></label><button className="button" type="button" disabled={!accepted || busy} onClick={() => void login()}>Google로 계속</button></> : <><div className={s.blocked}>운영 Google 로그인이 아직 연결되지 않았습니다.</div><p className={s.helper}>로그인 없이 광고 협업 검토판을 사용할 수 있습니다. 임시 비밀번호를 만들거나 실제 개인정보를 받지 않습니다.</p><Link className="button" href="/workspace">로그인 없이 협업 흐름 확인</Link></>}{error && <p className={s.error} role="alert">{error}</p>}</section>;
}
const channelSchema = z.object({ id: z.string().regex(/^UC[\w-]{22}$/u), title: z.string(), description: z.string(), subscribers: z.string().nullable(), views: z.string().nullable(), videos: z.string().nullable(), observedAt: z.string(), youtubeUrl: z.string().url(), ownershipVerified: z.literal(false), rateEstimate: z.null() });
export function AccountPanel() {
  const [status, setStatus] = useState<z.infer<typeof statusSchema> | null>(null);
  const [actor, setActor] = useState<z.infer<typeof actorSchema> | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [input, setInput] = useState("");
  const [channel, setChannel] = useState<z.infer<typeof channelSchema> | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/release-status", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("연결 상태를 확인하지 못했습니다.");
        const capabilities = statusSchema.parse(await response.json()); setStatus(capabilities);
        if (capabilities.identityConfigured) {
          const session = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
          if (!session.ok) throw new Error("세션 확인에 실패했습니다. 로그인 상태를 확인하세요.");
          const body = z.object({ authenticated: z.boolean(), actor: actorSchema.optional() }).parse(await session.json());
          setActor(body.authenticated && body.actor ? body.actor : null);
        }
      } catch (caught) { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "연결 오류"); }
    })();
    return () => controller.abort();
  }, []);
  async function lookup() {
    setBusy(true); setError(""); setChannel(null);
    try {
      const response = await fetch(`/api/channels/lookup?${new URLSearchParams({ channel: input })}`, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 404 ? "해당 채널을 찾지 못했습니다." : response.status === 429 ? "조회 한도에 도달했습니다. 나중에 다시 확인하세요." : "채널 조회에 실패했습니다. 로그인·입력 주소·운영 API 연결을 확인하세요.");
      const body = z.object({ channel: channelSchema }).parse(await response.json()); setChannel(body.channel);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "조회 오류"); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin", headers: { "x-csrf-token": csrfHeader() } });
      if (!response.ok) throw new Error("로그아웃을 완료하지 못했습니다.");
      setActor(null); setChannel(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "로그아웃 오류"); }
    finally { setBusy(false); }
  }
  return <div className={`page-shell ${s.workspace}`}><header className={s.heading}><div><h1>계정·채널 연결</h1><p>계정 인증과 채널 원본 정보 조회를 분리해서 관리합니다.</p></div><Link className="button button--secondary button--small" href="/launch">연결 현황</Link></header>{error && <p role="alert" className={s.error}>{error}</p>}{!status && !error && <p role="status">운영 연결을 확인하고 있습니다.</p>}{status && <div className={s.columns}><section>{actor ? <><h2>계정이 연결되어 있습니다.</h2><dl className={s.summary}><div><dt>내 계정 ID</dt><dd>{actor.userId}</dd></div><div><dt>등록 역할</dt><dd>{actor.roles.join(", ")}</dd></div></dl><p className={s.helper}>서버 협업의 당사자는 이 계정 ID로 연결됩니다. 계정 ID를 아는 것만으로 주문 내용에 접근할 수는 없습니다.</p><div className={s.actions}><Link className="button" href="/workspace/connected">서버 협업 열기</Link><button className="button button--secondary" type="button" disabled={busy} onClick={() => void logout()}>로그아웃</button></div></> : <GoogleLogin configured={status.identityConfigured} />}</section><section><h2>YouTube 채널 원본 조회</h2><p className={s.helper}>공식 API에서 조회한 구독자·조회수·영상 수와 확인 시각을 보여줍니다. 채널 소유권 인증이나 예상 광고비는 제공하지 않습니다.</p>{!status.youtubeConfigured && <p className={s.blocked}>운영 YouTube API 연결 필요</p>}<form onSubmit={(e) => { e.preventDefault(); void lookup(); }}><label className={s.label}>채널 ID 또는 @핸들<input value={input} onChange={(e) => setInput(e.target.value)} maxLength={300} placeholder="@channel 또는 UC..." disabled={!actor || !status.youtubeConfigured || busy} /></label><button className="button button--secondary" type="submit" disabled={!actor || !status.youtubeConfigured || busy}>채널 조회</button></form>{channel && <div className={s.delivery}><h3>{channel.title}</h3><dl className={s.summary}>{[["구독자", channel.subscribers], ["조회수",channel.views], ["영상 수",channel.videos]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value ? BigInt(value).toLocaleString("ko-KR") : "공개되지 않음"}</dd></div>)}</dl><p>{channel.description.slice(0,400)}</p><p className={s.helper}>YouTube Data API · {new Date(channel.observedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST<br />소유권 미인증 · 수치를 지속 보관하지 않습니다.</p><a href={`https://www.youtube.com/channel/${channel.id}`} rel="noopener noreferrer" target="_blank">YouTube에서 확인 ↗</a></div>}</section></div>}</div>;
}
