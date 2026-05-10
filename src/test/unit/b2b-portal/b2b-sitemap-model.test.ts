import { describe, it, expect } from "vitest";
import { B2BSitemapSchema } from "@/lib/db/models/b2b-sitemap";

describe("B2BSitemap model", () => {
  it("stores under collection b2bsitemaps", () => {
    expect(B2BSitemapSchema.get("collection")).toBe("b2bsitemaps");
  });

  it("has a portal_slug field (not storefront_slug)", () => {
    const paths = B2BSitemapSchema.paths;
    expect(paths.portal_slug).toBeDefined();
    expect(paths.storefront_slug).toBeUndefined();
  });
});
