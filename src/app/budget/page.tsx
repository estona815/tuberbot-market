import type { Metadata } from "next";
import { Suspense } from "react";
import { BudgetCalculator } from "@/components/acquisition/budget-calculator";
export const metadata: Metadata = { title:"광고 예산 계산", description:"콘텐츠 형식·희망 규모·수량에 맞는 기획 예산을 바로 계산하세요.", alternates:{ canonical:"/budget" } };
export default function Page() { return <Suspense fallback={<p className="page-shell">예산 계산기를 열고 있습니다.</p>}><BudgetCalculator /></Suspense>; }
