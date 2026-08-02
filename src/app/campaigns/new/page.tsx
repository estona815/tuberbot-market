import type { Metadata } from "next";

export const metadata: Metadata = { title: "광고 캠페인 등록", robots: { index: false, follow: false } };

export default function NewCampaignPage() {
  return (
    <div className="form-page page-shell">
      <header><p>제품 프리뷰</p><h1>광고 캠페인 등록 화면</h1><span>화면 검수용 샘플 양식입니다. 입력·저장·제출되지 않으며 실제 광고주 모집을 시작하지 않습니다.</span></header>
      <form aria-label="비활성 캠페인 등록 프리뷰">
        <label>캠페인명<input disabled name="title" placeholder="예: 친환경 리빙 제품 Shorts 캠페인" /></label>
        <label>광고 목표<textarea disabled name="objective" placeholder="누구에게 무엇을 알리고 싶은지 입력하세요." rows={4} /></label>
        <div><label>최소 예산<input disabled inputMode="numeric" name="minBudget" placeholder="400000" type="number" /></label><label>최대 예산<input disabled inputMode="numeric" name="maxBudget" placeholder="700000" type="number" /></label></div>
        <div><label>콘텐츠 형식<select disabled name="format"><option>YouTube Shorts</option><option>롱폼 통합 광고</option><option>브랜드 UGC</option></select></label><label>게시 희망일<input disabled name="publishBy" type="date" /></label></div>
        <label className="checkbox-row"><input disabled type="checkbox" /> 금지 광고와 광고 표시 안내 확인</label>
        <button className="button" disabled type="button">등록 기능 준비 중</button>
      </form>
    </div>
  );
}
