/**
 * Unit Tests for resolveEffectiveTagsDetailed
 *
 * Tests the detailed tag resolution that includes source information
 * (whether each tag comes from customer defaults or address overrides).
 */

import { describe, it, expect } from "vitest";
import {
  resolveEffectiveTagsDetailed,
  type EffectiveTagEntry,
} from "@/lib/services/tag-pricing.service";
import type { ICustomerTagRef } from "@/lib/db/models/customer-tag";

function makeTagRef(prefix: string, code: string, tagId?: string): ICustomerTagRef {
  return {
    tag_id: tagId || `ctag_${prefix.slice(0, 4)}${code.slice(0, 4)}`,
    full_tag: `${prefix}:${code}`,
    prefix,
    code,
  };
}

describe("unit: resolveEffectiveTagsDetailed", () => {
  it("should return customer tags with source 'customer' when no overrides", () => {
    const customerTags = [
      makeTagRef("categoria-di-sconto", "sconto-45"),
      makeTagRef("categoria-clienti", "idraulico"),
    ];

    const result = resolveEffectiveTagsDetailed(customerTags, []);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      prefix: "categoria-di-sconto",
      tag: customerTags[0],
      source: "customer",
    });
    expect(result[1]).toEqual({
      prefix: "categoria-clienti",
      tag: customerTags[1],
      source: "customer",
    });
  });

  it("should return address overrides with source 'address_override'", () => {
    const customerTags: ICustomerTagRef[] = [];
    const overrides = [makeTagRef("categoria-di-sconto", "sconto-50")];

    const result = resolveEffectiveTagsDetailed(customerTags, overrides);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("address_override");
    expect(result[0].tag.full_tag).toBe("categoria-di-sconto:sconto-50");
  });

  it("should replace customer tag when address overrides same prefix", () => {
    const customerTags = [
      makeTagRef("categoria-di-sconto", "sconto-45"),
      makeTagRef("categoria-clienti", "idraulico"),
    ];
    const overrides = [makeTagRef("categoria-di-sconto", "sconto-50")];

    const result = resolveEffectiveTagsDetailed(customerTags, overrides);

    expect(result).toHaveLength(2);

    // categoria-clienti kept from customer
    const clientiTag = result.find((e) => e.prefix === "categoria-clienti");
    expect(clientiTag).toBeDefined();
    expect(clientiTag!.source).toBe("customer");
    expect(clientiTag!.tag.code).toBe("idraulico");

    // categoria-di-sconto replaced by address override
    const scontoTag = result.find((e) => e.prefix === "categoria-di-sconto");
    expect(scontoTag).toBeDefined();
    expect(scontoTag!.source).toBe("address_override");
    expect(scontoTag!.tag.code).toBe("sconto-50");
  });

  it("should handle multiple overrides replacing multiple prefixes", () => {
    const customerTags = [
      makeTagRef("tipo-prezzo", "listino-A"),
      makeTagRef("categoria-di-sconto", "sconto-45"),
      makeTagRef("categoria-clienti", "idraulico"),
    ];
    const overrides = [
      makeTagRef("tipo-prezzo", "listino-B"),
      makeTagRef("categoria-di-sconto", "sconto-60"),
    ];

    const result = resolveEffectiveTagsDetailed(customerTags, overrides);

    expect(result).toHaveLength(3);

    // Only categoria-clienti remains from customer
    const customerEntries = result.filter((e) => e.source === "customer");
    expect(customerEntries).toHaveLength(1);
    expect(customerEntries[0].prefix).toBe("categoria-clienti");

    // Two overrides
    const overrideEntries = result.filter((e) => e.source === "address_override");
    expect(overrideEntries).toHaveLength(2);
    expect(overrideEntries.map((e) => e.tag.full_tag).sort()).toEqual([
      "categoria-di-sconto:sconto-60",
      "tipo-prezzo:listino-B",
    ]);
  });

  it("should return empty array when both inputs are empty", () => {
    const result = resolveEffectiveTagsDetailed([], []);
    expect(result).toEqual([]);
  });

  it("should return only overrides when customer has no tags", () => {
    const overrides = [makeTagRef("categoria-di-sconto", "sconto-50")];

    const result = resolveEffectiveTagsDetailed([], overrides);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("address_override");
  });

  it("should preserve full tag ref structure in each entry", () => {
    const tagRef = makeTagRef("categoria-di-sconto", "sconto-45", "ctag_oDrpKxmi");
    const result = resolveEffectiveTagsDetailed([tagRef], []);

    expect(result[0].tag).toEqual(tagRef);
    expect(result[0].tag.tag_id).toBe("ctag_oDrpKxmi");
    expect(result[0].tag.full_tag).toBe("categoria-di-sconto:sconto-45");
    expect(result[0].tag.prefix).toBe("categoria-di-sconto");
    expect(result[0].tag.code).toBe("sconto-45");
  });

  it("should order customer tags before address overrides", () => {
    const customerTags = [makeTagRef("categoria-clienti", "idraulico")];
    const overrides = [makeTagRef("categoria-di-sconto", "sconto-50")];

    const result = resolveEffectiveTagsDetailed(customerTags, overrides);

    expect(result[0].source).toBe("customer");
    expect(result[1].source).toBe("address_override");
  });

  it("should not include overridden customer tags", () => {
    const customerTags = [makeTagRef("categoria-di-sconto", "sconto-45")];
    const overrides = [makeTagRef("categoria-di-sconto", "sconto-50")];

    const result = resolveEffectiveTagsDetailed(customerTags, overrides);

    expect(result).toHaveLength(1);
    expect(result[0].tag.code).toBe("sconto-50");
    // sconto-45 should NOT appear
    expect(result.find((e) => e.tag.code === "sconto-45")).toBeUndefined();
  });
});
