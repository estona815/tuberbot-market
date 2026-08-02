export type PublicCampaign = {
  id: string;
  title: string;
  brand: string;
  budget: string;
  format: string;
  date: string;
  category: string;
  objective: string;
  deliverables: readonly string[];
  previewOnly: true;
  acceptingApplications: false;
};

export const publicCampaigns: readonly PublicCampaign[] = [
  {
    id: "cmp_lifestyle_launch",
    title: "친환경 리빙 제품 Shorts 캠페인",
    brand: "샘플 브랜드 A",
    budget: "예시 ₩400,000–₩700,000",
    format: "YouTube Shorts 1편",
    date: "2026. 8. 20.",
    category: "라이프스타일",
    objective: "제품의 재사용 방식과 일상 활용 장면을 짧고 명확하게 소개합니다.",
    deliverables: ["세로형 Shorts 초안 1편", "계약 범위 내 수정 1회", "광고 표시가 포함된 YouTube 게시 URL"],
    previewOnly: true,
    acceptingApplications: false,
  },
  {
    id: "cmp_saas_review",
    title: "업무 도구 롱폼 통합 광고",
    brand: "샘플 브랜드 B",
    budget: "예시 ₩1,000,000–₩1,800,000",
    format: "롱폼 통합 광고",
    date: "2026. 9. 5.",
    category: "IT·테크",
    objective: "실제 업무 흐름 안에서 협업 기능과 도입 과정을 설명합니다.",
    deliverables: ["롱폼 영상 내 통합 광고", "계약 범위 내 수정 1회", "설명란 고지와 게시 URL"],
    previewOnly: true,
    acceptingApplications: false,
  },
];
