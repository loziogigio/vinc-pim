import { describe, it, expect } from "vitest";
import { buildFeedProduct, feedContentHash } from "@/lib/feeds/canonical";

const OPTS = {
  lang: "it",
  channel: "default",
  currency: "EUR",
  productUrlTemplate: "https://shop.deodato.it/p/{slug}",
};

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    entity_code: "LED-001",
    sku: "LED-001",
    name: { it: "Lampada LED", en: "LED Lamp" },
    slug: { it: "lampada-led", en: "led-lamp" },
    description: { it: "Una <b>bella</b> lampada" },
    images: [
      { url: "https://cdn.x/2.jpg", position: 1 },
      { url: "https://cdn.x/1.jpg", position: 0 },
    ],
    quantity: 5,
    stock_status: "in_stock",
    unit: "pcs",
    brand: { label: "Deodato" },
    ean: ["8001234567890"],
    category: {
      category_id: "c1",
      name: { it: "LED" },
      hierarchy: [{ name: { it: "Casa" } }, { name: { it: "Illuminazione" } }],
    },
    pricing: { list: 25, sale: 19.9, currency: "EUR", vat_included: true },
    ...overrides,
  };
}

describe("buildFeedProduct", () => {
  it("maps a full product", () => {
    const fp = buildFeedProduct(fixture(), OPTS)!;
    expect(fp).not.toBeNull();
    expect(fp.title).toBe("Lampada LED");
    expect(fp.link).toBe("https://shop.deodato.it/p/lampada-led");
    expect(fp.image_link).toBe("https://cdn.x/1.jpg"); // position 0 wins
    expect(fp.additional_image_links).toEqual(["https://cdn.x/2.jpg"]);
    expect(fp.price).toBe(25);
    expect(fp.sale_price).toBe(19.9);
    expect(fp.gtin).toBe("8001234567890");
    expect(fp.brand).toBe("Deodato");
    expect(fp.availability).toBe("in_stock");
    expect(fp.category_path).toBe("Casa > Illuminazione > LED");
    expect(fp.condition).toBe("new");
  });

  it("falls back to another language for title and to {entity_code} in URL", () => {
    const fp = buildFeedProduct(
      fixture({ name: { en: "LED Lamp" }, slug: {} }),
      { ...OPTS, productUrlTemplate: "https://x/p/{entity_code}" }
    )!;
    expect(fp.title).toBe("LED Lamp");
    expect(fp.link).toBe("https://x/p/LED-001");
  });

  it("derives availability from quantity when stock_status missing", () => {
    expect(
      buildFeedProduct(fixture({ stock_status: undefined, quantity: 0 }), OPTS)!
        .availability
    ).toBe("out_of_stock");
    expect(
      buildFeedProduct(fixture({ stock_status: undefined, quantity: 3 }), OPTS)!
        .availability
    ).toBe("in_stock");
  });

  it("ignores sale price when not lower than list", () => {
    const fp = buildFeedProduct(
      fixture({ pricing: { list: 10, sale: 12, currency: "EUR" } }),
      OPTS
    )!;
    expect(fp.price).toBe(10);
    expect(fp.sale_price).toBeUndefined();
  });

  it("returns null without a usable title or price", () => {
    expect(buildFeedProduct(fixture({ name: {} }), OPTS)).toBeNull();
    expect(buildFeedProduct(fixture({ pricing: { list: 0 } }), OPTS)).toBeNull();
  });

  it("prefers channel-specific category and falls back to base category", () => {
    const withChannelCat = fixture({
      channel_categories: [
        {
          channel_code: "default",
          category: { name: { it: "Speciale" }, hierarchy: [] },
        },
      ],
    });
    expect(buildFeedProduct(withChannelCat, OPTS)!.category_path).toBe(
      "Speciale"
    );
    expect(
      buildFeedProduct(withChannelCat, { ...OPTS, channel: "b2b" })!
        .category_path
    ).toBe("Casa > Illuminazione > LED");
  });

  it("returns null when entity_code is missing or empty", () => {
    expect(buildFeedProduct(fixture({ entity_code: undefined }), OPTS)).toBeNull();
    expect(buildFeedProduct(fixture({ entity_code: "" }), OPTS)).toBeNull();
  });

  it("hash is stable and changes when content changes", () => {
    const a = feedContentHash(buildFeedProduct(fixture(), OPTS)!);
    const b = feedContentHash(buildFeedProduct(fixture(), OPTS)!);
    const c = feedContentHash(
      buildFeedProduct(fixture({ pricing: { list: 30, currency: "EUR" } }), OPTS)!
    );
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
