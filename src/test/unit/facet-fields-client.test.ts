import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchFacetFields } from "@/lib/search/facet-fields-client";

describe("fetchFacetFields", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("sends the X-Tenant-ID header so the proxy admits the session call", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ fields: [{ field: "brand_id" }], degraded: false }),
    });

    await fetchFacetFields("baseprotection-com");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/search/facet-fields",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({ "X-Tenant-ID": "baseprotection-com" }),
      }),
    );
  });

  it("returns parsed fields and degraded flag", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        fields: [{ field: "brand_id" }, { field: "spec_color_s" }],
        degraded: true,
      }),
    });

    const result = await fetchFacetFields("t1");
    expect(result.fields).toHaveLength(2);
    expect(result.degraded).toBe(true);
  });

  it("throws on a non-2xx response", async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 401 });
    await expect(fetchFacetFields("t1")).rejects.toThrow("401");
  });
});
