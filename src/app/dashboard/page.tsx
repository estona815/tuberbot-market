import type { Metadata } from "next";
import Link from "next/link";
import { CalendarIcon, CheckIcon, ContractIcon, MessageIcon, ShieldIcon } from "@/components/icons";

export const metadata: Metadata = { title: "대시보드", robots: { index: false, follow: false } };

export default function DashboardPage() {
  return (
    <div className="dashboard page-shell">
      <div className="dashboard__head"><div><h1>대시보드</h1><p>거래 당사자별 진행 상태와 다음 작업을 확인하세요.</p></div><span className="sandbox-mode">SANDBOX</span></div>
      <div className="dashboard-layout">
        <nav className="dashboard-nav"><Link className="is-active" href="/dashboard">개요</Link><Link href="/dashboard/creator">유튜버</Link><Link href="/dashboard/advertiser">광고주</Link><Link href="/messages">메시지</Link><Link href="/licenses">사용권</Link><Link href="/settings/security">보안 설정</Link></nav>
        <div className="dashboard-content">
          <section className="next-action"><CalendarIcon size={32} /><div><span>다음 작업</span><h2>초안 v2를 검수해 주세요.</h2><p>주문 TBM-20260802-001 · 검토 대기</p></div><Link className="button" href="/orders/TBM-20260802-001">주문 작업방 열기</Link></section>
          <section className="dashboard-section"><h2>진행 중인 주문</h2><Link className="order-row" href="/orders/TBM-20260802-001"><span className="order-row__icon"><ContractIcon /></span><div><strong>15초 Shorts 제품 소개</strong><small>하루상점 ↔ 스튜디오 모노</small></div><span>초안 검수 중</span><b>₩450,000</b></Link></section>
          <section className="dashboard-grid"><div><MessageIcon /><strong>새 메시지</strong><span>0개</span></div><div><CheckIcon /><strong>검토 필요</strong><span>1건</span></div><div><ShieldIcon /><strong>활성 분쟁</strong><span>0건</span></div></section>
        </div>
      </div>
    </div>
  );
}
