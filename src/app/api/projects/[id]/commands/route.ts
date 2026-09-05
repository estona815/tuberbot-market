import { projectCommand } from "@/lib/server/workspace-http";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return projectCommand(request, (await context.params).id);
}
