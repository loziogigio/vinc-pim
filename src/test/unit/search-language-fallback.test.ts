import { describe, it, expect, vi, beforeEach } from "vitest";

// project.config: minimal Solr config
vi.mock("@/config/project.config", () => ({
  getSolrConfig: () => ({ url: "http://solr", defaultRows: 20, maxRows: 100 }),
}));

// query-builder: echo the request inside the "query" so the transformer can
// see which language was actually matched.
const buildSearchQuery = vi.fn((req: any) => ({ __req: req }));
vi.mock("@/lib/search/query-builder", () => ({
  buildSearchQuery: (req: any) => buildSearchQuery(req),
}));

// solr-client: a tenant client whose search() returns the query unchanged.
const solrSearch = vi.fn(async (q: any) => q);
vi.mock("@/lib/search/solr-client", () => ({
  SolrClient: class {
    constructor(public url: string, public db: string) {}
    search = (q: any) => solrSearch(q);
  },
  getSolrClient: () => ({ search: (q: any) => solrSearch(q) }),
}));

// transformer: only the default language ("it") has populated text fields,
// so a match in any other language yields zero results.
vi.mock("@/lib/search/response-transformer", () => ({
  transformSearchResponse: (solrResponse: any) => {
    const req = solrResponse.__req;
    const matched = req.match_lang ?? req.lang;
    const hasHits = matched === "it";
    return {
      results: hasHits ? [{ entity_code: "E1" }] : [],
      numFound: hasHits ? 1 : 0,
      start: 0,
    };
  },
}));

const getTenantDefaultLanguageCode = vi.fn(async () => "it");
vi.mock("@/lib/services/tenant-languages", () => ({
  getTenantDefaultLanguageCode: () => getTenantDefaultLanguageCode(),
}));

const { executeSearchWithFallback } = await import("@/lib/search/execute-search");

const base = { lang: "de", text: "guanti", group_variants: false } as const;

beforeEach(() => {
  buildSearchQuery.mockClear();
  solrSearch.mockClear();
  getTenantDefaultLanguageCode.mockClear();
  getTenantDefaultLanguageCode.mockResolvedValue("it");
});

describe("executeSearchWithFallback: default-language fallback", () => {
  it("retries against the default language when the requested language is empty", async () => {
    const { response, matchedLang } = await executeSearchWithFallback(
      { ...base },
      "vinc-acme-it",
    );

    expect(matchedLang).toBe("it");
    expect(response.results).toHaveLength(1);
    // First pass matched "de" (no match_lang), second pass forced match_lang="it".
    expect(buildSearchQuery).toHaveBeenCalledTimes(2);
    expect(buildSearchQuery.mock.calls[0][0].match_lang).toBeUndefined();
    expect(buildSearchQuery.mock.calls[1][0].match_lang).toBe("it");
    // Display language is preserved on the retry.
    expect(buildSearchQuery.mock.calls[1][0].lang).toBe("de");
  });

  it("does not retry when the first pass already has results", async () => {
    const { matchedLang } = await executeSearchWithFallback(
      { ...base, lang: "it" },
      "vinc-acme-it",
    );

    expect(matchedLang).toBe("it");
    expect(buildSearchQuery).toHaveBeenCalledTimes(1);
    expect(getTenantDefaultLanguageCode).not.toHaveBeenCalled();
  });

  it("does not retry an empty result when there is no text query", async () => {
    const { matchedLang } = await executeSearchWithFallback(
      { lang: "de", text: "", group_variants: false },
      "vinc-acme-it",
    );

    expect(matchedLang).toBe("de");
    expect(buildSearchQuery).toHaveBeenCalledTimes(1);
    expect(getTenantDefaultLanguageCode).not.toHaveBeenCalled();
  });

  it("does not retry when the requested language is already the default", async () => {
    getTenantDefaultLanguageCode.mockResolvedValue("de");

    const { matchedLang, response } = await executeSearchWithFallback(
      { ...base },
      "vinc-acme-it",
    );

    expect(matchedLang).toBe("de");
    expect(response.results).toHaveLength(0);
    expect(buildSearchQuery).toHaveBeenCalledTimes(1);
  });

  it("skips fallback entirely when no tenantDb is provided", async () => {
    const { matchedLang } = await executeSearchWithFallback({ ...base });

    expect(matchedLang).toBe("de");
    expect(buildSearchQuery).toHaveBeenCalledTimes(1);
    expect(getTenantDefaultLanguageCode).not.toHaveBeenCalled();
  });
});
