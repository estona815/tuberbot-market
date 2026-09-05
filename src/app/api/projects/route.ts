import { createProject, listProjects } from "@/lib/server/workspace-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = listProjects;
export const POST = createProject;
