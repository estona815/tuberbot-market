import Link from "next/link";
import { CheckIcon, LockIcon } from "@/components/icons";
import type { WorkspacePage as WorkspacePageType } from "@/lib/workspace-pages";

export function WorkspacePage({ page }: { page: WorkspacePageType }) {
  return (
    <div className="workspace-page page-shell">
      <nav aria-label="현재 위치"><Link href="/dashboard">대시보드</Link><span>/</span><span>{page.group}</span></nav>
      <header><div><p>{page.group}</p><h1>{page.title}</h1><span>{page.description}</span></div><strong><LockIcon /> {page.status}</strong></header>
      <div className="workspace-cards">
        {page.items.map((item, index) => <section key={item.label}><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{item.label}</h2><p>{item.detail}</p></div><CheckIcon /></section>)}
      </div>
      <aside><p>이 화면은 production-oriented 구조를 검증하기 위한 샌드박스입니다. 실사용 인증·결제·지급은 외부 provider와 운영 승인 전까지 차단됩니다.</p><Link className="button" href={page.action.href}>{page.action.label}</Link></aside>
    </div>
  );
}
