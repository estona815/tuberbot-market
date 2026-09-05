import { releaseStatus } from "@/lib/server/release-status";
import { noStoreJson } from "@/lib/server/api-envelope";
export const dynamic = "force-dynamic";
export function GET() { return noStoreJson(releaseStatus()); }
