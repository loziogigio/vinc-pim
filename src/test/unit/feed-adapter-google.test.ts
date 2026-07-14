import { describe, it, expect } from "vitest";
import { toGoogleProductInput, googleOfferId } from "@/lib/feeds/adapters/google";
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

describe("google adapter", () => {
  it("serializes a product input", () => {
    const p = toGoogleProductInput(FP, { contentLanguage: "it", feedLabel: "IT" });
    expect(p.offerId).toBe("LED-001");
    expect(p.contentLanguage).toBe("it");
    expect(p.feedLabel).toBe("IT");
    const attrs = p.attributes as Record<string, unknown>;
    expect(attrs.title).toBe("Lampada LED");
    expect(attrs.availability).toBe("in stock"); // Google uses spaces
    expect(attrs.price).toEqual({ amountMicros: "25000000", currencyCode: "EUR" });
    expect(attrs.salePrice).toEqual({ amountMicros: "19900000", currencyCode: "EUR" });
    expect(attrs.gtin).toBe("8001234567890");
    expect(attrs.brand).toBe("Deodato");
    expect(attrs.productTypes).toEqual(["Casa > Illuminazione"]);
    expect(attrs.condition).toBe("new");
    expect(attrs.link).toBe(FP.link);
    expect(attrs.imageLink).toBe(FP.image_link);
    expect(attrs.additionalImageLinks).toEqual(FP.additional_image_links);
  });

  it("omits optional fields when absent", () => {
    const p = toGoogleProductInput(
      { ...FP, sale_price: undefined, gtin: undefined, brand: undefined, category_path: undefined, image_link: undefined, additional_image_links: [] },
      { contentLanguage: "it", feedLabel: "IT" }
    );
    const attrs = p.attributes as Record<string, unknown>;
    expect(attrs).not.toHaveProperty("salePrice");
    expect(attrs).not.toHaveProperty("gtin");
    expect(attrs).not.toHaveProperty("brand");
    expect(attrs).not.toHaveProperty("productTypes");
    expect(attrs).not.toHaveProperty("imageLink");
    expect(attrs).not.toHaveProperty("additionalImageLinks");
  });

  it("maps availability enum with spaces", () => {
    const out = toGoogleProductInput({ ...FP, availability: "out_of_stock" }, { contentLanguage: "it", feedLabel: "IT" });
    expect((out.attributes as Record<string, unknown>).availability).toBe("out of stock");
    expect(googleOfferId(FP)).toBe("LED-001");
  });
});
