import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InfoPage } from "@/components/info-page";
import { WorkspacePage } from "@/components/workspace-page";
import { legalSitePages, publicSitePages, type SitePage } from "@/lib/site-pages";
import { getWorkspacePage } from "@/lib/workspace-pages";

type RouteProps = { params: Promise<{ slug: string[] }> };

function getPage(slug: readonly string[]): SitePage | undefined {
  const [first, second] = slug;
  if (slug.length === 1 && first !== undefined) return publicSitePages[first];
  if (slug.length === 2 && first === "legal" && second !== undefined) return legalSitePages[second];
  return undefined;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getPage(slug);
  const workspacePage = getWorkspacePage(slug);
  if (workspacePage) return { title: workspacePage.title, description: workspacePage.description, robots: { index: false, follow: false } };
  if (!page) return { title: "페이지를 찾을 수 없음", robots: { index: false, follow: false } };
  const path = `/${slug.join("/")}`;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: path },
    robots: page.noIndex || process.env.ENABLE_PUBLIC_INDEXING !== "true"
      ? { index: false, follow: false }
      : undefined,
  };
}

export default async function PublicInfoPage({ params }: RouteProps) {
  const { slug } = await params;
  const page = getPage(slug);
  const workspacePage = getWorkspacePage(slug);
  if (workspacePage) return <WorkspacePage page={workspacePage} />;
  if (!page) notFound();
  return <InfoPage page={page} />;
}
