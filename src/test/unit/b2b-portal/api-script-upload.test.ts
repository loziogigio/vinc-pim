// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { File as NodeFile } from "node:buffer";
import { NextRequest } from "next/server";

const {
  accessMock,
  authMock,
  cdnConfigMock,
  migratedMock,
  portalExistsMock,
  uploadMock,
} = vi.hoisted(() => ({
  accessMock: vi.fn(),
  authMock: vi.fn(),
  cdnConfigMock: vi.fn(),
  migratedMock: vi.fn(),
  portalExistsMock: vi.fn(),
  uploadMock: vi.fn(),
}));

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: authMock,
}));

vi.mock("@/lib/services/cdn-config", () => ({
  getCdnConfig: cdnConfigMock,
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

vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(async () => ({
    B2BPortal: { exists: portalExistsMock },
  })),
}));

vi.mock("vinc-cdn", () => ({
  uploadToCdn: uploadMock,
}));

const { POST } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/scripts/upload/route"
);

const ctx = { params: Promise.resolve({ slug: "default" }) };

function requestWithFile(file?: File): NextRequest {
  // Keep the route unit test independent of jsdom/undici multipart realm
  // differences; Next.js owns multipart parsing, this handler owns validation.
  const request = Object.create(NextRequest.prototype) as NextRequest;
  Object.defineProperty(request, "formData", {
    value: vi.fn(async () => ({
      get: (key: string) => (key === "file" ? file || null : null),
    } as unknown as FormData)),
  });
  return request;
}

function javascriptFile(
  name = "analytics.js",
  type = "text/javascript",
): File {
  return new NodeFile(["window.analytics = true;"], name, {
    type,
  }) as unknown as File;
}

describe("POST /api/b2b/b2b/portals/[slug]/scripts/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessMock.mockResolvedValue(true);
    authMock.mockResolvedValue({
      success: true,
      tenantId: "test",
      tenantDb: "vinc-test",
      userId: "staff-1",
      userType: "b2b_user",
      authMethod: "session",
    });
    portalExistsMock.mockResolvedValue({ _id: "portal-1" });
    migratedMock.mockResolvedValue(true);
    cdnConfigMock.mockResolvedValue({
      endpoint: "https://cdn.example.com",
      region: "eu-1",
      bucket: "assets",
      accessKeyId: "key",
      secretAccessKey: "secret",
      folder: "uploads",
    });
    uploadMock.mockResolvedValue({
      url: "https://cdn.example.com/assets/uploads/script.js",
      key: "uploads/script.js",
    });
  });

  it("uploads a validated file under the authenticated tenant portal", async () => {
    const response = await POST(requestWithFile(javascriptFile()), ctx);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      success: true,
      url: "https://cdn.example.com/assets/uploads/script.js",
      fileName: "analytics.js",
      contentType: "text/javascript",
    });
    expect(authMock).toHaveBeenCalledWith(expect.any(NextRequest), {
      requireUserId: true,
    });
    expect(accessMock).toHaveBeenCalledWith("test");
    expect(accessMock).toHaveBeenCalledWith("test");
    expect(portalExistsMock).toHaveBeenCalledWith({ slug: "default" });
    expect(cdnConfigMock).toHaveBeenCalledWith("vinc-test");
    expect(uploadMock).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: "assets" }),
      expect.objectContaining({
        contentType: "text/javascript",
        fileName: "analytics.js",
        customFolder: "uploads/b2b/test/portals/default/scripts",
      }),
    );
  });

  it("returns the authentication failure before inspecting the upload", async () => {
    authMock.mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const response = await POST(requestWithFile(javascriptFile()), ctx);

    expect(response.status).toBe(401);
    expect(accessMock).not.toHaveBeenCalled();
    expect(portalExistsMock).not.toHaveBeenCalled();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("requires portal-builder access and a migrated tenant", async () => {
    authMock.mockResolvedValueOnce({
      success: true,
      tenantId: "test",
      tenantDb: "vinc-test",
      userId: "api-owner",
      userType: "portal_user",
      authMethod: "api-key",
    });
    const nonStaff = await POST(requestWithFile(javascriptFile()), ctx);
    expect(nonStaff.status).toBe(403);
    expect(accessMock).not.toHaveBeenCalled();

    accessMock.mockResolvedValueOnce(false);
    const forbidden = await POST(requestWithFile(javascriptFile()), ctx);
    expect(forbidden.status).toBe(403);
    expect(accessMock).toHaveBeenLastCalledWith("test");
    expect(migratedMock).not.toHaveBeenCalled();

    accessMock.mockResolvedValueOnce(true);
    migratedMock.mockResolvedValueOnce(false);
    const notMigrated = await POST(requestWithFile(javascriptFile()), ctx);
    expect(notMigrated.status).toBe(409);
    expect((await notMigrated.json()).code).toBe("NOT_MIGRATED");
    expect(portalExistsMock).not.toHaveBeenCalled();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("rejects an upload for an unknown portal", async () => {
    portalExistsMock.mockResolvedValue(null);

    const response = await POST(requestWithFile(javascriptFile()), ctx);

    expect(response.status).toBe(404);
    expect(cdnConfigMock).not.toHaveBeenCalled();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("rejects missing files and invalid JavaScript MIME", async () => {
    const missing = await POST(requestWithFile(), ctx);
    expect(missing.status).toBe(400);

    const invalid = await POST(
      requestWithFile(javascriptFile("analytics.js", "text/plain")),
      ctx,
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({
      error: "File MIME type must be JavaScript",
    });
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("requires a configured HTTPS CDN", async () => {
    cdnConfigMock.mockResolvedValueOnce(null);
    const missing = await POST(requestWithFile(javascriptFile()), ctx);
    expect(missing.status).toBe(503);

    cdnConfigMock.mockResolvedValueOnce({
      endpoint: "http://cdn.example.com",
      region: "eu-1",
      bucket: "assets",
      accessKeyId: "key",
      secretAccessKey: "secret",
    });
    const insecure = await POST(requestWithFile(javascriptFile()), ctx);
    expect(insecure.status).toBe(503);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("does not expose a non-HTTPS URL returned by the CDN", async () => {
    uploadMock.mockResolvedValue({
      url: "http://cdn.example.com/assets/script.js",
      key: "script.js",
    });

    const response = await POST(requestWithFile(javascriptFile()), ctx);

    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain("secure asset URL");
  });
});
