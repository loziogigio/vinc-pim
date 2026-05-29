import { afterEach, describe, expect, it, vi } from "vitest";
import { SolrAdapter } from "@/lib/adapters/solr-adapter";

function makeAdapter() {
  return new SolrAdapter(
    { custom_config: { solr_url: "http://solr:8983/solr", solr_core: "vinc-test" } },
    "vinc-test"
  );
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("bulkIndexProducts per-doc fallback", () => {
  it("indexes the healthy docs when one doc poisons the batch", async () => {
    const adapter = makeAdapter();
    // Skip the heavy transform: each product → minimal doc.
    vi.spyOn(adapter as any, "transformProduct").mockImplementation(
      async (p: any) => ({ id: p.entity_code, entity_code: p.entity_code })
    );

    let call = 0;
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      call += 1;
      const docs = JSON.parse(init.body);
      // Call 1 = the whole-batch POST (array of 3) → fail.
      if (Array.isArray(docs) && docs.length > 1) {
        return new Response("batch boom", { status: 400 });
      }
      // Per-doc POSTs (array of 1): fail only the poison doc.
      const ec = docs[0].entity_code;
      if (ec === "BAD") return new Response("doc boom", { status: 400 });
      return new Response(JSON.stringify({ responseHeader: { status: 0 } }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await adapter.bulkIndexProducts(
      [{ entity_code: "A" }, { entity_code: "B" }, { entity_code: "BAD" }] as any
    );

    expect(result.succeeded.sort()).toEqual(["A", "B"]);
    expect(result.failedItems).toHaveLength(1);
    expect(result.failedItems[0].entity_code).toBe("BAD");
    expect(result.success).toBe(2);
    expect(result.failed).toBe(1);
  });

  it("returns all succeeded when the batch POST succeeds", async () => {
    const adapter = makeAdapter();
    vi.spyOn(adapter as any, "transformProduct").mockImplementation(
      async (p: any) => ({ id: p.entity_code, entity_code: p.entity_code })
    );
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ responseHeader: { status: 0 } }), { status: 200 })
    ));

    const result = await adapter.bulkIndexProducts(
      [{ entity_code: "A" }, { entity_code: "B" }] as any
    );
    expect(result.succeeded.sort()).toEqual(["A", "B"]);
    expect(result.failedItems).toHaveLength(0);
  });
});
