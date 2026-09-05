import Link from "next/link";
import type { Metadata } from "next";
import { releaseStatus } from "@/lib/server/release-status";
import s from "@/components/workspace/workspace.module.css";
export const metadata: Metadata = { title: "운영 연결 현황", robots: { index: false, follow: false }, alternates: { canonical: "/launch" } };
export default function LaunchPage() {
  const status = releaseStatus();
  const rows = [
    ["유튜버 탐색", "공개 검토 가능", "보관된 채널 정보와 샘플 상품입니다. 현재 수치·입점·광고 수락을 보증하지 않습니다."],
    ["광고비 산정", "사용 가능", "직접 입력한 a·b 또는 거래 CSV로 계산합니다. 자동 시장 시세가 아닙니다."],
    ["광고 협업 기록", "사용 가능", "제안·역제안·계약 검토본·모의 결제·검수·정산 준비를 이 브라우저에 기록합니다."],
    ["Google 계정 연결", status.identityConfigured ? "설정 감지 · 실연동 확인 필요" : "운영 연결 필요", "운영 OAuth 프로젝트·정책 고지·서버 데이터베이스가 필요합니다."],
    ["서버 협업", status.connectedWorkspaceConfigured ? "샌드박스 설정 감지" : "운영 연결 필요", "인증된 양측 계정의 서버 저장·권한 확인 경로입니다. 실제 청구·지급은 없습니다."],
    ["YouTube 실시간 조회", status.youtubeConfigured ? "설정 감지 · 조회 확인 필요" : "운영 연결 필요", "공식 API의 원본 지표만 조회하며 소유권 인증이나 예상 광고비를 생성하지 않습니다."],
    ["실제 결제·정산", "비활성화", "PG 계약·판매자 확인·환불·세무·대사 및 운영 점검이 완료되기 전에는 개방하지 않습니다."],
  ];
  return <div className={`page-shell ${s.workspace}`}><header className={s.heading}><div><h1>운영 연결 현황</h1><p>화면에서 되는 기능과 실제 사업 운영에 필요한 연결을 구분합니다.</p></div><Link className="button button--small" href="/workspace">광고 협업 시작</Link></header><div className={s.mode}><strong>공개 검토판</strong><span>정식 거래 서비스의 출시 승인을 뜻하지 않습니다. 검토 모드에서는 실제 사람에게 알림을 보내거나 돈을 받지 않습니다.</span></div><section className={s.history} aria-label="기능 연결 상태"><dl className={s.summary}>{rows.map(([name, state, detail]) => <div key={name}><dt>{name}</dt><dd><strong>{state}</strong><p className={s.helper}>{detail}</p></dd></div>)}</dl></section><section className={s.history}><h2>한 번에 확인하는 흐름</h2><p className={s.helper}>채널 탐색 → 광고비 산정 → 캠페인 작성 → 역제안 → 양측 수락 → 계약 검토본 → 결제 단계 체험 → 제작물 검수 → 게시 기록 → 정산 준비</p><div className={s.actions}><Link className="button" href="/workspace">워크스페이스 열기</Link><Link className="button button--secondary" href="/rate-studio">광고비 계산</Link><Link className="button button--secondary" href="/account">계정·채널 연결</Link></div></section><p className={s.helper}>설정 감지는 환경 변수가 갖추어졌다는 뜻입니다. 실제 외부 연동 테스트나 보안 심사가 완료되었다는 뜻은 아닙니다.</p></div>;
}
