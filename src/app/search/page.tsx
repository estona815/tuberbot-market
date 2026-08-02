import type { Metadata } from "next";
import { CreatorExplorer } from "@/components/creator-explorer";

export const metadata: Metadata = {
  title: "유튜버 검색",
  description: "기존 튜버봇 공개 화면에서 확인한 유튜버 탐색 자료를 안전한 보존 상태로 제공합니다.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: false },
};

export default async function LegacySearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";

  return (
    <div className="legacy-search page-shell">
      <CreatorExplorer initialQuery={initialQuery} />
    </div>
  );
}
