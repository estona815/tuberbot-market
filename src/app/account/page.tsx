import type { Metadata } from "next";
import { AccountPanel } from "@/components/workspace/account-panel";
export const metadata: Metadata = { title: "계정·채널 연결", robots: { index: false, follow: false }, alternates: { canonical: "/account" } };
export default function AccountPage() { return <AccountPanel />; }
