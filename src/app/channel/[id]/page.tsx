import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegacyCreatorProfile } from "@/components/legacy-creator-profile";
import { getLegacyCreatorById } from "@/lib/creator-data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const creator = getLegacyCreatorById(id);
  return creator
    ? {
        title: `${creator.name} 레거시 프로필`,
        description: "기존 튜버봇 공개 화면에서 보존한 탐색 전용 프로필입니다.",
        alternates: { canonical: `/channel/${id}` },
        robots: { index: false, follow: false },
      }
    : { title: "유튜버를 찾을 수 없음", robots: { index: false, follow: false } };
}

export default async function LegacyChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const creator = getLegacyCreatorById(id);

  if (!creator) notFound();
  return <LegacyCreatorProfile creator={creator} />;
}
