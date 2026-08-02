export type MarketplacePackage = {
  id: string;
  creatorSlug: string;
  creatorName: string;
  title: string;
  format: "SHORTS" | "LONGFORM_INTEGRATION" | "UGC";
  category: string;
  priceKrw: bigint;
  leadTimeDays: number;
  revisionCount: number;
  usageRight: string;
  available: boolean;
  verifiedChannel: boolean;
  verifiedSeller: boolean;
  image: string;
  reason: string;
  previewOnly: true;
};

export const marketplacePackages: MarketplacePackage[] = [
  {
    id: "pkg_shorts_intro",
    creatorSlug: "haru-store",
    creatorName: "하루상점",
    title: "15초 Shorts 제품 소개",
    format: "SHORTS",
    category: "라이프스타일",
    priceKrw: 450_000n,
    leadTimeDays: 5,
    revisionCount: 1,
    usageRight: "유튜버 채널 게시",
    available: false,
    verifiedChannel: false,
    verifiedSeller: false,
    image: "/assets/tuberbot-market__package-shorts__2026-08-02__v001.png",
    reason: "비교 화면을 설명하기 위한 샘플 조건입니다.",
    previewOnly: true,
  },
  {
    id: "pkg_longform_integration",
    creatorSlug: "tech-note",
    creatorName: "테크노트",
    title: "롱폼 통합 광고",
    format: "LONGFORM_INTEGRATION",
    category: "IT·테크",
    priceKrw: 1_200_000n,
    leadTimeDays: 10,
    revisionCount: 1,
    usageRight: "유튜버 채널 게시",
    available: false,
    verifiedChannel: false,
    verifiedSeller: false,
    image: "/assets/tuberbot-market__package-longform__2026-08-02__v001.png",
    reason: "비교 화면을 설명하기 위한 샘플 조건입니다.",
    previewOnly: true,
  },
  {
    id: "pkg_brand_ugc",
    creatorSlug: "beauty-maker",
    creatorName: "뷰티메이커",
    title: "브랜드 UGC 제작",
    format: "UGC",
    category: "뷰티",
    priceKrw: 700_000n,
    leadTimeDays: 7,
    revisionCount: 2,
    usageRight: "유튜버 채널 게시",
    available: false,
    verifiedChannel: false,
    verifiedSeller: false,
    image: "/assets/tuberbot-market__package-ugc__2026-08-02__v001.png",
    reason: "비교 화면을 설명하기 위한 샘플 조건입니다.",
    previewOnly: true,
  },
];

export function formatKrw(value: bigint): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}
