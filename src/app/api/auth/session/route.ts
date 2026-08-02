import { getRequestId, publicApiError } from "@/lib/server/api-envelope";
import { getAuthHttpHandlers } from "@/lib/server/auth/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unavailable(request: Request): Response {
  return publicApiError("AUTH_SERVICE_UNAVAILABLE", 503, getRequestId(request));
}

export async function GET(request: Request): Promise<Response> {
  try {
    return await getAuthHttpHandlers().getSession(request);
  } catch {
    return unavailable(request);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    return await getAuthHttpHandlers().rotateSession(request);
  } catch {
    return unavailable(request);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    return await getAuthHttpHandlers().deleteSession(request);
  } catch {
    return unavailable(request);
  }
}
