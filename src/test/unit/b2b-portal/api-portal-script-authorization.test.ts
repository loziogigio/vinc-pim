// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  accessMock,
  authMock,
  invalidateMock,
  migratedMock,
  updatePortalMock,
} = vi.hoisted(() => ({
  accessMock: vi.fn(),
  authMock: vi.fn(),
  invalidateMock: vi.fn(),
  migratedMock: vi.fn(),
  updatePortalMock: vi.fn(),
}));

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: authMock,
}));

vi.mock("@/lib/auth/home-builder-access", () => ({
  hasHomeBuilderAccess: accessMock,
}));

vi.mock("@/lib/services/b2b-portal-migration-flag.service", () => ({
  isTenantMigrated: migratedMock,
  NOT_MIGRATED_RESPONSE_BODY: {
    error: "B2B portal not migrated for this tenant.",
    code: "NOT_MIGRATED",
  },
}));

vi.mock("@/lib/services/b2b-portal.service", () => ({
  B2BPortalValidationError: class B2BPortalValidationError extends Error {},
  getPortalBySlug: vi.fn(),
  updatePortal: updatePortalMock,
  deletePortal: vi.fn(),
}));

vi.mock("@/lib/cache/redis-client", () => ({
  invalidateB2BCache: invalidateMock,
}));

const { PATCH } = await import("@/app/api/b2b/b2b/portals/[slug]/route");

const ctx = { params: Promise.resolve({ slug: "default" }) };

function patchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/b2b/b2b/portals/default", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const customScripts = [
  {
    label: "Analytics",
    src: "https://cdn.example.com/analytics.js",
    placement: "head",
    loading_strategy: "async",
    enabled: true,
  },
];

describe("portal custom_scripts PATCH authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      success: true,
      tenantId: "test",
      tenantDb: "vinc-test",
      userId: "staff-1",
      userType: "b2b_user",
      authMethod: "session",
    });
    accessMock.mockResolvedValue(true);
    migratedMock.mockResolvedValue(true);
    updatePortalMock.mockResolvedValue({
      slug: "default",
      custom_scripts: customScripts,
    });
  });

  it("rejects API-key and portal-user identities", async () => {
    authMock.mockResolvedValue({
      success: true,
      tenantId: "test",
      tenantDb: "vinc-test",
      userId: "api-owner",
      userType: "portal_user",
      authMethod: "api-key",
    });

    const response = await PATCH(patchRequest({ custom_scripts: customScripts }), ctx);

    expect(response.status).toBe(403);
    expect(accessMock).not.toHaveBeenCalled();
    expect(migratedMock).not.toHaveBeenCalled();
    expect(updatePortalMock).not.toHaveBeenCalled();
  });

  it("rejects staff without portal-builder authorization", async () => {
    accessMock.mockResolvedValue(false);

    const response = await PATCH(patchRequest({ custom_scripts: customScripts }), ctx);

    expect(response.status).toBe(403);
    expect(updatePortalMock).not.toHaveBeenCalled();
  });

  it("allows a staff session with portal-builder authorization", async () => {
    const response = await PATCH(patchRequest({ custom_scripts: customScripts }), ctx);

    expect(response.status).toBe(200);
    expect(accessMock).toHaveBeenCalledWith("test");
    expect(updatePortalMock).toHaveBeenCalledWith("vinc-test", "default", {
      custom_scripts: customScripts,
    });
  });

  it("does not change authorization for a patch without custom_scripts", async () => {
    authMock.mockResolvedValue({
      success: true,
      tenantId: "test",
      tenantDb: "vinc-test",
      userId: "api-owner",
      userType: "portal_user",
      authMethod: "api-key",
    });
    updatePortalMock.mockResolvedValue({ slug: "default", name: "Updated" });

    const response = await PATCH(patchRequest({ name: "Updated" }), ctx);

    expect(response.status).toBe(200);
    expect(accessMock).not.toHaveBeenCalled();
    expect(updatePortalMock).toHaveBeenCalledWith("vinc-test", "default", {
      name: "Updated",
    });
  });
});
