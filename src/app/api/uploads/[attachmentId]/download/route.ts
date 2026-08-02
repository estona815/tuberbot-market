import { getRequestId, publicApiError } from "@/lib/server/api-envelope";
import { handleCreateDownload } from "@/lib/server/storage/http";
import { getUploadRouteDependencies } from "@/lib/server/storage/route-runtime";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: Readonly<{ params: Promise<Readonly<{ attachmentId: string }>> }>,
): Promise<Response> {
  try {
    const { attachmentId } = await context.params;
    return await handleCreateDownload(request, attachmentId, getUploadRouteDependencies());
  } catch {
    const requestId = getRequestId(request);
    return publicApiError("STORAGE_UNAVAILABLE", 503, requestId);
  }
}
