import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  updateTenant: vi.fn(),
}));

vi.mock("@/lib/auth/admin-auth", () => ({
  verifyAdminAuth: vi.fn(async () => ({
    admin: { email: "root@example.com" },
  })),
  unauthorizedResponse: vi.fn(),
}));

vi.mock("@/lib/services/admin-tenant.service", () => ({
  getTenant: vi.fn(),
  updateTenant: mocks.updateTenant,
  deleteTenant: vi.fn(),
}));

import { PATCH } from "@/app/api/admin/tenants/[id]/route";

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/tenants/acme", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ id: "acme" }) };

describe("PATCH /api/admin/tenants/[id] B2B storefront config", () => {
  beforeEach(() => {
    mocks.updateTenant.mockReset();
    mocks.updateTenant.mockResolvedValue({
      toObject: () => ({ tenant_id: "acme" }),
    });
  });

  it("passes the validated theme and pricing source to the tenant service", async () => {
    const response = await PATCH(
      patchRequest({
        b2b_theme: "time",
        features: { pricing_source: "erp", is_demo: false },
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.updateTenant).toHaveBeenCalledWith("acme", {
      b2b_theme: "time",
      features: { pricing_source: "erp" },
    });
  });

  it("applies status and storefront config in one tenant update", async () => {
    const response = await PATCH(
      patchRequest({
        status: "suspended",
        b2b_theme: "time",
        features: { pricing_source: "erp" },
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.updateTenant).toHaveBeenCalledOnce();
    expect(mocks.updateTenant).toHaveBeenCalledWith("acme", {
      b2b_theme: "time",
      features: { pricing_source: "erp" },
      status: "suspended",
    });
    expect(await response.json()).toMatchObject({
      message: "Tenant 'acme' has been suspended",
    });
  });

  it("forwards an explicitly cleared ERP URL", async () => {
    const api = { erp_url: "" };

    const response = await PATCH(patchRequest({ api }), context);

    expect(response.status).toBe(200);
    expect(mocks.updateTenant).toHaveBeenCalledWith("acme", { api });
  });

  it("rejects an unknown storefront theme", async () => {
    const response = await PATCH(
      patchRequest({ b2b_theme: "uploaded-theme" }),
      context,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("Invalid b2b_theme"),
    });
    expect(mocks.updateTenant).not.toHaveBeenCalled();
  });

  it("rejects an unknown pricing source", async () => {
    const response = await PATCH(
      patchRequest({ features: { pricing_source: "csv" } }),
      context,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("Invalid features.pricing_source"),
    });
    expect(mocks.updateTenant).not.toHaveBeenCalled();
  });
});
