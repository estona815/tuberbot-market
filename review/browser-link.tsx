import type { AnchorHTMLAttributes, MouseEvent } from "react";
import type { UrlObject } from "node:url";
export function routeHref(href: string): string { return href.startsWith("/") && !href.startsWith("//") ? `/#${href}` : href; }
export function navigate(path: string) { window.location.hash = path; window.scrollTo(0,0); }
export default function BrowserLink({ href, onClick, prefetch: _prefetch, replace: _replace, scroll: _scroll, ...rest }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string | UrlObject; prefetch?: boolean | null; replace?: boolean; scroll?: boolean }) {
  void _prefetch; void _replace; void _scroll;
  const destination = typeof href === "string" ? href : `${href.pathname ?? "/"}${href.query ? `?${new URLSearchParams(href.query as Record<string,string>)}` : ""}`;
  function click(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (!event.defaultPrevented && destination.startsWith("/") && !destination.startsWith("//") && (!rest.target || rest.target === "_self") && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(destination); }
  }
  return <a {...rest} href={routeHref(destination)} onClick={click} />;
}
