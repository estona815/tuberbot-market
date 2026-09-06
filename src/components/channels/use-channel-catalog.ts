"use client";
import { useEffect, useSyncExternalStore } from "react";
import { catalogSchema, type ChannelCatalog } from "@/domain/channel-snapshot";
type State = { catalog: ChannelCatalog | null; loading: boolean; failed: boolean; nowMs: number };
const initial: State = { catalog: null, loading: false, failed: false, nowMs: 0 };
let current = initial;
let checkedAt = 0;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();
let poll: number | undefined;
const getSnapshot = () => current;
const getServerSnapshot = () => initial;
const emit = (state: State) => { current = state; for (const listener of listeners) listener(); };
/** One shared memory cache and event-driven clock. Rendering never reads wall-clock time. */
async function ensureCatalog(id?: string, force = false): Promise<void> {
  if (pending) return pending;
  const nowMs = Date.now();
  if (!force && nowMs - checkedAt < 5 * 60_000) {
    if (current.nowMs !== nowMs) emit({ ...current, nowMs });
    return;
  }
  emit({ ...current, loading: true, nowMs });
  pending = (async () => {
    try {
      const response = await fetch(`/api/channel-data${id ? `?id=${encodeURIComponent(id)}` : ""}`, { credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(25_000) });
      if (!response.ok) throw new Error("CHANNEL_DATA_UNAVAILABLE");
      const text = await response.text();
      if (text.length > 2_000_000) throw new Error("CHANNEL_DATA_TOO_LARGE");
      const catalog = catalogSchema.parse(JSON.parse(text));
      emit({ catalog, loading: false, failed: catalog.status === "STORAGE_UNAVAILABLE", nowMs: Date.now() });
    } catch { emit({ ...current, loading: false, failed: true, nowMs: Date.now() }); }
    finally { checkedAt = Date.now(); pending = null; }
  })();
  return pending;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) { poll = window.setInterval(revalidateVisible, 5 * 60_000); window.addEventListener("focus", revalidateVisible); }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { window.clearInterval(poll); window.removeEventListener("focus", revalidateVisible); }
  };
}
function revalidateVisible() { if (!document.hidden) void ensureCatalog(); }
export function useChannelCatalog(id?: string) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => { void ensureCatalog(id); }, [id]);
  return state;
}
export function refreshChannelCatalog() { return ensureCatalog(undefined, true); }
