export type LegacyPriceProvenance =
  | {
      access: "PUBLIC_AT_SOURCE";
      legacyEstimatedPriceKrw: bigint;
      legacyEstimatedCpv: string;
      label: "LEGACY_PUBLIC_ESTIMATE";
      observedOnKst: "2026-08-02";
      sourceUrl: string;
    }
  | {
      access: "LOGIN_REQUIRED_AT_SOURCE";
      legacyEstimatedPriceKrw: null;
      legacyEstimatedCpv: null;
      label: "LEGACY_GATED_VALUE_NOT_COLLECTED";
      observedOnKst: "2026-08-02";
      sourceUrl: "https://tuberbot.co.kr/search";
    };

export type LegacyCreator = {
  categories: readonly string[];
  channelVerified: false;
  claimStatus: "UNCLAIMED";
  discoveryStatus: "DISCOVERY_ONLY";
  handle: string | null;
  imageUrl: string | null;
  lastEditedOnKst: string | null;
  legacyId: string;
  name: string;
  priceProvenance: LegacyPriceProvenance;
  sellerVerified: false;
  slug: string;
  sourceContactLabel: boolean;
  sourceListingUrl: string;
  subscriberCount: number;
  transactionReady: false;
  videoCount: number | null;
  viewCount: number | null;
  youtubeId: string;
};

const legacySafetyStatus = {
  channelVerified: false,
  claimStatus: "UNCLAIMED",
  discoveryStatus: "DISCOVERY_ONLY",
  sellerVerified: false,
  transactionReady: false,
} as const;

const observedOnKst = "2026-08-02" as const;

export const featuredLegacyCreators = [
  {
    ...legacySafetyStatus,
    categories: ["음식", "라이프스타일"],
    handle: "@thinthinssin",
    imageUrl: "https://yt3.ggpht.com/ytc/AIdro_lsUgs_IzNeZ_ihMceyYK7U5P3J6SJqD_sG_cNU5HTs0Q=s88-c-k-c0x00ffffff-no-rj",
    lastEditedOnKst: "2024-08-18",
    legacyId: "0GsrcFYGfeAY5SNOtfgz",
    name: "thin 씬님",
    priceProvenance: {
      access: "PUBLIC_AT_SOURCE",
      label: "LEGACY_PUBLIC_ESTIMATE",
      legacyEstimatedPriceKrw: 1_164_000n,
      legacyEstimatedCpv: "3.29",
      observedOnKst,
      sourceUrl: "https://tuberbot.co.kr/channel/0GsrcFYGfeAY5SNOtfgz",
    },
    slug: "thin-ssin",
    sourceContactLabel: false,
    sourceListingUrl: "https://tuberbot.co.kr/",
    subscriberCount: 77_400,
    videoCount: 11,
    viewCount: 3_895_465,
    youtubeId: "UCRZpUpY4NfXi6D7TYRt76rQ",
  },
  {
    ...legacySafetyStatus,
    categories: ["라이프스타일", "지식"],
    handle: "@realchinese2534",
    imageUrl: "https://yt3.ggpht.com/ytc/AIdro_kGLg2HtQgo7naulMBhwO7OLJZ6TLN2dTOavzyKqjepXbM=s88-c-k-c0x00ffffff-no-rj",
    lastEditedOnKst: "2024-08-18",
    legacyId: "0UKiDIDOKqzW0nmfRkwo",
    name: "진짜중국어Real Chinese",
    priceProvenance: {
      access: "PUBLIC_AT_SOURCE",
      label: "LEGACY_PUBLIC_ESTIMATE",
      legacyEstimatedPriceKrw: 1_478_000n,
      legacyEstimatedCpv: "84.68",
      observedOnKst,
      sourceUrl: "https://tuberbot.co.kr/channel/0UKiDIDOKqzW0nmfRkwo",
    },
    slug: "real-chinese",
    sourceContactLabel: false,
    sourceListingUrl: "https://tuberbot.co.kr/",
    subscriberCount: 117_000,
    videoCount: 891,
    viewCount: 15_552_062,
    youtubeId: "UCKlkq5f_g8lufQfXnFYcG3Q",
  },
  {
    ...legacySafetyStatus,
    categories: ["엔터테인먼트", "라이프스타일", "음식"],
    handle: "@huba3",
    imageUrl: "https://yt3.ggpht.com/ytc/AIdro_n0dgb109x4yqiGjxqNFmxI-OIxNc9DdM6nNFroimTrmA=s88-c-k-c0x00ffffff-no-rj",
    lastEditedOnKst: "2024-08-21",
    legacyId: "m450K6R78QZm7ZZhUAsW",
    name: "HUBA후바",
    priceProvenance: {
      access: "PUBLIC_AT_SOURCE",
      label: "LEGACY_PUBLIC_ESTIMATE",
      legacyEstimatedPriceKrw: 152_573_000n,
      legacyEstimatedCpv: "8.70",
      observedOnKst,
      sourceUrl: "https://tuberbot.co.kr/channel/m450K6R78QZm7ZZhUAsW",
    },
    slug: "huba",
    sourceContactLabel: false,
    sourceListingUrl: "https://tuberbot.co.kr/",
    subscriberCount: 19_200_000,
    videoCount: 731,
    viewCount: 12_814_906_176,
    youtubeId: "UCybzQL-nUUIcbobgx6CrvkQ",
  },
] as const satisfies readonly LegacyCreator[];

const gatedPriceProvenance: LegacyPriceProvenance = {
  access: "LOGIN_REQUIRED_AT_SOURCE",
  label: "LEGACY_GATED_VALUE_NOT_COLLECTED",
  legacyEstimatedPriceKrw: null,
  legacyEstimatedCpv: null,
  observedOnKst,
  sourceUrl: "https://tuberbot.co.kr/search",
};

export const searchDirectoryLegacyCreators = [
  { name: "MrBeast", slug: "mrbeast", legacyId: "x2cDDHCN44WeC9JBJgx8", youtubeId: "UCX6OQ3DkcsbYNE6H8uQQuVA", subscriberCount: 311_000_000, sourceContactLabel: false },
  { name: "BLACKPINK", slug: "blackpink", legacyId: "FzOFFAh2x5yrEaRVo03p", youtubeId: "UCOmHUn--16B90oW2L6FRR3A", subscriberCount: 94_600_000, sourceContactLabel: false },
  { name: "BANGTANTV", slug: "bangtantv", legacyId: "hM3YgPmpTWQmkXtdYARl", youtubeId: "UCLkAepWjdylmXSltofFvsYQ", subscriberCount: 78_800_000, sourceContactLabel: true },
  { name: "Justin Bieber", slug: "justin-bieber", legacyId: "wuGaQw3xSiDjEQoqcPur", youtubeId: "UCIwFjwMjI0y7PDBVEO9-bkQ", subscriberCount: 75_900_000, sourceContactLabel: false },
  { name: "HYBE LABELS", slug: "hybe-labels", legacyId: "hJ0MVNnY5KMoGkiqhKeC", youtubeId: "UC3IZKseVpdzPSBaWxBxundA", subscriberCount: 75_500_000, sourceContactLabel: true },
  { name: "Taylor Swift", slug: "taylor-swift", legacyId: "uaNgmP7eMsji0Woy9tAe", youtubeId: "UCqECaJ8Gagnn7YCbPEzWH6g", subscriberCount: 61_800_000, sourceContactLabel: false },
  { name: "Ed Sheeran", slug: "ed-sheeran", legacyId: "rwhvj0pzQsuiko86JB1I", youtubeId: "UC0C-w0YjGpqDXGB8IHb662A", subscriberCount: 55_000_000, sourceContactLabel: false },
  { name: "IShowSpeed", slug: "ishowspeed", legacyId: "SDpUPveQFjNNd3p6ygOl", youtubeId: "UCWsDFcIhY2DBi3GB5uykGXA", subscriberCount: 54_300_000, sourceContactLabel: false },
  { name: "Shakira", slug: "shakira", legacyId: "UWwe2mx14wigA5Ayc1DC", youtubeId: "UCYLNGLIzMhRTi6ZOLjAPSmw", subscriberCount: 49_100_000, sourceContactLabel: false },
  { name: "DaFuq!?Boom!", slug: "dafuq-boom", legacyId: "hHq8rxdYQHWLohnYvmNO", youtubeId: "UCsSsgPaZ2GSmO6il8Cb5iGA", subscriberCount: 43_800_000, sourceContactLabel: false },
].map((creator) => ({
  ...creator,
  ...legacySafetyStatus,
  categories: [],
  handle: null,
  imageUrl: null,
  lastEditedOnKst: null,
  priceProvenance: gatedPriceProvenance,
  sourceListingUrl: "https://tuberbot.co.kr/search",
  videoCount: null,
  viewCount: null,
})) satisfies readonly LegacyCreator[];

export const legacyCreators: readonly LegacyCreator[] = [
  ...featuredLegacyCreators,
  ...searchDirectoryLegacyCreators,
];

const legacyCreatorById = new Map(legacyCreators.map((creator) => [creator.legacyId, creator]));
const legacyCreatorBySlug = new Map(legacyCreators.map((creator) => [creator.slug, creator]));

export function getLegacyCreatorById(id: string): LegacyCreator | undefined {
  return legacyCreatorById.get(id);
}

export function getLegacyCreatorBySlug(slug: string): LegacyCreator | undefined {
  return legacyCreatorBySlug.get(slug);
}

export function formatCreatorCount(value: number | null): string {
  return value === null ? "원본 미수집" : new Intl.NumberFormat("ko-KR").format(value);
}

export function formatLegacyKrw(value: bigint): string {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원/회`;
}
