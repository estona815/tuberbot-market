import type { Metadata } from "next";
import { RateStudio } from "@/components/ad-rate/rate-studio";

export const metadata: Metadata = {
  title: "광고비 산정 워크스페이스",
  description: "직접 입력한 카테고리별 계수로 광고비를 계산하고, 보유한 거래 CSV로 a·b를 보정하는 로컬 계산 도구입니다. 확정 견적이나 시장 시세를 제공하지 않습니다.",
  alternates: { canonical: "/rate-studio" },
  robots: { index: false, follow: false },
};

export default function RateStudioPage() {
  return <RateStudio />;
}
