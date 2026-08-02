import {
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  handleImageOptimization,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface AssetsBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface ImageBinding {
  input(stream: ReadableStream): {
    transform(options: Record<string, unknown>): {
      output(options: {
        format: string;
        quality: number;
      }): Promise<{ response(): Response }>;
    };
  };
}

interface Env {
  ASSETS: AssetsBinding;
  IMAGES: ImageBinding;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const blockedPublicPreviewRoots = [
  "/admin",
  "/api/auth",
  "/api/orders",
  "/api/uploads",
  "/dashboard",
  "/licenses",
  "/login",
  "/messages",
  "/notifications",
  "/onboarding",
  "/orders",
  "/reviews",
  "/settings",
  "/signup",
  "/verification",
] as const;

function isBlockedPublicPreviewPath(pathname: string): boolean {
  return blockedPublicPreviewRoots.some((root) =>
    pathname === root || pathname.startsWith(`${root}/`),
  );
}

function normalizePathname(pathname: string): string | null {
  let decoded = pathname;

  try {
    for (let pass = 0; pass < 4; pass += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return null;
  }

  if (/%[0-9a-f]{2}/iu.test(decoded) || /[\u0000-\u001f\u007f]/u.test(decoded)) {
    return null;
  }

  const segments: string[] = [];
  for (const segment of decoded.replaceAll("\\", "/").split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return `/${segments.join("/")}`.toLowerCase();
}

function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");
}

function applySecurityHeaders(response: Response, policy: string): Response {
  const secured = new Response(response.body, response);
  secured.headers.set("Content-Security-Policy", policy);
  secured.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  secured.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  secured.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("X-Frame-Options", "DENY");
  return secured;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const nonce = btoa(crypto.randomUUID());
    const policy = contentSecurityPolicy(nonce);
    const pathname = normalizePathname(url.pathname);

    if (pathname === null) {
      return applySecurityHeaders(new Response("Bad Request", {
        status: 400,
        headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
      }), policy);
    }

    if (isBlockedPublicPreviewPath(pathname)) {
      return applySecurityHeaders(new Response("Not Found", {
        status: 404,
        headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
      }), policy);
    }

    if (pathname.startsWith("/api/") && pathname !== "/api/health") {
      return applySecurityHeaders(Response.json({ error: "Not Found" }, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      }), policy);
    }

    if (pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(
        request,
        {
          fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES
              .input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths,
      );
      return applySecurityHeaders(response, policy);
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", policy);
    const response = await handler.fetch(new Request(request, { headers: requestHeaders }), env, ctx);
    return applySecurityHeaders(response, policy);
  },
};

export default worker;
