import { afterEach, describe, expect, it, vi } from "vitest";
import { SolrAdapter } from "@/lib/adapters/solr-adapter";

/**
 * Locks in the commit-pattern fix: high-frequency write paths must use a
 * batched soft commit (`commitWithin`) instead of a per-request hard commit
 * (`commit=true`), which forced a searcher reopen on every job and throttled
 * Solr throughput. clearIndex() is the deliberate exception — a rare, manual
 * full-wipe that keeps an explicit hard commit.
 */
function makeAdapter() {
  return new SolrAdapter(
    { custom_config: { solr_url: "http://solr:8983/solr", solr_core: "vinc-test" } },
    "vinc-test"
  );
}

/** Capture every URL passed to fetch; always answer with a Solr "ok" body. */
function stubFetchCapturingUrls(): string[] {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(String(url));
      return new Response(JSON.stringify({ responseHeader: { status: 0 } }), { status: 200 });
    })
  );
  return urls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Solr write paths use commitWithin, not commit=true", () => {
  it("syncProduct soft-commits", async () => {
    const adapter = makeAdapter();
    vi.spyOn(adapter as any, "validateProduct").mockResolvedValue({ isValid: true, errors: [] });
    vi.spyOn(adapter as any, "transformProduct").mockImplementation(
      async (p: any) => ({ id: p.entity_code, entity_code: p.entity_code })
    );
    const urls = stubFetchCapturingUrls();

    await adapter.syncProduct({ entity_code: "A" } as any);

    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(u).toContain("commitWithin=");
      expect(u).not.toContain("commit=true");
    }
  });

  it("bulkIndexProducts soft-commits", async () => {
    const adapter = makeAdapter();
    vi.spyOn(adapter as any, "transformProduct").mockImplementation(
      async (p: any) => ({ id: p.entity_code, entity_code: p.entity_code })
    );
    const urls = stubFetchCapturingUrls();

    await adapter.bulkIndexProducts([{ entity_code: "A" }, { entity_code: "B" }] as any);

    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(u).toContain("commitWithin=");
      expect(u).not.toContain("commit=true");
    }
  });

  it("deleteProduct, syncInventory, syncPrice, deleteByQuery, deleteByIds all soft-commit", async () => {
    const adapter = makeAdapter();
    const urls = stubFetchCapturingUrls();

    await adapter.deleteProduct("A");
    await adapter.syncInventory("A", 5);
    await adapter.syncPrice("A", 9.99);
    await adapter.deleteByQuery("entity_code:(A)");
    await adapter.deleteByIds(["A", "B"]);

    expect(urls.length).toBe(5);
    for (const u of urls) {
      expect(u).toContain("commitWithin=");
      expect(u).not.toContain("commit=true");
    }
  });

  it("clearIndex keeps an explicit hard commit (deliberate exception)", async () => {
    const adapter = makeAdapter();
    const urls = stubFetchCapturingUrls();

    await adapter.clearIndex();

    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("commit=true");
  });

  it("honors SOLR_COMMIT_WITHIN_MS override", async () => {
    vi.stubEnv("SOLR_COMMIT_WITHIN_MS", "5000");
    const adapter = makeAdapter();
    const urls = stubFetchCapturingUrls();

    await adapter.deleteProduct("A");

    expect(urls[0]).toContain("commitWithin=5000");
  });
});
