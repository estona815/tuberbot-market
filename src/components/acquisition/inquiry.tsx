"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { budgetFromQuery, budgetQuery, budgetText, campaignBudget, CATEGORY_LABELS, FORMAT_LABELS, inquirySchema, LEAD_FORM, LEAD_HOST, PRIVACY_VERSION, USAGE_LABELS } from "@/domain/campaign-budget";
import { getLegacyCreatorById } from "@/lib/creator-data";
import { BudgetAmount, saveText } from "./budget-calculator";
import s from "./acquisition.module.css";
export function InquiryPrivacy({ expanded=false }: { expanded?: boolean }) {
  return <details className={s.privacy} open={expanded || undefined}><summary>개인정보 수집·이용 및 해외 저장 안내</summary><p>문의 접수 운영자: 권준 · 문의·삭제 요청: <a href="mailto:kwonj0815@gmail.com">kwonj0815@gmail.com</a>. 수집 항목은 브랜드명, 회신 이메일, 캠페인 목표, 문의 내용과 기획 조건입니다. 광고 문의 처리와 회신 목적으로만 사용하며 마케팅 수신 동의로 사용하지 않습니다.</p><p>문의 자료는 접수 후 최대 90일 동안 보관한 뒤 운영자가 삭제합니다. 그 전에 삭제를 요청할 수 있습니다. 동의를 거부할 수 있지만 온라인 문의 접수는 이용할 수 없습니다. 연락처가 필요 없는 예산 계산과 기획안 저장은 계속 이용할 수 있습니다.</p><p>해외 저장: Netlify, Inc.의 미국 소재 시스템에 문의 제출 시 암호화 통신으로 위 항목이 전달되어 폼 접수·호스팅을 위해 저장됩니다. 보관 기간은 위 문의 자료 보관 기간과 같습니다. 해외 저장 동의를 거부하면 이메일 문의 또는 기획안 파일 이용이 가능합니다. Netlify 개인정보 문의: privacy@netlify.com.</p><p>주민등록번호, 금융정보, 비밀번호, 건강정보 등 민감한 정보는 적지 마세요. 상담 내용은 선택한 유튜버에게 자동 전달되지 않습니다.</p></details>;
}
export function InquiryPage() {
  const params = useSearchParams();
  const result = campaignBudget(budgetFromQuery(new URLSearchParams(params.toString())));
  const channelId = params.get("channel");
  const channel = channelId ? getLegacyCreatorById(channelId) : undefined;
  const [brand,setBrand] = useState(""), [email,setEmail] = useState(""), [goal,setGoal] = useState<"awareness" | "sales" | "app" | "other">("awareness"), [message,setMessage] = useState("");
  const [privacy,setPrivacy] = useState(false), [transfer,setTransfer] = useState(false);
  const [busy,setBusy] = useState(false), [sent,setSent] = useState(false), [error,setError] = useState("");
  const lock = useRef(false), requestId = useRef<string | null>(null);
  const enabled = process.env.NEXT_PUBLIC_INQUIRY_ENABLED === "true";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || sent) return;
    const form = event.currentTarget;
    setError("");
    try {
      const input = inquirySchema.parse({ brand,email,goal,message,privacyConsent:privacy,transferConsent:transfer });
      if (!enabled) throw new Error("이 실행 환경은 문의 접수에 연결되지 않았습니다. 공개 사이트의 문의 페이지 또는 이메일을 이용하세요.");
      if (String(new FormData(form).get("company-website") ?? "")) throw new Error("입력 내용을 확인해 주세요.");
      lock.current = true; setBusy(true);
      requestId.current ??= crypto.randomUUID();
      const values: Record<string,string> = {
        "form-name": LEAD_FORM, "company-website":"", "request-id":requestId.current,
        brand:input.brand, email:input.email, goal:input.goal, message:input.message,
        "planning-summary":budgetText(result,channel?.name), "planning-model":result.model,
        "channel-id":channel?.legacyId ?? "", "privacy-consent":"yes", "transfer-consent":"yes", "privacy-version":PRIVACY_VERSION,
      };
      if (window.location.hostname !== LEAD_HOST) {
        // Native cross-origin form navigation, not an unsafe CORS proxy or a fabricated local receipt.
        const target = document.createElement("form"); target.method="POST"; target.action=`https://${LEAD_HOST}/inquiry-received.html`;
        for (const [name,value] of Object.entries(values)) { const field=document.createElement("input"); field.type="hidden"; field.name=name; field.value=value; target.append(field); }
        document.body.append(target); target.submit(); target.remove();
        return;
      }
      const response = await fetch("/inquiry-received.html", { method:"POST", credentials:"same-origin", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body:new URLSearchParams(values).toString(), signal:AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error("전송을 완료하지 못했습니다. 입력 내용은 유지되어 있습니다. 잠시 후 다시 시도하세요.");
      setSent(true); setBrand(""); setEmail(""); setMessage("");
    } catch (caught) { setError(caught instanceof z.ZodError ? caught.issues[0]?.message ?? "입력 내용을 확인하세요." : caught instanceof Error ? caught.message : "전송을 완료하지 못했습니다."); }
    finally { lock.current=false; setBusy(false); }
  }
  return <div className={s.scope} data-testid="inquiry-page"><div className={s.wrap}>
    <header className={s.title}><h1>어떤 광고를 준비하고 있나요?</h1><p>브랜드와 목표를 남겨 주세요. 계산한 예산과 관심 채널도 함께 전달됩니다.</p></header>
    {sent ? <section className={s.success} role="status"><h2>광고 문의를 전송했습니다.</h2><p>튜버봇 운영팀에서 문의 내용을 확인할 수 있습니다. 답변은 입력한 이메일로 안내하며, 이 단계에서 결제나 채널 예약은 발생하지 않습니다.</p><div className={s.actions}><Link className={s.primary} href="/search">다른 채널 둘러보기</Link><Link className={s.secondary} href="/">홈으로</Link></div></section> : <div className={s.inquiryLayout}>
      <form name={LEAD_FORM} method="POST" action={`https://${LEAD_HOST}/inquiry-received.html`} onSubmit={(event) => void submit(event)} noValidate className={s.config}>
        <input type="hidden" name="form-name" value={LEAD_FORM} />
        <label className={s.honeypot} aria-hidden="true">이 항목은 비워 두세요<input name="company-website" tabIndex={-1} autoComplete="off" /></label>
        <label className={s.field}>브랜드명 <span className="sr-only">필수</span><input name="brand" value={brand} onChange={(event) => setBrand(event.target.value)} maxLength={80} autoComplete="organization" placeholder="브랜드 또는 회사 이름" required disabled={busy} /></label>
        <label className={s.field}>회신 이메일 <span className="sr-only">필수</span><input name="email" type="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" placeholder="name@company.com" required disabled={busy} /></label>
        <label className={s.field}>캠페인 목표<select name="goal" value={goal} onChange={(event) => setGoal(event.target.value as typeof goal)} disabled={busy}><option value="awareness">브랜드·제품 알리기</option><option value="sales">구매·예약 유도</option><option value="app">앱·서비스 소개</option><option value="other">기타 / 함께 정하고 싶어요</option></select></label>
        <label className={s.field}>추가로 알려주실 내용 · 선택<textarea name="message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1200} placeholder="제품, 희망 일정, 필요한 제작 범위와 사용 기간 등을 알려주세요." disabled={busy} /></label>
        <InquiryPrivacy />
        <label className={s.consent}><input type="checkbox" name="privacy-consent" checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} required disabled={busy} /><span>[필수] 문의 처리를 위한 개인정보 수집·이용에 동의합니다.</span></label>
        <label className={s.consent}><input type="checkbox" name="transfer-consent" checked={transfer} onChange={(event) => setTransfer(event.target.checked)} required disabled={busy} /><span>[필수] 문의 자료의 Netlify 미국 서버 저장에 동의합니다.</span></label>
        {error && <p role="alert" className={s.error}>{error}</p>}
        <button type="submit" className={s.primary} disabled={busy} style={{ width:"100%" }}>{busy ? "문의 전송 중…" : "광고 문의 보내기"}</button>
        <p className={s.note}>튜버봇 운영팀에 접수됩니다. 유튜버 자동 발송·광고 예약·결제는 진행되지 않습니다. 이메일로 문의하려면 <a className={s.textLink} href="mailto:kwonj0815@gmail.com?subject=%ED%8A%9C%EB%B2%84%EB%B4%87%20%EA%B4%91%EA%B3%A0%20%EB%AC%B8%EC%9D%98">메일 앱 열기</a>를 이용하세요.</p>
      </form>
      <aside className={s.result} aria-label="문의에 담긴 기획안"><h2>문의에 담긴 예상 예산</h2><BudgetAmount result={result} /><p className={s.note}>자체 기준 기획 예산 · 부가세 별도</p><dl className={s.resultFacts}><div><dt>브랜드 분야</dt><dd>{CATEGORY_LABELS[result.input.category]}</dd></div><div><dt>콘텐츠</dt><dd>{FORMAT_LABELS[result.input.format]} {result.input.quantity}편</dd></div><div><dt>희망 규모</dt><dd>{result.input.subscribers.toLocaleString("ko-KR")}명</dd></div><div><dt>사용 범위</dt><dd>{USAGE_LABELS[result.input.usage]}</dd></div>{channel && <div><dt>관심 채널</dt><dd>{channel.name}</dd></div>}</dl><p className={s.note}>{result.disclaimer}{channel ? " 관심 채널의 실제 구독자 수를 이 계산에 자동 적용하지 않았습니다." : ""}</p><Link className={s.textLink} href={`/budget?${budgetQuery(result.input)}`}>예산 조건 다시 설정</Link><button type="button" className={s.secondary} onClick={() => saveText("튜버봇_문의기획안.txt",budgetText(result,channel?.name))}>개인정보 없이 기획안 받기</button></aside>
    </div>}
  </div></div>;
}
export function InquiryPrivacyPage() {
  return <div className={s.scope}><div className={`${s.wrap} ${s.policy}`}><header className={s.title}><h1>광고 문의 개인정보 안내</h1><p>문의 접수에 필요한 정보만 수집합니다.</p></header><InquiryPrivacy expanded /><h2>예산 계산과 채널 탐색</h2><p>예산 계산을 위해 연락처를 요구하지 않습니다. 조건 링크에는 콘텐츠 형식·분야·희망 규모·수량·사용 범위만 포함됩니다. 선택한 채널과 직접 입력한 기획 조건은 별개이며, 특정 채널의 확정 가격을 표시하지 않습니다.</p><h2>캠페인 관리 체험</h2><p>캠페인 관리 체험 기록은 본인 브라우저의 저장 공간에 보관됩니다. 해당 화면에서 작업을 삭제하거나 브라우저 사이트 데이터를 삭제할 수 있습니다. 실제 개인정보나 기밀을 체험 기록에 입력하지 마세요.</p><h2>접수 자료 확인·정정·삭제</h2><p>접수할 때 사용한 이메일로 kwonj0815@gmail.com에 요청하세요. 운영자는 필요한 범위에서 본인 확인 후 처리합니다. 문의 내용은 판매자, 유튜버 또는 광고 대행사에 자동 제공되지 않습니다.</p><p>안내 버전: {PRIVACY_VERSION}. 본 사이트는 현재 광고 문의와 예산 기획을 제공하며 온라인 결제·자동 지급을 제공하지 않습니다.</p><Link className={s.primary} href="/inquiry">광고 문의로 돌아가기</Link></div></div>;
}
