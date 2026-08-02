import { getRequestId, publicApiError } from "@/lib/server/api-envelope";
import { handleInitiateUpload } from "@/lib/server/storage/http";
import { getUploadRouteDependencies } from "@/lib/server/storage/route-runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    return await handleInitiateUpload(request, getUploadRouteDependencies());
  } catch {
    const requestId = getRequestId(request);
    return publicApiError("STORAGE_UNAVAILABLE", 503, requestId);
  }
}
