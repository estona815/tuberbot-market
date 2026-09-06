import { legacyCreators } from "../creator-data";
/** Curated IDs only. A public request cannot add arbitrary channels or trigger search.list. */
export function registeredChannelIds(): string[] {
  return [...new Set(legacyCreators.map((creator) => creator.youtubeId))];
}
