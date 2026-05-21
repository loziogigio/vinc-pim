import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock the host → tenant resolver and the resolver service.
vi.mock("@/lib/tenant/host-resolver", () => ({
  resolveTenantIdByHost: vi.fn(),
}));
vi.mock("@/lib/services/b2b-product-resolver.service", () => ({
  resolveProductBySlug: vi.fn(),
}));

const { GET } = await import("@/app/api/public/b2b/resolve-product/route");
const { resolveTenantIdByHost } = await import("@/lib/tenant/host-resolver");
const { resolveProductBySlug } =
  await import("@/lib/services/b2b-product-resolver.service");

function req(path: string, host = "shop.example.com") {
  return new NextRequest(`http://localhost${path}`, {
    headers: { host },
  });
}

describe("GET /api/public/b2b/resolve-product", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with the resolved product shape", async () => {
    vi.mocked(resolveTenantIdByHost).mockResolvedValue("tenant-a");
    vi.mocked(resolveProductBySlug).mockResolvedValue({
      sku: "SKU-1",
      parentSku: null,
      name: "Trapano",
      slug: "trapano",
      categoryAncestors: ["root", "leaf"],
      found: true,
    });

    const res = await GET(
      req("/api/public/b2b/resolve-product?slug=trapano&lang=it"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      sku: "SKU-1",
      parentSku: null,
      name: "Trapano",
      slug: "trapano",
      categoryAncestors: ["root", "leaf"],
      found: true,
    });
    // Scoped to the host-resolved tenant.
    expect(resolveProductBySlug).toHaveBeenCalledWith(
      "vinc-tenant-a",
      "trapano",
      "it",
    );
  });

  it("returns 404 { found:false } when the product is not found", async () => {
    vi.mocked(resolveTenantIdByHost).mockResolvedValue("tenant-a");
    vi.mocked(resolveProductBySlug).mockResolvedValue({ found: false });

    const res = await GET(
      req("/api/public/b2b/resolve-product?slug=nope&lang=it"),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ found: false });
  });

  it("returns 404 when the host maps to no tenant", async () => {
    vi.mocked(resolveTenantIdByHost).mockResolvedValue(null);
    const res = await GET(
      req("/api/public/b2b/resolve-product?slug=trapano&lang=it"),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ found: false });
    expect(resolveProductBySlug).not.toHaveBeenCalled();
  });

  it("returns 404 when slug is missing", async () => {
    const res = await GET(req("/api/public/b2b/resolve-product?lang=it"));
    expect(res.status).toBe(404);
    expect(resolveTenantIdByHost).not.toHaveBeenCalled();
  });

  it("defaults lang to 'it' when omitted", async () => {
    vi.mocked(resolveTenantIdByHost).mockResolvedValue("tenant-a");
    vi.mocked(resolveProductBySlug).mockResolvedValue({ found: false });
    await GET(req("/api/public/b2b/resolve-product?slug=x"));
    expect(resolveProductBySlug).toHaveBeenCalledWith(
      "vinc-tenant-a",
      "x",
      "it",
    );
  });
});
