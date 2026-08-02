import { getRequestId, publicApiError } from "@/lib/server/api-envelope";
import { getAuthHttpHandlers } from "@/lib/server/auth/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    return await getAuthHttpHandlers().createDemoSession(request);
  } catch {
    return publicApiError("AUTH_SERVICE_UNAVAILABLE", 503, getRequestId(request));
  }
}
