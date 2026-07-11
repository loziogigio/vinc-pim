// src/test/unit/user-exclusions.test.ts
import { describe, it, expect } from "vitest";
import { resolveUserExclusions } from "@/lib/search/user-exclusions";

const RULE = {
  enabled: true,
  user_field: "address_country",
  solr_field: "attribute_erp_user_country_exclude_ss",
  label: "Esclusione paese",
};

const customer = {
  addresses: [
    { external_code: "ADDR-DEF", country: "IT", is_default: true },
    { external_code: "ADDR-FR", country: "FR", is_default: false },
  ],
};

describe("resolveUserExclusions", () => {
  it("resolves country from the selected delivery address", () => {
    const out = resolveUserExclusions([RULE], customer, "ADDR-FR");
    expect(out).toEqual([
      { solr_field: "attribute_erp_user_country_exclude_ss", value: "FR" },
    ]);
  });

  it("falls back to the default address when address_code is absent", () => {
    const out = resolveUserExclusions([RULE], customer, undefined);
    expect(out).toEqual([
      { solr_field: "attribute_erp_user_country_exclude_ss", value: "IT" },
    ]);
  });

  it("falls back to the default address when address_code matches nothing", () => {
    const out = resolveUserExclusions([RULE], customer, "ADDR-NOPE");
    expect(out).toEqual([
      { solr_field: "attribute_erp_user_country_exclude_ss", value: "IT" },
    ]);
  });

  it("skips a rule whose resolved address has no country", () => {
    const c = { addresses: [{ external_code: "ADDR-X", is_default: true }] };
    expect(resolveUserExclusions([RULE], c, "ADDR-X")).toEqual([]);
  });

  it("skips disabled rules", () => {
    expect(resolveUserExclusions([{ ...RULE, enabled: false }], customer, "ADDR-FR")).toEqual([]);
  });

  it("skips rules with no solr_field or unknown user_field", () => {
    expect(resolveUserExclusions([{ ...RULE, solr_field: "" }], customer, "ADDR-FR")).toEqual([]);
    expect(resolveUserExclusions([{ ...RULE, user_field: "customer_pricelist" }], customer, "ADDR-FR")).toEqual([]);
  });

  it("returns empty for a guest (null customer)", () => {
    expect(resolveUserExclusions([RULE], null, "ADDR-FR")).toEqual([]);
  });

  it("emits multiple exclusions for multiple enabled rules", () => {
    const r2 = { ...RULE, solr_field: "attribute_block_country_ss" };
    const out = resolveUserExclusions([RULE, r2], customer, "ADDR-FR");
    expect(out).toEqual([
      { solr_field: "attribute_erp_user_country_exclude_ss", value: "FR" },
      { solr_field: "attribute_block_country_ss", value: "FR" },
    ]);
  });

  it("returns empty when rules is undefined", () => {
    expect(resolveUserExclusions(undefined, customer, "ADDR-FR")).toEqual([]);
  });
});
