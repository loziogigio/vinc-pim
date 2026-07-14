import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FeedProduct } from "@/lib/feeds/canonical";

const FP: FeedProduct = {
  entity_code: "LED-001", sku: "LED-001", title: "Lampada", description: "d",
  link: "https://x/p/1", image_link: "https://cdn.x/1.jpg", additional_image_links: [],
  availability: "in_stock", quantity: 1, price: 10, currency: "EUR", condition: "new",
};

const fetchMock = vi.fn();

describe("MetaCatalogClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("pushes a batch and maps per-item validation errors", async () => {
    const { MetaCatalogClient } = await import("@/lib/feeds/clients/meta-client");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        handles: ["h1"],
        validation_status: [
          { retailer_id: "LED-002", errors: [{ message: "Invalid image" }] },
        ],
      }),
    });
    const client = new MetaCatalogClient({ catalogId: "cat1", accessToken: "tok" });
    const results = await client.pushProducts([FP, { ...FP, entity_code: "LED-002" }]);
    expect(results).toEqual([
      { entity_code: "LED-001", ok: true },
      { entity_code: "LED-002", ok: false, error: expect.stringContaining("Invalid image") },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/cat1/items_batch");
    const body = init.body as URLSearchParams;
    expect(body.get("item_type")).toBe("PRODUCT_ITEM");
    expect(body.get("access_token")).toBe("tok");
    const requests = JSON.parse(body.get("requests")!);
    expect(requests[0].retailer_id).toBe("LED-001");
    expect(requests[0].method).toBe("UPDATE");
  });

  it("marks the whole chunk failed on HTTP error and sends DELETE requests", async () => {
    const { MetaCatalogClient } = await import("@/lib/feeds/clients/meta-client");
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom" });
    const client = new MetaCatalogClient({ catalogId: "cat1", accessToken: "tok" });
    const results = await client.deleteProducts(["LED-001", "LED-002"]);
    expect(results.every((r) => !r.ok)).toBe(true);
    expect(results[0].error).toContain("HTTP 500");
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    const requests = JSON.parse(body.get("requests")!);
    expect(requests[0]).toEqual({ method: "DELETE", retailer_id: "LED-001" });
  });
});
