import { describe, it, expect } from "vitest";
import { buildSearchQuery } from "@/lib/search/query-builder";
import type { SearchRequest } from "@/lib/types/search";

function fq(req: SearchRequest): string[] {
  const q = buildSearchQuery(req);
  return (q.filter as string[]) ?? [];
}

describe("buildFilterQueries: user_exclusions → negative fq", () => {
  const base: SearchRequest = { lang: "it", include_faceting: false };

  it("emits no negative clause when there are no exclusions", () => {
    expect(fq(base).some((c) => c.startsWith("-"))).toBe(false);
  });

  it("emits a single negative clause for one exclusion", () => {
    const out = fq({
      ...base,
      user_exclusions: [
        { solr_field: "attribute_erp_user_country_exclude_ss", value: "IT" },
      ],
    });
    expect(out).toContain("-attribute_erp_user_country_exclude_ss:IT");
  });

  it("emits one clause per exclusion (multiple rules → multiple clauses)", () => {
    const out = fq({
      ...base,
      user_exclusions: [
        { solr_field: "attribute_erp_user_country_exclude_ss", value: "FR" },
        { solr_field: "attribute_block_country_ss", value: "FR" },
      ],
    });
    expect(out).toContain("-attribute_erp_user_country_exclude_ss:FR");
    expect(out).toContain("-attribute_block_country_ss:FR");
  });

  it("escapes special characters in the value", () => {
    const out = fq({
      ...base,
      user_exclusions: [{ solr_field: "attribute_x_ss", value: "A:B" }],
    });
    // ':' is a special char → escaped by escapeQueryChars
    expect(out).toContain("-attribute_x_ss:A\\:B");
  });

  it("skips an exclusion with an empty solr_field or empty value", () => {
    const out = fq({
      ...base,
      user_exclusions: [
        { solr_field: "", value: "IT" },
        { solr_field: "attribute_x_ss", value: "" },
      ],
    });
    expect(out.some((c) => c.startsWith("-"))).toBe(false);
  });

  it("skips an exclusion whose solr_field name is malformed (contains space or meta-char)", () => {
    const out = fq({
      ...base,
      user_exclusions: [
        { solr_field: "attribute x", value: "IT" },
        { solr_field: "a:b", value: "IT" },
      ],
    });
    expect(out.some((c) => c.startsWith("-"))).toBe(false);
  });
});
