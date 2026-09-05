import { legalSitePages as legal, publicSitePages as publicPages } from "@/lib/site-pages";
import type { SitePage } from "@/lib/site-pages";
export const legalSitePages: Readonly<Record<string, SitePage>> = Object.fromEntries(Object.entries(legal).map(([key,value]) => [`/legal/${key}`,value]));
export const publicSitePages: Readonly<Record<string, SitePage>> = Object.fromEntries(Object.entries(publicPages).map(([key,value]) => [`/${key}`,value]));
