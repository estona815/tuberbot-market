import { type NextRequest, NextResponse } from "next/server";

export function createContentSecurityPolicy(nonce: string): string {
  const developmentDirectives = process.env.NODE_ENV === "development"
    ? { script: " 'unsafe-eval'", style: " 'unsafe-inline'" }
    : { script: "", style: ` 'nonce-${nonce}'` };
  const secureApplicationOrigin = process.env.APP_ORIGIN?.startsWith("https://") === true;

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self' https://*.tosspayments.com",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentDirectives.script}`,
    `style-src 'self'${developmentDirectives.style}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.tosspayments.com https://*.tosspayments.com",
    "frame-src https://*.tosspayments.com",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    ...(secureApplicationOrigin ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
