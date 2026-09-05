import type { Metadata } from "next";
import { CustomerDirectory } from "@/components/acquisition/creator-directory";
export const metadata: Metadata = { title:"유튜버 찾기", description:"브랜드에 맞는 채널을 탐색하고 광고 문의에 담아보세요.", alternates:{ canonical:"/search" }, robots:{ index:false,follow:false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) { const { q }=await searchParams; return <CustomerDirectory initialQuery={typeof q === "string" ? q : ""} />; }
