// src/test/unit/user-exclusions-e2e.test.ts
import { describe, it, expect } from "vitest";
import { resolveUserExclusions } from "@/lib/search/user-exclusions";
import { buildSearchQuery } from "@/lib/search/query-builder";
import type { SearchRequest } from "@/lib/types/search";

const rules = [
  { enabled: true, user_field: "address_country", solr_field: "attribute_erp_user_country_exclude_ss" },
  { enabled: true, user_field: "address_country", solr_field: "attribute_block_country_ss" },
];

const customer = {
  addresses: [
    { external_code: "DEF", country: "IT", is_default: true },
    { external_code: "FR1", country: "FR", is_default: false },
  ],
};

function negClauses(req: SearchRequest): string[] {
  const q = buildSearchQuery(req);
  return ((q.filter as string[]) ?? []).filter((c) => c.startsWith("-"));
}

describe("user-exclusions end-to-end (resolve → fq)", () => {
  it("authenticated user with selected address gets one neg clause per rule", () => {
    const user_exclusions = resolveUserExclusions(rules, customer, "FR1");
    const out = negClauses({ lang: "it", include_faceting: false, user_exclusions });
    expect(out).toEqual([
      "-attribute_erp_user_country_exclude_ss:FR",
      "-attribute_block_country_ss:FR",
    ]);
  });

  it("falls back to default-address country when no address_code", () => {
    const user_exclusions = resolveUserExclusions(rules, customer, undefined);
    const out = negClauses({ lang: "it", include_faceting: false, user_exclusions });
    expect(out).toEqual([
      "-attribute_erp_user_country_exclude_ss:IT",
      "-attribute_block_country_ss:IT",
    ]);
  });

  it("guest (null customer) produces no negative clauses", () => {
    const user_exclusions = resolveUserExclusions(rules, null, "FR1");
    const out = negClauses({ lang: "it", include_faceting: false, user_exclusions });
    expect(out).toEqual([]);
  });
});
