import { describe, it, expect } from "vitest";
import { stripNonPublicForGuests } from "@/lib/search/strip-non-public";

function product() {
  return {
    entity_code: "E1",
    media: [
      { url: "a", is_public: true },
      { url: "b", is_public: false },
      { url: "c" }, // missing → public
    ],
    dynamic_blocks: [
      {
        id: "blk1", lang: "it", section: 1, order: 0, columns: 2, is_active: true,
        elements: [
          { id: "e1", kind: "text", text: "pub", is_public: true },
          { id: "e2", kind: "text", text: "secret", is_public: false },
          { id: "e3", kind: "text", text: "default" }, // missing → public
        ],
      },
      {
        id: "blk2", lang: "it", section: 1, order: 1, columns: 2, is_active: true,
        elements: [{ id: "e4", kind: "text", text: "secret-only", is_public: false }],
      },
    ],
  };
}

describe("unit: stripNonPublicForGuests", () => {
  it("returns input unchanged when authenticated", () => {
    const input = [product()];
    const out = stripNonPublicForGuests(input, true);
    expect(out).toBe(input);
  });

  it("drops is_public:false media for guests, keeps public + missing", () => {
    const out = stripNonPublicForGuests([product()], false);
    expect(out[0].media.map((m: any) => m.url)).toEqual(["a", "c"]);
  });

  it("drops is_public:false elements for guests, keeps public + missing", () => {
    const out = stripNonPublicForGuests([product()], false);
    expect(out[0].dynamic_blocks[0].elements.map((e: any) => e.id)).toEqual(["e1", "e3"]);
  });

  it("drops a block left with zero public elements", () => {
    const out = stripNonPublicForGuests([product()], false);
    expect(out[0].dynamic_blocks.map((b: any) => b.id)).toEqual(["blk1"]);
  });

  it("strips nested variants too", () => {
    const parent: any = { entity_code: "P", variants: [product()] };
    const out = stripNonPublicForGuests([parent], false);
    expect(out[0].variants[0].media.map((m: any) => m.url)).toEqual(["a", "c"]);
    expect(out[0].variants[0].dynamic_blocks.map((b: any) => b.id)).toEqual(["blk1"]);
  });

  it("tolerates products without media/dynamic_blocks", () => {
    const out = stripNonPublicForGuests([{ entity_code: "X" }], false);
    expect(out[0]).toEqual({ entity_code: "X" });
  });
});
