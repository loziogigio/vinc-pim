import { describe, it, expect } from "vitest";
import { buildTrovaPrezziXml } from "@/lib/feeds/adapters/trovaprezzi";
import type { FeedProduct } from "@/lib/feeds/canonical";

const FP: FeedProduct = {
  entity_code: "LED-001",
  sku: "LED-001",
  title: "Lampada LED & Co",
  description: "Una <bella> lampada",
  link: "https://shop.x/p/lampada-led?a=1&b=2",
  image_link: "https://cdn.x/1.jpg",
  additional_image_links: [],
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

describe("trovaprezzi adapter", () => {
  it("builds a valid XML document with escaped values", () => {
    const xml = buildTrovaPrezziXml([FP], { shippingCost: 4.9 });
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<Products>");
    expect(xml).toContain("<Offer>");
    expect(xml).toContain("<Name>Lampada LED &amp; Co</Name>");
    expect(xml).toContain("<Description>Una &lt;bella&gt; lampada</Description>");
    expect(xml).toContain("<Link>https://shop.x/p/lampada-led?a=1&amp;b=2</Link>");
    expect(xml).toContain("<Code>LED-001</Code>");
    expect(xml).toContain("<Price>19.90</Price>"); // sale price wins
    expect(xml).toContain("<ListPrice>25.00</ListPrice>");
    expect(xml).toContain("<Brand>Deodato</Brand>");
    expect(xml).toContain("<EanCode>8001234567890</EanCode>");
    expect(xml).toContain("<Image>https://cdn.x/1.jpg</Image>");
    expect(xml).toContain("<Categories>Casa &gt; Illuminazione</Categories>");
    expect(xml).toContain("<ShippingCost>4.90</ShippingCost>");
    expect(xml).toContain("<Stock>5</Stock>");
    expect(xml).toContain("</Products>");
  });

  it("uses list price when no sale price and defaults shipping to 0.00", () => {
    const xml = buildTrovaPrezziXml([{ ...FP, sale_price: undefined }], {});
    expect(xml).toContain("<Price>25.00</Price>");
    expect(xml).not.toContain("<ListPrice>");
    expect(xml).toContain("<ShippingCost>0.00</ShippingCost>");
  });

  it("emits an empty Products element for no products", () => {
    expect(buildTrovaPrezziXml([], {})).toContain("<Products></Products>");
  });
});
