// src/test/unit/dynamic-blocks-types.test.ts
import { describe, it, expect } from "vitest";
import type {
  BlockElement,
  MediaElement,
  TextElement,
  DynamicBlock,
  DynamicBlocks,
  DynamicBlockSection,
  DynamicBlockColumns,
  BlockElementKind,
  BlockLink,
} from "@/lib/types/dynamic-blocks";
// also reachable via the barrel:
import type { DynamicBlock as DynamicBlockFromBarrel } from "@/lib/types";

describe("unit: dynamic-blocks types", () => {
  it("narrows BlockElement on `kind` at runtime", () => {
    const elements: BlockElement[] = [
      { id: "e1", kind: "image", media: { url: "https://cdn/x.png" } },
      { id: "e2", kind: "text", text: "hello" },
    ];

    const lengths = elements.map((el) => {
      if (el.kind === "text") {
        return el.text.length;
      }
      return el.media.url.length;
    });

    expect(lengths).toEqual(["https://cdn/x.png".length, "hello".length]);
  });

  it("accepts a fully-typed DynamicBlock and DynamicBlocks array", () => {
    const block: DynamicBlock = {
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
          media: { url: "https://cdn/p1.png", cdn_key: "k1" },
          link: { href: "https://patents.example/1", new_tab: true },
          description: "Descrizione 1",
        },
      ],
    };
    const blocks: DynamicBlocks = [block];
    const fromBarrel: DynamicBlockFromBarrel = block;

    expect(blocks).toHaveLength(1);
    expect(fromBarrel.id).toBe("blk_01");
  });

  it("exposes the literal enums as usable type aliases", () => {
    const section: DynamicBlockSection = 4;
    const columns: DynamicBlockColumns = 8;
    const kind: BlockElementKind = "3d";
    const link: BlockLink = { href: "/relative", new_tab: false };
    expect([section, columns, kind, link.new_tab]).toEqual([4, 8, "3d", false]);
  });

  it("rejects mismatched element shapes at compile time", () => {
    // @ts-expect-error text element cannot carry media
    const bad1: TextElement = { id: "x", kind: "text", text: "t", media: { url: "u" } };
    // @ts-expect-error media element cannot carry text
    const bad2: MediaElement = { id: "y", kind: "image", media: { url: "u" }, text: "t" };
    expect(bad1.id && bad2.id).toBeTruthy();
  });
});
