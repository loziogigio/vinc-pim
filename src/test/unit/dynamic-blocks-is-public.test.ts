import { describe, it, expect } from "vitest";
import { validateDynamicBlocks, sanitizeDynamicBlocks } from "@/lib/validation/dynamic-blocks";

const LANGS = ["it", "en", "de", "cs", "sk"];
const block = (elements: any[]): any => ({
  id: "blk", lang: "it", section: 1, order: 0, columns: 2, is_active: true, elements,
});

describe("unit: dynamic-blocks is_public", () => {
  it("validates an element carrying is_public:false", () => {
    const res = validateDynamicBlocks(
      [block([{ id: "e1", kind: "text", text: "hi", is_public: false }])],
      LANGS,
    );
    expect(res).toEqual({ valid: true, errors: [] });
  });

  it("rejects a non-boolean is_public", () => {
    const res = validateDynamicBlocks(
      [block([{ id: "e1", kind: "text", text: "hi", is_public: "nope" }])],
      LANGS,
    );
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("is_public"))).toBe(true);
  });

  it("sanitize preserves is_public:false on a kept element", () => {
    const out = sanitizeDynamicBlocks([
      block([{ id: "e1", kind: "image", media: { url: "https://cdn/x.png" }, is_public: false }]),
    ]);
    expect((out[0].elements[0] as any).is_public).toBe(false);
  });

  it("sanitize leaves is_public undefined when absent (default applies downstream)", () => {
    const out = sanitizeDynamicBlocks([
      block([{ id: "e1", kind: "text", text: "hi" }]),
    ]);
    expect((out[0].elements[0] as any).is_public).toBeUndefined();
  });
});
