import { describe, it, expect } from "vitest";
import { validateDynamicBlocks } from "@/lib/validation/dynamic-blocks";
import type { DynamicBlock } from "@/lib/types/dynamic-blocks";
import {
  DYNAMIC_BLOCKS_MAX_COUNT,
  DYNAMIC_BLOCK_MAX_ELEMENTS,
} from "@/lib/constants/dynamic-blocks";

function validBlock(overrides: Partial<DynamicBlock> = {}): DynamicBlock {
  return {
    id: "blk_01",
    lang: "it",
    title: "Brevetti",
    section: 1,
    order: 0,
    columns: 2,
    is_active: true,
    elements: [
      {
        id: "e1",
        kind: "image",
        media: { url: "https://cdn.example/patent1.png", cdn_key: "k1" },
        link: { href: "https://patents.example/1", new_tab: true },
        description: "Descrizione 1",
      },
      { id: "e2", kind: "text", text: "Brevetto n. 12345" },
    ],
    ...overrides,
  };
}

describe("unit: validateDynamicBlocks", () => {
  it("accepts a well-formed block array", () => {
    const res = validateDynamicBlocks([validBlock()]);
    expect(res).toEqual({ valid: true, errors: [] });
  });

  it("accepts an empty array", () => {
    expect(validateDynamicBlocks([])).toEqual({ valid: true, errors: [] });
  });

  it("rejects a non-array payload", () => {
    const res = validateDynamicBlocks({ not: "an array" });
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it("rejects more than the max number of blocks", () => {
    const blocks = Array.from({ length: DYNAMIC_BLOCKS_MAX_COUNT + 1 }, (_, i) =>
      validBlock({ id: `blk_${i}` })
    );
    const res = validateDynamicBlocks(blocks);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes(String(DYNAMIC_BLOCKS_MAX_COUNT)))).toBe(true);
  });

  it("rejects more than the max number of elements in a block", () => {
    const elements = Array.from({ length: DYNAMIC_BLOCK_MAX_ELEMENTS + 1 }, (_, i) => ({
      id: `e${i}`,
      kind: "text" as const,
      text: `t${i}`,
    }));
    const res = validateDynamicBlocks([validBlock({ elements })]);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes(String(DYNAMIC_BLOCK_MAX_ELEMENTS)))).toBe(true);
  });

  it("rejects an out-of-range columns value", () => {
    const res = validateDynamicBlocks([validBlock({ columns: 9 as any })]);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.toLowerCase().includes("columns"))).toBe(true);
  });

  it("rejects an out-of-range section value", () => {
    const res = validateDynamicBlocks([validBlock({ section: 5 as any })]);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.toLowerCase().includes("section"))).toBe(true);
  });

  it("rejects an invalid catalog language", () => {
    const res = validateDynamicBlocks([validBlock({ lang: "fr" })]);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.toLowerCase().includes("lang"))).toBe(true);
  });

  it("accepts all enabled catalog languages", () => {
    for (const lang of ["it", "de", "en", "cs", "sk"]) {
      expect(validateDynamicBlocks([validBlock({ lang })]).valid).toBe(true);
    }
  });

  it("rejects a javascript: url in media.url", () => {
    const res = validateDynamicBlocks([
      validBlock({
        elements: [
          // eslint-disable-next-line no-script-url
          { id: "e1", kind: "image", media: { url: "javascript:alert(1)" } },
        ],
      }),
    ]);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.toLowerCase().includes("url"))).toBe(true);
  });

  it("rejects a data: url in media.url", () => {
    const res = validateDynamicBlocks([
      validBlock({
        elements: [
          { id: "e1", kind: "image", media: { url: "data:text/html;base64,PHN2Zz4=" } },
        ],
      }),
    ]);
    expect(res.valid).toBe(false);
  });

  it("rejects a javascript: url in link.href", () => {
    const res = validateDynamicBlocks([
      validBlock({
        elements: [
          {
            id: "e1",
            kind: "image",
            media: { url: "https://cdn.example/x.png" },
            // eslint-disable-next-line no-script-url
            link: { href: "javascript:alert(1)", new_tab: true },
          },
        ],
      }),
    ]);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.toLowerCase().includes("href") || e.toLowerCase().includes("link"))).toBe(true);
  });

  it("rejects mailto:/file: protocols", () => {
    expect(
      validateDynamicBlocks([
        validBlock({ elements: [{ id: "e1", kind: "image", media: { url: "file:///etc/passwd" } }] }),
      ]).valid
    ).toBe(false);
    expect(
      validateDynamicBlocks([
        validBlock({
          elements: [
            {
              id: "e1",
              kind: "image",
              media: { url: "https://cdn.example/x.png" },
              link: { href: "mailto:a@b.com", new_tab: false },
            },
          ],
        }),
      ]).valid
    ).toBe(false);
  });

  it("accepts a site-relative path", () => {
    const res = validateDynamicBlocks([
      validBlock({
        elements: [
          {
            id: "e1",
            kind: "image",
            media: { url: "/uploads/patent1.png" },
            link: { href: "/products/536914", new_tab: false },
          },
        ],
      }),
    ]);
    expect(res).toEqual({ valid: true, errors: [] });
  });

  it("accepts youtube / youtu.be / vimeo video urls", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=abc123",
      "https://youtu.be/abc123",
      "https://vimeo.com/123456789",
    ]) {
      const res = validateDynamicBlocks([
        validBlock({
          elements: [{ id: "e1", kind: "video", media: { url, is_external_link: true } }],
        }),
      ]);
      expect(res.valid).toBe(true);
    }
  });

  it("rejects a text element that also carries media", () => {
    const res = validateDynamicBlocks([
      validBlock({
        elements: [
          { id: "e1", kind: "text", text: "hi", media: { url: "https://cdn.example/x.png" } } as any,
        ],
      }),
    ]);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.toLowerCase().includes("text"))).toBe(true);
  });

  it("rejects a text element with no text", () => {
    const res = validateDynamicBlocks([
      validBlock({ elements: [{ id: "e1", kind: "text" } as any] }),
    ]);
    expect(res.valid).toBe(false);
  });

  it("rejects a media element with no media.url", () => {
    const res = validateDynamicBlocks([
      validBlock({ elements: [{ id: "e1", kind: "image", media: { url: "" } } as any] }),
    ]);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.toLowerCase().includes("url"))).toBe(true);
  });

  it("rejects a media element that also carries text", () => {
    const res = validateDynamicBlocks([
      validBlock({
        elements: [
          { id: "e1", kind: "image", media: { url: "https://cdn.example/x.png" }, text: "nope" } as any,
        ],
      }),
    ]);
    expect(res.valid).toBe(false);
  });

  it("rejects an unknown element kind", () => {
    const res = validateDynamicBlocks([
      validBlock({ elements: [{ id: "e1", kind: "audio" } as any] }),
    ]);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.toLowerCase().includes("kind"))).toBe(true);
  });
});
