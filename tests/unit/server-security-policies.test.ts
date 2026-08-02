import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type AuthorizationModule = typeof import("../../src/lib/server/authorization");
type ActorRole = import("../../src/lib/server/authorization").ActorRole;
type AuthenticatedActor = import("../../src/lib/server/authorization").AuthenticatedActor;
type RequestSecurityModule = typeof import("../../src/lib/server/request-security");
type UploadPolicyModule = typeof import("../../src/lib/server/upload-policy");

let authorization: AuthorizationModule;
let requestSecurity: RequestSecurityModule;
let uploadPolicy: UploadPolicyModule;

beforeAll(async () => {
  [authorization, requestSecurity, uploadPolicy] = await Promise.all([
    import("../../src/lib/server/authorization"),
    import("../../src/lib/server/request-security"),
    import("../../src/lib/server/upload-policy"),
  ]);
});

describe("server authorization policy", () => {
  const advertiser: AuthenticatedActor = {
    userId: "user-advertiser",
    roles: ["ADVERTISER"],
    organizationIds: ["org-a"],
    mfaVerified: false,
    sessionId: "session-a",
  };

  it("allows an order participant and denies a cross-tenant read with the same role", () => {
    expect(
      authorization.isAuthorized(advertiser, "ORDER_READ", {
        advertiserUserId: advertiser.userId,
      }),
    ).toBe(true);
    expect(
      authorization.isAuthorized(advertiser, "ORDER_READ", {
        advertiserUserId: "different-user",
        organizationId: "org-b",
      }),
    ).toBe(false);
  });

  it("allows only the recorded advertiser and creator party roles for order collaboration", () => {
    const creator: AuthenticatedActor = {
      userId: "user-creator",
      roles: ["CREATOR"],
      organizationIds: [],
      mfaVerified: false,
      sessionId: "session-creator",
    };
    const order = {
      advertiserUserId: advertiser.userId,
      creatorUserId: creator.userId,
    };

    for (const permission of ["ORDER_READ", "ORDER_WRITE"] as const) {
      expect(authorization.isAuthorized(advertiser, permission, order)).toBe(true);
      expect(authorization.isAuthorized(creator, permission, order)).toBe(true);
      expect(
        authorization.isAuthorized(
          { ...advertiser, userId: "other-advertiser" },
          permission,
          order,
        ),
      ).toBe(false);
      expect(
        authorization.isAuthorized(
          { ...creator, userId: "other-creator" },
          permission,
          order,
        ),
      ).toBe(false);
    }
  });

  it.each(["SUPPORT", "FINANCE", "RISK", "ADMIN"] as const)(
    "denies %s order access both cross-tenant and at a party user id without a party role",
    (role: ActorRole) => {
      const order = {
        advertiserUserId: advertiser.userId,
        creatorUserId: "user-creator",
        organizationId: "org-a",
        ownerUserIds: [advertiser.userId],
      };
      const crossTenantStaff: AuthenticatedActor = {
        userId: `staff-${role.toLowerCase()}`,
        roles: [role],
        organizationIds: ["org-a"],
        mfaVerified: true,
        sessionId: `session-${role.toLowerCase()}`,
      };
      const partyIdWithoutPartyRole = {
        ...crossTenantStaff,
        userId: advertiser.userId,
      };

      for (const permission of ["ORDER_READ", "ORDER_WRITE"] as const) {
        expect(authorization.isAuthorized(crossTenantStaff, permission, order)).toBe(false);
        expect(authorization.isAuthorized(partyIdWithoutPartyRole, permission, order)).toBe(false);
      }
    },
  );

  it("does not treat organization membership, generic ownership, or an agency role as order-party access", () => {
    const agency: AuthenticatedActor = {
      userId: "agency-member",
      roles: ["AGENCY"],
      organizationIds: ["org-a"],
      mfaVerified: false,
      sessionId: "agency-session",
    };
    const resource = {
      advertiserUserId: "different-advertiser",
      creatorUserId: "different-creator",
      organizationId: "org-a",
      ownerUserIds: [agency.userId],
    };
    expect(authorization.isAuthorized(agency, "ORDER_READ", resource)).toBe(false);
    expect(authorization.isAuthorized(agency, "ORDER_WRITE", resource)).toBe(false);
  });

  it("requires MFA for privileged writes", () => {
    const finance = { ...advertiser, roles: ["FINANCE"] as const };
    expect(authorization.isAuthorized(finance, "REFUND_EXECUTE", {})).toBe(false);
    expect(authorization.isAuthorized({ ...finance, mfaVerified: true }, "REFUND_EXECUTE", {})).toBe(true);
  });
});

describe("request boundary policy", () => {
  it("rejects cross-origin state changes and accepts a same-origin request", () => {
    const crossOrigin = new Request("https://market.example/api/orders", {
      method: "POST",
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    });
    expect(() => requestSecurity.requireSameOrigin(crossOrigin, "https://market.example")).toThrow("Cross-site");

    const sameOrigin = new Request("https://market.example/api/orders", {
      method: "POST",
      headers: { origin: "https://market.example", "sec-fetch-site": "same-origin" },
    });
    expect(() => requestSecurity.requireSameOrigin(sameOrigin, "https://market.example")).not.toThrow();
  });

  it("requires a valid idempotency key", () => {
    expect(() => requestSecurity.requireIdempotencyHeader(new Request("https://market.example/api/refunds", { method: "POST" }))).toThrow();
    expect(requestSecurity.requireIdempotencyHeader(new Request("https://market.example/api/refunds", { method: "POST", headers: { "idempotency-key": "refund-order-42" } }))).toBe("refund-order-42");
  });

  it("rejects HTTP, metadata hosts, private DNS results, and custom ports", async () => {
    const publicLookup = vi.fn(async () => ["203.0.113.10"] as const);
    await expect(requestSecurity.resolveSafeHttpTarget("http://example.com", publicLookup)).rejects.toThrow("HTTPS");
    await expect(requestSecurity.resolveSafeHttpTarget("https://metadata.google.internal/compute", publicLookup)).rejects.toThrow("Private host");
    await expect(requestSecurity.resolveSafeHttpTarget("https://example.com:8443", publicLookup)).rejects.toThrow("custom ports");
    await expect(requestSecurity.resolveSafeHttpTarget("https://example.com", async () => ["127.0.0.1"])).rejects.toThrow("Private");
  });

  it("returns only a resolved public HTTPS target", async () => {
    const result = await requestSecurity.resolveSafeHttpTarget("https://example.com/product", async () => ["203.0.113.10"]);
    expect(result.url.href).toBe("https://example.com/product");
    expect(result.addresses).toEqual(["203.0.113.10"]);
  });
});

describe("private upload policy", () => {
  const validUpload = { name: "draft.mp4", declaredMime: "video/mp4", detectedMime: "video/mp4", sizeBytes: 1_024 };

  it("accepts an allowlisted private upload and builds an order-scoped key", () => {
    expect(() => uploadPolicy.validatePrivateUpload(validUpload)).not.toThrow();
    expect(uploadPolicy.createPrivateObjectKey({ orderId: "order_42", attachmentId: "draft_1", extension: ".mp4" })).toBe("private/orders/order_42/attachments/draft_1.mp4");
  });

  it("rejects mismatched MIME, path traversal names, oversize files, and unsafe identifiers", () => {
    expect(() => uploadPolicy.validatePrivateUpload({ ...validUpload, detectedMime: "application/pdf" })).toThrow("MIME");
    expect(() => uploadPolicy.validatePrivateUpload({ ...validUpload, name: "../draft.mp4" })).toThrow("filename");
    expect(() => uploadPolicy.validatePrivateUpload({ ...validUpload, sizeBytes: uploadPolicy.MAX_PRIVATE_UPLOAD_BYTES + 1 })).toThrow("size");
    expect(() => uploadPolicy.createPrivateObjectKey({ orderId: "../order", attachmentId: "draft", extension: ".mp4" })).toThrow("identifier");
  });
});
