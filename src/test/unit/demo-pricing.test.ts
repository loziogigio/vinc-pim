import { describe, it, expect } from "vitest";
import {
  DEMO_DISCOUNT_PREFIX, DEMO_TAG_PREMIUM, DEMO_TAG_STANDARD,
  PREMIUM_FACTOR, buildPiecePricing, buildPackPricing,
} from "../../../scripts/demo/demo-pricing";

describe("generative demo pricing", () => {
  it("premium=×0.85 and standard=×0.93 vs list, both tag-filtered", () => {
    const tiers = buildPiecePricing(10);
    const premium = tiers.find((t) => t.tag_filter?.includes(DEMO_TAG_PREMIUM));
    const standard = tiers.find((t) => t.tag_filter?.includes(DEMO_TAG_STANDARD));
    expect(premium!.list).toBeCloseTo(8.5, 2);
    expect(standard!.list).toBeCloseTo(9.3, 2);
    expect(premium!.tag_filter).toEqual([DEMO_TAG_PREMIUM]);
  });

  it("bulk pack stacks the -8%/unit on top of the persona factor", () => {
    const tiers = buildPackPricing(10, 12); // list 10, pack of 12
    const premium = tiers.find((t) => t.tag_filter?.includes(DEMO_TAG_PREMIUM))!;
    expect(premium.list_unit).toBeCloseTo(10 * PREMIUM_FACTOR * 0.92, 2);
    expect(premium.list).toBeCloseTo(premium.list_unit! * 12, 2);
  });

  it("exposes the full_tag strings the customers carry", () => {
    expect(DEMO_TAG_PREMIUM).toBe(`${DEMO_DISCOUNT_PREFIX}:premium`);
    expect(DEMO_TAG_STANDARD).toBe(`${DEMO_DISCOUNT_PREFIX}:standard`);
  });
});
