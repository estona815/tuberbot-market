import type { Metadata } from "next";
import { ConnectedWorkspace } from "@/components/workspace/connected-workspace";
export const metadata: Metadata = { title: "서버 광고 협업", robots: { index: false, follow: false }, alternates: { canonical: "/workspace/connected" } };
export default function Page() { return <ConnectedWorkspace />; }
