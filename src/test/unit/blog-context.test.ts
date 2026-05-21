import { describe, it, expect } from "vitest";
import { resolveB2CBlogContext } from "@/components/blog/context";

describe("unit: resolveB2CBlogContext", () => {
  it("maps a storefront record to a channel context", () => {
    const ctx = resolveB2CBlogContext({ slug: "my-shop", name: "My Shop", channel: "b2c-de" });
    expect(ctx).toEqual({
      channel: "b2c-de",
      label: "My Shop",
      basePath: "/b2b/b2c/storefronts/my-shop/blog",
    });
  });

  it("falls back to the slug as label and 'default' channel when missing", () => {
    const ctx = resolveB2CBlogContext({ slug: "shop2" });
    expect(ctx.channel).toBe("default");
    expect(ctx.label).toBe("shop2");
    expect(ctx.basePath).toBe("/b2b/b2c/storefronts/shop2/blog");
  });
});
