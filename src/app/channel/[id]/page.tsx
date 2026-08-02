import { permanentRedirect } from "next/navigation";

export default async function LegacyChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  permanentRedirect(`/creators?legacyChannelId=${encodeURIComponent(id)}`);
}
