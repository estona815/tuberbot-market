import type { Metadata } from "next";
import { DealFlowDemo } from "@/components/deal-flow-demo";

export const metadata: Metadata = {
  title: "안전 거래 흐름 데모",
  description: "가상 참여자로 제안, 계약, 샌드박스 결제, 검수와 구매 확정 흐름을 확인하는 브라우저 전용 데모입니다.",
  alternates: { canonical: "/deal-demo" },
  robots: { index: false, follow: false },
};

export default function DealDemoPage() {
  return <DealFlowDemo />;
}
