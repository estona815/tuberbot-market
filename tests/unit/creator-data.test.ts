import { describe, expect, it } from "vitest";
import {
  featuredLegacyCreators,
  getLegacyCreatorById,
  getLegacyCreatorBySlug,
  legacyCreators,
  searchDirectoryLegacyCreators,
} from "@/lib/creator-data";

describe("legacy creator archive", () => {
  it("keeps all audited homepage and unauthenticated search records", () => {
    expect(featuredLegacyCreators).toHaveLength(3);
    expect(searchDirectoryLegacyCreators).toHaveLength(10);
    expect(legacyCreators).toHaveLength(13);
    expect(new Set(legacyCreators.map((creator) => creator.legacyId)).size).toBe(13);
    expect(new Set(legacyCreators.map((creator) => creator.youtubeId)).size).toBe(13);
    expect(searchDirectoryLegacyCreators.map((creator) => [creator.name, creator.legacyId, creator.youtubeId, creator.subscriberCount, creator.sourceContactLabel])).toEqual([
      ["MrBeast", "x2cDDHCN44WeC9JBJgx8", "UCX6OQ3DkcsbYNE6H8uQQuVA", 311_000_000, false],
      ["BLACKPINK", "FzOFFAh2x5yrEaRVo03p", "UCOmHUn--16B90oW2L6FRR3A", 94_600_000, false],
      ["BANGTANTV", "hM3YgPmpTWQmkXtdYARl", "UCLkAepWjdylmXSltofFvsYQ", 78_800_000, true],
      ["Justin Bieber", "wuGaQw3xSiDjEQoqcPur", "UCIwFjwMjI0y7PDBVEO9-bkQ", 75_900_000, false],
      ["HYBE LABELS", "hJ0MVNnY5KMoGkiqhKeC", "UC3IZKseVpdzPSBaWxBxundA", 75_500_000, true],
      ["Taylor Swift", "uaNgmP7eMsji0Woy9tAe", "UCqECaJ8Gagnn7YCbPEzWH6g", 61_800_000, false],
      ["Ed Sheeran", "rwhvj0pzQsuiko86JB1I", "UC0C-w0YjGpqDXGB8IHb662A", 55_000_000, false],
      ["IShowSpeed", "SDpUPveQFjNNd3p6ygOl", "UCWsDFcIhY2DBi3GB5uykGXA", 54_300_000, false],
      ["Shakira", "UWwe2mx14wigA5Ayc1DC", "UCYLNGLIzMhRTi6ZOLjAPSmw", 49_100_000, false],
      ["DaFuq!?Boom!", "hHq8rxdYQHWLohnYvmNO", "UCsSsgPaZ2GSmO6il8Cb5iGA", 43_800_000, false],
    ]);
  });

  it("preserves the exact public homepage estimates", () => {
    expect(featuredLegacyCreators.map((creator) => ({
      name: creator.name,
      price: creator.priceProvenance.legacyEstimatedPriceKrw,
      cpv: creator.priceProvenance.legacyEstimatedCpv,
    }))).toEqual([
      { name: "thin 씬님", price: 1_164_000n, cpv: "3.29" },
      { name: "진짜중국어Real Chinese", price: 1_478_000n, cpv: "84.68" },
      { name: "HUBA후바", price: 152_573_000n, cpv: "8.70" },
    ]);
  });

  it("does not infer prices hidden behind the source login", () => {
    for (const creator of searchDirectoryLegacyCreators) {
      expect(creator.priceProvenance).toMatchObject({
        access: "LOGIN_REQUIRED_AT_SOURCE",
        legacyEstimatedPriceKrw: null,
        legacyEstimatedCpv: null,
      });
    }
  });

  it("keeps every legacy creator unclaimed and non-transactable", () => {
    for (const creator of legacyCreators) {
      expect(creator.discoveryStatus).toBe("DISCOVERY_ONLY");
      expect(creator.claimStatus).toBe("UNCLAIMED");
      expect(creator.transactionReady).toBe(false);
      expect(creator.channelVerified).toBe(false);
      expect(creator.sellerVerified).toBe(false);
    }
  });

  it("resolves both preserved route identifiers", () => {
    expect(getLegacyCreatorById("0GsrcFYGfeAY5SNOtfgz")?.name).toBe("thin 씬님");
    expect(getLegacyCreatorBySlug("huba")?.legacyId).toBe("m450K6R78QZm7ZZhUAsW");
    expect(getLegacyCreatorById("unknown")).toBeUndefined();
  });
});
