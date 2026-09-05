import { useSyncExternalStore } from "react";
import { navigate } from "./browser-link";
const subscribe = (onChange: () => void) => { window.addEventListener("hashchange", onChange); return () => window.removeEventListener("hashchange", onChange); };
const snapshot = () => window.location.hash.slice(1) || "/";
export function useRoute() { return useSyncExternalStore(subscribe, snapshot, () => "/"); }
export function usePathname() { return useRoute().split("?")[0] ?? "/"; }
export function useSearchParams() { return new URLSearchParams(useRoute().split("?")[1] ?? ""); }
export function useRouter() { return { push: navigate, replace: navigate, back: () => history.back(), forward: () => history.forward(), refresh: () => location.reload(), prefetch: () => Promise.resolve() }; }
export function notFound(): never { throw new Error("이 주소에 해당하는 페이지가 없습니다."); }
export function redirect(path: string): never { navigate(path); throw new Error("페이지를 이동합니다."); }
