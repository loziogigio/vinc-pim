import { describe, it, expect } from "vitest";
import { contentHash } from "@/lib/utils/content-hash";

describe("contentHash", () => {
  it("is stable regardless of object key order", () => {
    expect(contentHash({ a: 1, b: 2, c: { d: 3, e: 4 } }))
      .toBe(contentHash({ c: { e: 4, d: 3 }, b: 2, a: 1 }));
  });

  it("ignores volatile/metadata top-level fields (the whole point)", () => {
    const content = { name: "Widget", price: 10, sku: "W1" };
    const withMeta = {
      ...content,
      version: 7,
      isCurrent: true,
      isCurrentPublished: false,
      updated_at: new Date().toISOString(),
      created_at: "2020-01-01",
      source: { job_id: "j1", imported_at: "now" },
      analytics: { views_30d: 99 },
      completeness_score: 80,
      content_hash: "stale",
    };
    expect(contentHash(withMeta)).toBe(contentHash(content));
  });

  it("changes when real content changes", () => {
    expect(contentHash({ name: "X", price: 10 }))
      .not.toBe(contentHash({ name: "X", price: 11 }));
  });

  it("respects array order (real content difference)", () => {
    expect(contentHash({ tags: ["a", "b"] }))
      .not.toBe(contentHash({ tags: ["b", "a"] }));
  });
});
