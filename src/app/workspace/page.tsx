import type { Metadata } from "next";
import { ProjectWorkspace } from "@/components/workspace/project-workspace";
export const metadata: Metadata = { title: "광고 협업 워크스페이스", description: "제안·역제안·합의 버전·콘텐츠 검수·정산 준비를 기록하는 튜버봇 검토용 워크스페이스입니다.", alternates: { canonical: "/workspace" }, robots: { index: false, follow: false } };
export default function Page() { return <ProjectWorkspace />; }
