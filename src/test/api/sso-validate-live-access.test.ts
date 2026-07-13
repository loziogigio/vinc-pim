import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  liveAccess: null as any,
  resolveLivePortalAccess: vi.fn(),
}));

vi.mock("@/lib/sso/tokens", () => ({
  validateAccessToken: vi.fn(async () => ({
    sub: "user-1",
    tenant_id: "acme",
    session_id: "session-1",
    client_id: "vinc-b2b",
    email: "user@example.com",
    role: "reseller",
    exp: 9999999999,
    iat: 1,
    jti: "token-1",
  })),
}));

vi.mock("@/lib/sso/session", () => ({
  validateSession: vi.fn(async () => ({
    tenant_id: "acme",
    user_id: "user-1",
    vinc_profile: {
      id: "user-1",
      email: "user@example.com",
      role: "reseller",
      customers: [],
      has_password: true,
    },
  })),
}));

vi.mock("@/lib/sso/live-portal-access", () => ({
  resolveLivePortalAccess: (...args: any[]) =>
    mocks.resolveLivePortalAccess(...args),
}));

import { GET, POST } from "@/app/api/auth/validate/route";

function request(method: "GET" | "POST") {
  return new NextRequest("http://localhost/api/auth/validate", {
    method,
    headers: { authorization: "Bearer token" },
  });
}

beforeEach(() => {
  mocks.liveAccess = {
    profile: {
      id: "user-1",
      email: "user@example.com",
      role: "reseller",
      customers: [{
        id: "customer-1",
        erp_customer_id: "C1",
        addresses: [{ id: "address-1", erp_address_id: "A1" }],
      }],
      has_password: true,
    },
  };
  mocks.resolveLivePortalAccess.mockReset();
  mocks.resolveLivePortalAccess.mockImplementation(() => mocks.liveAccess);
});

describe("SSO validation uses live portal access", () => {
  it("GET returns the live-filtered customer profile", async () => {
    const response = await GET(request("GET"));
    const json = await response.json();

    expect(json.authenticated).toBe(true);
    expect(json.user.customers).toEqual(
      mocks.liveAccess.profile.customers,
    );
    expect(mocks.resolveLivePortalAccess).toHaveBeenCalledWith(
      "vinc-acme",
      "acme",
      "user-1",
      expect.any(Object),
    );
  });

  it("GET rejects a deactivated or deleted portal user", async () => {
    mocks.liveAccess = null;

    const response = await GET(request("GET"));

    expect(await response.json()).toEqual({ authenticated: false });
  });

  it("POST token introspection reports an inactive portal user", async () => {
    mocks.liveAccess = null;

    const response = await POST(request("POST"));
    const json = await response.json();

    expect(json.active).toBe(false);
    expect(json.reason).toContain("inactive");
  });
});
