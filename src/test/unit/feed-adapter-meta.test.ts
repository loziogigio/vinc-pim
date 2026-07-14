import { describe, it, expect } from "vitest";
import { toMetaBatchRequest, toMetaDeleteRequest } from "@/lib/feeds/adapters/meta";
import type { FeedProduct } from "@/lib/feeds/canonical";

const FP: FeedProduct = {
  entity_code: "LED-001",
  sku: "LED-001",
  title: "Lampada LED",
  description: "Una bella lampada",
  link: "https://shop.x/p/lampada-led",
  image_link: "https://cdn.x/1.jpg",
  additional_image_links: ["https://cdn.x/2.jpg"],
  availability: "in_stock",
  quantity: 5,
  price: 25,
  sale_price: 19.9,
  currency: "EUR",
  gtin: "8001234567890",
  brand: "Deodato",
  category_path: "Casa > Illuminazione",
  condition: "new",
};

describe("meta adapter", () => {
  it("serializes an UPDATE request with cents pricing", () => {
    const r = toMetaBatchRequest(FP);
    expect(r.method).toBe("UPDATE");
    expect(r.retailer_id).toBe("LED-001");
    const d = r.data as Record<string, unknown>;
    expect(d.name).toBe("Lampada LED");
    expect(d.price).toBe(2500); // cents
    expect(d.sale_price).toBe(1990);
    expect(d.currency).toBe("EUR");
    expect(d.availability).toBe("in stock");
    expect(d.condition).toBe("new");
    expect(d.image_url).toBe("https://cdn.x/1.jpg");
    expect(d.additional_image_urls).toEqual(["https://cdn.x/2.jpg"]);
    expect(d.gtin).toBe("8001234567890");
    expect(d.brand).toBe("Deodato");
    expect(d.url).toBe(FP.link);
  });

  it("omits optionals and builds DELETE requests", () => {
    const r = toMetaBatchRequest({ ...FP, sale_price: undefined, gtin: undefined, brand: undefined, image_link: undefined, additional_image_links: [] });
    const d = r.data as Record<string, unknown>;
    expect(d).not.toHaveProperty("sale_price");
    expect(d).not.toHaveProperty("gtin");
    expect(d).not.toHaveProperty("brand");
    expect(d).not.toHaveProperty("image_url");
    const del = toMetaDeleteRequest("LED-001");
    expect(del).toEqual({ method: "DELETE", retailer_id: "LED-001" });
  });
});
