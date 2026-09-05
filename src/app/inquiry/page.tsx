import type { Metadata } from "next";
import { Suspense } from "react";
import { InquiryPage } from "@/components/acquisition/inquiry";
export const metadata: Metadata = { title:"광고 문의", alternates:{ canonical:"/inquiry" }, robots:{ index:false,follow:false } };
export default function Page() { return <Suspense fallback={<p className="page-shell">문의 페이지를 열고 있습니다.</p>}><InquiryPage /></Suspense>; }
