"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import { legacyCreators } from "@/lib/creator-data";
import { parseShortlist, SHORTLIST_KEY } from "@/domain/creator-shortlist";
const CHANGE = "tuberbot-shortlist-change";
const allowed = new Set(legacyCreators.map((creator) => creator.legacyId));
function subscribe(callback: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === SHORTLIST_KEY || event.key === null) callback(); };
  window.addEventListener("storage", storage); window.addEventListener(CHANGE, callback);
  return () => { window.removeEventListener("storage", storage); window.removeEventListener(CHANGE, callback); };
}
function snapshot() { try { return localStorage.getItem(SHORTLIST_KEY) ?? "[]"; } catch { return "[]"; } }
const serverSnapshot = () => "[]";
export function useShortlist() {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const ids = useMemo(() => parseShortlist(raw, allowed), [raw]);
  const [error, setError] = useState("");
  function toggle(id: string) {
    if (!allowed.has(id)) return;
    try {
      const current = parseShortlist(localStorage.getItem(SHORTLIST_KEY), allowed);
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(0, 30);
      localStorage.setItem(SHORTLIST_KEY, JSON.stringify(next)); window.dispatchEvent(new Event(CHANGE)); setError("");
    } catch { setError("브라우저 저장 공간에 접근할 수 없습니다. 채널을 바로 문의에 담아 주세요."); }
  }
  return { ids, toggle, error };
}
