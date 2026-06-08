import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { validateDynamicBlocks } from "@/lib/validation/dynamic-blocks";

/**
 * Locks the dynamic-blocks import example we hand to external integrators to the
 * REAL importer validator. The sample lives with the time-to-pim integration
 * docs (`doc/export/time-to-pim/test-json/dynamic-blocks-sample.json`). If that
 * payload ever stops passing `validateDynamicBlocks` (e.g. the validator's rules
 * change), this test fails loudly — so the documented example is always provably
 * importable, not stale.
 *
 * Resolved relative to the commerce-suite repo root (vitest's cwd); the sample
 * lives one level up under the shared `doc/` tree.
 */
const SAMPLE_PATH = path.resolve(
  process.cwd(),
  "..",
  "doc",
  "export",
  "time-to-pim",
  "test-json",
  "dynamic-blocks-sample.json",
);

interface SamplePayload {
  products: Array<{ entity_code: string; dynamic_blocks?: unknown }>;
}

describe("dynamic-blocks import sample (external integrator handout)", () => {
  const payload = JSON.parse(readFileSync(SAMPLE_PATH, "utf8")) as SamplePayload;

  it("ships at least one product carrying dynamic_blocks", () => {
    const withBlocks = payload.products.filter((p) => Array.isArray(p.dynamic_blocks));
    expect(withBlocks.length).toBeGreaterThan(0);
  });

  it("every product's dynamic_blocks passes the real import validator", () => {
    for (const product of payload.products) {
      if (product.dynamic_blocks === undefined) continue;
      const { valid, errors } = validateDynamicBlocks(product.dynamic_blocks, ["it","de","en","fr","es","pt"]);
      expect(valid, `entity ${product.entity_code}: ${errors.join("; ")}`).toBe(true);
    }
  });

  it("stays representative: covers every element kind and a site-relative URL", () => {
    const kinds = new Set<string>();
    let hasSiteRelativeUrl = false;
    for (const product of payload.products) {
      const blocks = (product.dynamic_blocks as Array<Record<string, any>>) ?? [];
      for (const block of blocks) {
        for (const el of (block.elements as Array<Record<string, any>>) ?? []) {
          kinds.add(String(el.kind));
          const url = el.media?.url;
          if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) {
            hasSiteRelativeUrl = true;
          }
        }
      }
    }
    expect([...kinds].sort()).toEqual(["3d", "image", "text", "video"]);
    expect(hasSiteRelativeUrl).toBe(true);
  });
});
