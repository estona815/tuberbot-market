import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { publicCampaigns } from "@/lib/campaign-data";
import { marketplacePackages } from "@/lib/market-data";
import { legalSitePages } from "@/lib/site-pages";

describe("public product preview safety", () => {
  it("marks every seeded marketplace package as a non-transactable preview", () => {
    expect(marketplacePackages.length).toBeGreaterThan(0);

    for (const item of marketplacePackages) {
      expect(item.previewOnly).toBe(true);
      expect(item.available).toBe(false);
      expect(item.verifiedChannel).toBe(false);
      expect(item.verifiedSeller).toBe(false);
    }
  });

  it("marks every seeded campaign as a preview that cannot accept applications", () => {
    expect(publicCampaigns.length).toBeGreaterThan(0);

    for (const campaign of publicCampaigns) {
      expect(campaign.previewOnly).toBe(true);
      expect(campaign.acceptingApplications).toBe(false);
    }
  });

  it("keeps legal drafts out of search indexing", () => {
    for (const page of Object.values(legalSitePages)) {
      expect(page.noIndex).toBe(true);
    }
  });

  it("excludes seeded marketplace and legal draft routes from the sitemap", () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);

    expect(paths).toContain("/");
    expect(paths.some((path) => path.startsWith("/creators"))).toBe(false);
    expect(paths.some((path) => path.startsWith("/packages"))).toBe(false);
    expect(paths.some((path) => path.startsWith("/campaigns"))).toBe(false);
    expect(paths.some((path) => path.startsWith("/legal"))).toBe(false);
    expect(paths).not.toContain("/market");
  });
});
