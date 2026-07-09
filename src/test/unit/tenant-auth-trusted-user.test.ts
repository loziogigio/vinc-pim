import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verifyAPIKey: vi.fn(),
  getB2BSession: vi.fn(),
  validateAccessToken: vi.fn(),
  verifyPortalUserToken: vi.fn(),
  getSSOSessionModel: vi.fn(),
  resolveAuthorization: vi.fn(),
}));

vi.mock("@/lib/auth/api-key-auth", () => ({
  verifyAPIKey: mocks.verifyAPIKey,
}));

vi.mock("@/lib/auth/b2b-session", () => ({
  getB2BSession: mocks.getB2BSession,
}));

vi.mock("@/lib/sso/tokens", () => ({
  validateAccessToken: mocks.validateAccessToken,
}));

vi.mock("@/lib/auth/portal-user-token", () => ({
  verifyPortalUserToken: mocks.verifyPortalUserToken,
}));

vi.mock("@/lib/db/models/sso-session", () => ({
  getSSOSessionModel: mocks.getSSOSessionModel,
}));

vi.mock("@/lib/auth/authorization", () => ({
  resolveAuthorization: mocks.resolveAuthorization,
}));

import { authenticateTenant, requireTenantAuth } from "@/lib/auth/tenant-auth";

const AUTHZ = {
  permissions: [],
  entitledApps: [],
  ability: { can: () => false },
  scope: {},
  priceAccess: { canViewPrices: true },
  can: () => false,
};

function apiKeyHeaders(extra: Record<string, string> = {}) {
  return {
    "x-auth-method": "api-key",
    "x-api-key-id": "ak_baseprotection-com_abcdef123456",
    "x-api-secret": "sk_test",
    ...extra,
  };
}

describe("tenant auth trusted API-key user headers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyAPIKey.mockResolvedValue({
      valid: true,
      tenantId: "baseprotection-com",
      permissions: ["*"],
    });
    mocks.getB2BSession.mockResolvedValue(null);
    mocks.validateAccessToken.mockResolvedValue(null);
    mocks.verifyPortalUserToken.mockResolvedValue(null);
    mocks.resolveAuthorization.mockResolvedValue(AUTHZ);
  });

  it("accepts a trusted portal user id after API-key verification", async () => {
    const req = new NextRequest("http://localhost/api/b2b/likes/user", {
      headers: apiKeyHeaders({
        "x-user-id": "PU-hWI3XRM9",
        "x-user-type": "portal_user",
      }),
    });

    const auth = await authenticateTenant(req);

    expect(auth.authenticated).toBe(true);
    expect(auth.tenantId).toBe("baseprotection-com");
    expect(auth.userId).toBe("PU-hWI3XRM9");
    expect(auth.userType).toBe("portal_user");
    expect(auth.authMethod).toBe("api-key");
  });

  it("keeps the x-customer-id compatibility alias for B2B users", async () => {
    const req = new NextRequest("http://localhost/api/b2b/likes/user", {
      headers: apiKeyHeaders({
        "x-customer-id": "PU-hWI3XRM9",
        "x-user-type": "b2b_user",
      }),
    });

    const auth = await authenticateTenant(req);

    expect(auth.authenticated).toBe(true);
    expect(auth.userId).toBe("PU-hWI3XRM9");
    expect(auth.userType).toBe("b2b_user");
  });

  it("does not trust user headers when the API key is invalid", async () => {
    mocks.verifyAPIKey.mockResolvedValueOnce({
      valid: false,
      error: "Invalid API secret",
    });

    const req = new NextRequest("http://localhost/api/b2b/likes/user", {
      headers: apiKeyHeaders({
        "x-user-id": "PU-hWI3XRM9",
        "x-user-type": "portal_user",
      }),
    });

    const auth = await authenticateTenant(req);

    expect(auth.authenticated).toBe(false);
    expect(auth.error).toBe("Invalid API secret");
  });

  it("satisfies requireUserId for proxied likes/reminders requests", async () => {
    const req = new NextRequest("http://localhost/api/b2b/likes/toggle", {
      headers: apiKeyHeaders({
        "x-user-id": "PU-hWI3XRM9",
        "x-user-type": "b2b_user",
      }),
    });

    const auth = await requireTenantAuth(req, { requireUserId: true });

    expect(auth.success).toBe(true);
    if (auth.success) {
      expect(auth.userId).toBe("PU-hWI3XRM9");
      expect(auth.userType).toBe("b2b_user");
    }
  });
});
