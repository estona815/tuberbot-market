import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "관리자", robots: { index: false, follow: false } };

export default function AdminPage() {
  notFound();
}
