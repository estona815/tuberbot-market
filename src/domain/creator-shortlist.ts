/** Only known public channel IDs are persisted; never personal inquiry data. */
export const SHORTLIST_KEY = "tuberbot-shortlist-v1";
export function parseShortlist(raw: string | null, allowed: ReadonlySet<string>): string[] {
  if (!raw || raw.length > 8192) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((id): id is string => typeof id === "string" && allowed.has(id)))].slice(0, 30);
  } catch { return []; }
}
