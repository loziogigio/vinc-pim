/**
 * Unit Tests for Customer Tag System
 *
 * Tests tag constants, tag resolution (customer + address overrides),
 * promotion filtering, pricing resolution, and tag ref helpers.
 */

import { describe, it, expect } from "vitest";
import {
  buildFullTag,
  parseFullTag,
  isValidPrefix,
  isValidCode,
  TAG_PREFIXES,
  TAG_PREFIX_LABELS,
  TAG_PREFIX_DESCRIPTIONS,
} from "@/lib/constants/customer-tag";
import {
  resolveEffectiveTags,
  resolveEffectiveTagsFromRefs,
  filterPromotionsByTags,
  resolvePackagingByTags,
  upsertTagRef,
  removeTagRef,
} from "@/lib/services/tag-pricing.service";
import type { ICustomerTagRef } from "@/lib/db/models/customer-tag";
import type { Promotion, PackagingOption } from "@/lib/types/pim";

// ============================================
// HELPER FACTORIES
// ============================================

function makeTagRef(prefix: string, code: string): ICustomerTagRef {
  return {
    tag_id: `ctag_${prefix.slice(0, 4)}`,
    full_tag: `${prefix}:${code}`,
    prefix,
    code,
  };
}

function makePromotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    promo_code: "PROMO-001",
    promo_row: 1,
    promo_label: "Test Promo",
    discount_percent: 10,
    promo_price: 90,
    ...overrides,
  };
}

// ============================================
// CONSTANTS TESTS
// ============================================

describe("unit: Customer Tag Constants", () => {
  it("should have well-known prefixes", () => {
    expect(TAG_PREFIXES).toContain("categoria-di-sconto");
    expect(TAG_PREFIXES).toContain("categoria-clienti");
    expect(TAG_PREFIXES).toContain("categoria-acquisto-medio-mensile");
    expect(TAG_PREFIXES.length).toBe(3);
  });

  it("should have labels for all prefixes", () => {
    for (const prefix of TAG_PREFIXES) {
      expect(TAG_PREFIX_LABELS[prefix]).toBeDefined();
      expect(typeof TAG_PREFIX_LABELS[prefix]).toBe("string");
    }
  });

  it("should have descriptions for all prefixes", () => {
    for (const prefix of TAG_PREFIXES) {
      expect(TAG_PREFIX_DESCRIPTIONS[prefix]).toBeDefined();
      expect(typeof TAG_PREFIX_DESCRIPTIONS[prefix]).toBe("string");
    }
  });
});

// ============================================
// buildFullTag / parseFullTag TESTS
// ============================================

describe("unit: buildFullTag", () => {
  it("should build prefix:code format", () => {
    expect(buildFullTag("categoria-di-sconto", "sconto-45")).toBe(
      "categoria-di-sconto:sconto-45"
    );
  });

  it("should handle single-word prefix and code", () => {
    expect(buildFullTag("test", "value")).toBe("test:value");
  });
});

describe("unit: parseFullTag", () => {
  it("should parse valid full_tag", () => {
    const result = parseFullTag("categoria-di-sconto:sconto-45");
    expect(result).toEqual({
      prefix: "categoria-di-sconto",
      code: "sconto-45",
    });
  });

  it("should return null for missing colon", () => {
    expect(parseFullTag("no-colon-here")).toBeNull();
  });

  it("should return null for colon at start", () => {
    expect(parseFullTag(":code-only")).toBeNull();
  });

  it("should return null for colon at end", () => {
    expect(parseFullTag("prefix-only:")).toBeNull();
  });

  it("should handle colon in code", () => {
    const result = parseFullTag("prefix:code:extra");
    expect(result).toEqual({
      prefix: "prefix",
      code: "code:extra",
    });
  });
});

// ============================================
// VALIDATION TESTS
// ============================================

describe("unit: Tag Prefix/Code Validation", () => {
  it("should accept valid kebab-case prefixes", () => {
    expect(isValidPrefix("categoria-di-sconto")).toBe(true);
    expect(isValidPrefix("test")).toBe(true);
    expect(isValidPrefix("abc-123")).toBe(true);
  });

  it("should reject invalid prefix formats", () => {
    expect(isValidPrefix("UPPERCASE")).toBe(false);
    expect(isValidPrefix("has spaces")).toBe(false);
    expect(isValidPrefix("has_underscore")).toBe(false);
    expect(isValidPrefix("-leading-dash")).toBe(false);
    expect(isValidPrefix("trailing-dash-")).toBe(false);
    expect(isValidPrefix("")).toBe(false);
    expect(isValidPrefix("has:colon")).toBe(false);
  });

  it("should accept valid kebab-case codes", () => {
    expect(isValidCode("sconto-45")).toBe(true);
    expect(isValidCode("idraulico")).toBe(true);
    expect(isValidCode("level-1")).toBe(true);
  });

  it("should reject invalid code formats", () => {
    expect(isValidCode("UPPER")).toBe(false);
    expect(isValidCode("has space")).toBe(false);
    expect(isValidCode("")).toBe(false);
  });
});

// ============================================
// TAG RESOLUTION TESTS
// ============================================

describe("unit: resolveEffectiveTags", () => {
  it("should return customer tags when no address overrides", () => {
    const customer = {
      tags: [
        makeTagRef("categoria-di-sconto", "sconto-45"),
        makeTagRef("categoria-clienti", "idraulico"),
      ],
    };

    const result = resolveEffectiveTags(customer, null);
    expect(result).toEqual([
      "categoria-di-sconto:sconto-45",
      "categoria-clienti:idraulico",
    ]);
  });

  it("should return customer tags when address has empty overrides", () => {
    const customer = {
      tags: [makeTagRef("categoria-di-sconto", "sconto-45")],
    };
    const address = { tag_overrides: [] };

    const result = resolveEffectiveTags(customer, address);
    expect(result).toEqual(["categoria-di-sconto:sconto-45"]);
  });

  it("should override customer tag with same prefix from address", () => {
    const customer = {
      tags: [
        makeTagRef("categoria-di-sconto", "sconto-45"),
        makeTagRef("categoria-clienti", "idraulico"),
      ],
    };
    const address = {
      tag_overrides: [makeTagRef("categoria-di-sconto", "sconto-50")],
    };

    const result = resolveEffectiveTags(customer, address);
    expect(result).toContain("categoria-di-sconto:sconto-50");
    expect(result).toContain("categoria-clienti:idraulico");
    expect(result).not.toContain("categoria-di-sconto:sconto-45");
    expect(result.length).toBe(2);
  });

  it("should keep customer tags for unoverridden prefixes", () => {
    const customer = {
      tags: [
        makeTagRef("categoria-di-sconto", "sconto-45"),
        makeTagRef("categoria-clienti", "idraulico"),
        makeTagRef("categoria-acquisto-medio-mensile", "fascia-alta"),
      ],
    };
    const address = {
      tag_overrides: [makeTagRef("categoria-di-sconto", "sconto-50")],
    };

    const result = resolveEffectiveTags(customer, address);
    expect(result).toHaveLength(3);
    expect(result).toContain("categoria-di-sconto:sconto-50");
    expect(result).toContain("categoria-clienti:idraulico");
    expect(result).toContain("categoria-acquisto-medio-mensile:fascia-alta");
  });

  it("should handle customer with no tags", () => {
    const customer = { tags: [] };
    const address = {
      tag_overrides: [makeTagRef("categoria-di-sconto", "sconto-50")],
    };

    const result = resolveEffectiveTags(customer, address);
    expect(result).toEqual(["categoria-di-sconto:sconto-50"]);
  });

  it("should handle undefined tags gracefully", () => {
    const customer = { tags: undefined as unknown as ICustomerTagRef[] };
    const result = resolveEffectiveTags(customer, null);
    expect(result).toEqual([]);
  });
});

describe("unit: resolveEffectiveTagsFromRefs", () => {
  it("should merge customer tags with address overrides", () => {
    const customerTags = [
      makeTagRef("categoria-di-sconto", "sconto-45"),
      makeTagRef("categoria-clienti", "idraulico"),
    ];
    const addressOverrides = [
      makeTagRef("categoria-di-sconto", "sconto-50"),
    ];

    const result = resolveEffectiveTagsFromRefs(customerTags, addressOverrides);
    expect(result).toContain("categoria-di-sconto:sconto-50");
    expect(result).toContain("categoria-clienti:idraulico");
    expect(result).not.toContain("categoria-di-sconto:sconto-45");
  });

  it("should return customer tags when overrides array is empty", () => {
    const customerTags = [makeTagRef("categoria-clienti", "idraulico")];
    const result = resolveEffectiveTagsFromRefs(customerTags, []);
    expect(result).toEqual(["categoria-clienti:idraulico"]);
  });
});

// ============================================
// PROMOTION FILTERING TESTS
// ============================================

describe("unit: filterPromotionsByTags", () => {
  it("should include promotions with no tag_filter for all customers", () => {
    const promotions = [makePromotion({ tag_filter: undefined })];
    const result = filterPromotionsByTags(promotions, ["categoria-di-sconto:sconto-45"]);
    expect(result).toHaveLength(1);
  });

  it("should include promotions with empty tag_filter for all customers", () => {
    const promotions = [makePromotion({ tag_filter: [] })];
    const result = filterPromotionsByTags(promotions, ["categoria-di-sconto:sconto-45"]);
    expect(result).toHaveLength(1);
  });

  it("should include promotions matching customer tags", () => {
    const promotions = [
      makePromotion({ tag_filter: ["categoria-di-sconto:sconto-45"] }),
    ];
    const effectiveTags = ["categoria-di-sconto:sconto-45", "categoria-clienti:idraulico"];
    const result = filterPromotionsByTags(promotions, effectiveTags);
    expect(result).toHaveLength(1);
  });

  it("should exclude promotions not matching customer tags", () => {
    const promotions = [
      makePromotion({ tag_filter: ["categoria-di-sconto:sconto-50"] }),
    ];
    const effectiveTags = ["categoria-di-sconto:sconto-45"];
    const result = filterPromotionsByTags(promotions, effectiveTags);
    expect(result).toHaveLength(0);
  });

  it("should match if any tag in filter matches", () => {
    const promotions = [
      makePromotion({
        tag_filter: [
          "categoria-di-sconto:sconto-45",
          "categoria-di-sconto:sconto-50",
        ],
      }),
    ];
    const effectiveTags = ["categoria-di-sconto:sconto-50"];
    const result = filterPromotionsByTags(promotions, effectiveTags);
    expect(result).toHaveLength(1);
  });

  it("should return only untagged promotions for customers with no tags", () => {
    const promotions = [
      makePromotion({ promo_code: "UNTAGGED", tag_filter: undefined }),
      makePromotion({
        promo_code: "TAGGED",
        tag_filter: ["categoria-di-sconto:sconto-45"],
      }),
    ];
    const result = filterPromotionsByTags(promotions, []);
    expect(result).toHaveLength(1);
    expect(result[0].promo_code).toBe("UNTAGGED");
  });

  it("should handle mix of tagged and untagged promotions", () => {
    const promotions = [
      makePromotion({ promo_code: "UNTAGGED" }),
      makePromotion({
        promo_code: "MATCH",
        tag_filter: ["categoria-di-sconto:sconto-45"],
      }),
      makePromotion({
        promo_code: "NO-MATCH",
        tag_filter: ["categoria-di-sconto:sconto-50"],
      }),
    ];
    const effectiveTags = ["categoria-di-sconto:sconto-45"];
    const result = filterPromotionsByTags(promotions, effectiveTags);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.promo_code)).toContain("UNTAGGED");
    expect(result.map((p) => p.promo_code)).toContain("MATCH");
  });
});

// ============================================
// PACKAGING RESOLUTION TESTS
// ============================================

describe("unit: resolvePackagingByTags", () => {
  it("should keep untagged pricing as-is", () => {
    const pkgs: PackagingOption[] = [
      {
        packaging_code: "PK1",
        packaging_label: "Box",
        packaging_type: "box",
        pack_size: 1,
        min_order_quantity: 1,
        pricing: {
          list_price: 100,
          sell_price: 80,
          sell_discount_pct: 20,
          sell_discount_amt: 20,
        },
      },
    ];

    const result = resolvePackagingByTags(pkgs, ["categoria-di-sconto:sconto-45"]);
    expect(result[0].pricing).toBeDefined();
    expect(result[0].pricing?.list_price).toBe(100);
  });

  it("should clear tagged pricing that does not match", () => {
    const pkgs: PackagingOption[] = [
      {
        packaging_code: "PK1",
        packaging_label: "Box",
        packaging_type: "box",
        pack_size: 1,
        min_order_quantity: 1,
        pricing: {
          list_price: 100,
          sell_price: 55,
          sell_discount_pct: 45,
          sell_discount_amt: 45,
          tag_filter: ["categoria-di-sconto:sconto-50"],
        },
      },
    ];

    const result = resolvePackagingByTags(pkgs, ["categoria-di-sconto:sconto-45"]);
    expect(result[0].pricing).toBeUndefined();
  });

  it("should keep tagged pricing that matches", () => {
    const pkgs: PackagingOption[] = [
      {
        packaging_code: "PK1",
        packaging_label: "Box",
        packaging_type: "box",
        pack_size: 1,
        min_order_quantity: 1,
        pricing: {
          list_price: 100,
          sell_price: 55,
          sell_discount_pct: 45,
          sell_discount_amt: 45,
          tag_filter: ["categoria-di-sconto:sconto-45"],
        },
      },
    ];

    const result = resolvePackagingByTags(pkgs, ["categoria-di-sconto:sconto-45"]);
    expect(result[0].pricing).toBeDefined();
    expect(result[0].pricing?.sell_price).toBe(55);
  });

  it("should filter promotions within packaging by tags", () => {
    const pkgs: PackagingOption[] = [
      {
        packaging_code: "PK1",
        packaging_label: "Box",
        packaging_type: "box",
        pack_size: 1,
        min_order_quantity: 1,
        pricing: { list_price: 100, sell_price: 80, sell_discount_pct: 20, sell_discount_amt: 20 },
        promotions: [
          makePromotion({ promo_code: "UNIVERSAL" }),
          makePromotion({
            promo_code: "TAGGED",
            tag_filter: ["categoria-di-sconto:sconto-45"],
          }),
          makePromotion({
            promo_code: "OTHER",
            tag_filter: ["categoria-di-sconto:sconto-50"],
          }),
        ],
      },
    ];

    const result = resolvePackagingByTags(pkgs, ["categoria-di-sconto:sconto-45"]);
    expect(result[0].promotions).toHaveLength(2);
    expect(result[0].promotions!.map((p) => p.promo_code)).toContain("UNIVERSAL");
    expect(result[0].promotions!.map((p) => p.promo_code)).toContain("TAGGED");
  });
});

// ============================================
// TAG REF HELPERS TESTS
// ============================================

describe("unit: upsertTagRef", () => {
  it("should add new tag to empty array", () => {
    const newTag = makeTagRef("categoria-di-sconto", "sconto-45");
    const result = upsertTagRef([], newTag);
    expect(result).toHaveLength(1);
    expect(result[0].full_tag).toBe("categoria-di-sconto:sconto-45");
  });

  it("should add tag with different prefix", () => {
    const existing = [makeTagRef("categoria-di-sconto", "sconto-45")];
    const newTag = makeTagRef("categoria-clienti", "idraulico");
    const result = upsertTagRef(existing, newTag);
    expect(result).toHaveLength(2);
  });

  it("should replace tag with same prefix and code", () => {
    const existing = [makeTagRef("categoria-di-sconto", "sconto-45")];
    const newTag = makeTagRef("categoria-di-sconto", "sconto-45");
    newTag.tag_id = "ctag_new_id";
    const result = upsertTagRef(existing, newTag);
    expect(result).toHaveLength(1);
    expect(result[0].tag_id).toBe("ctag_new_id");
  });

  it("should replace tag with different code in same prefix", () => {
    const existing = [makeTagRef("categoria-di-sconto", "sconto-45")];
    const newTag = makeTagRef("categoria-di-sconto", "sconto-50");
    const result = upsertTagRef(existing, newTag);
    // Only one tag per prefix — sconto-50 replaces sconto-45
    expect(result).toHaveLength(1);
    expect(result[0].full_tag).toBe("categoria-di-sconto:sconto-50");
  });
});

describe("unit: removeTagRef", () => {
  it("should remove tag by full_tag", () => {
    const tags = [
      makeTagRef("categoria-di-sconto", "sconto-45"),
      makeTagRef("categoria-clienti", "idraulico"),
    ];
    const result = removeTagRef(tags, "categoria-di-sconto:sconto-45");
    expect(result).toHaveLength(1);
    expect(result[0].full_tag).toBe("categoria-clienti:idraulico");
  });

  it("should not modify array when tag not found", () => {
    const tags = [makeTagRef("categoria-di-sconto", "sconto-45")];
    const result = removeTagRef(tags, "nonexistent:tag");
    expect(result).toHaveLength(1);
  });

  it("should handle empty array", () => {
    const result = removeTagRef([], "any:tag");
    expect(result).toHaveLength(0);
  });
});

// ============================================
// BUSINESS SCENARIO TESTS
// ============================================

describe("unit: Customer Tag Business Scenarios", () => {
  it("Scenario: Same customer, different addresses get different pricing", () => {
    // Customer has default sconto-45
    const customer = {
      tags: [
        makeTagRef("categoria-di-sconto", "sconto-45"),
        makeTagRef("categoria-clienti", "idraulico"),
      ],
    };

    // Address A: no overrides → uses customer defaults
    const addressA = { tag_overrides: [] };
    const tagsA = resolveEffectiveTags(customer, addressA);
    expect(tagsA).toContain("categoria-di-sconto:sconto-45");

    // Address B: overrides sconto to 50
    const addressB = {
      tag_overrides: [makeTagRef("categoria-di-sconto", "sconto-50")],
    };
    const tagsB = resolveEffectiveTags(customer, addressB);
    expect(tagsB).toContain("categoria-di-sconto:sconto-50");
    expect(tagsB).not.toContain("categoria-di-sconto:sconto-45");

    // Both keep the clienti tag
    expect(tagsA).toContain("categoria-clienti:idraulico");
    expect(tagsB).toContain("categoria-clienti:idraulico");
  });

  it("Scenario: Tagged pricing + tagged promotions resolve correctly", () => {
    const pkgs: PackagingOption[] = [
      {
        packaging_code: "CONF-6",
        packaging_label: "Confezione da 6",
        packaging_type: "box",
        pack_size: 6,
        min_order_quantity: 6,
        pricing: {
          list_price: 100,
          sell_price: 55,
          sell_discount_pct: 45,
          sell_discount_amt: 45,
          tag_filter: ["categoria-di-sconto:sconto-45"],
        },
        promotions: [
          makePromotion({
            promo_code: "PROMO-10",
            discount_percent: 10,
            tag_filter: ["categoria-di-sconto:sconto-45"],
          }),
        ],
      },
    ];

    // Customer with sconto-45 → pricing + promo visible
    const result45 = resolvePackagingByTags(pkgs, ["categoria-di-sconto:sconto-45"]);
    expect(result45[0].pricing).toBeDefined();
    expect(result45[0].promotions).toHaveLength(1);

    // Customer with sconto-50 → pricing cleared, promo filtered out
    const result50 = resolvePackagingByTags(pkgs, ["categoria-di-sconto:sconto-50"]);
    expect(result50[0].pricing).toBeUndefined();
    expect(result50[0].promotions).toHaveLength(0);
  });

  it("Scenario: Customer with no tags only sees universal promotions", () => {
    const promotions = [
      makePromotion({ promo_code: "UNIVERSAL" }),
      makePromotion({
        promo_code: "EXCLUSIVE",
        tag_filter: ["categoria-di-sconto:sconto-45"],
      }),
    ];

    const result = filterPromotionsByTags(promotions, []);
    expect(result).toHaveLength(1);
    expect(result[0].promo_code).toBe("UNIVERSAL");
  });
});

// ============================================
// ADVANCED TAG RESOLUTION EDGE CASES
// ============================================

describe("unit: Tag Resolution — Edge Cases", () => {
  it("should handle address overriding ALL customer prefixes", () => {
    const customer = {
      tags: [
        makeTagRef("categoria-di-sconto", "sconto-45"),
        makeTagRef("categoria-clienti", "idraulico"),
      ],
    };
    const address = {
      tag_overrides: [
        makeTagRef("categoria-di-sconto", "sconto-60"),
        makeTagRef("categoria-clienti", "ferramenta"),
      ],
    };

    const result = resolveEffectiveTags(customer, address);
    expect(result).toHaveLength(2);
    expect(result).toContain("categoria-di-sconto:sconto-60");
    expect(result).toContain("categoria-clienti:ferramenta");
    expect(result).not.toContain("categoria-di-sconto:sconto-45");
    expect(result).not.toContain("categoria-clienti:idraulico");
  });

  it("should allow address to introduce a NEW prefix not on customer", () => {
    const customer = {
      tags: [makeTagRef("categoria-di-sconto", "sconto-45")],
    };
    const address = {
      tag_overrides: [
        makeTagRef("categoria-acquisto-medio-mensile", "fascia-alta"),
      ],
    };

    const result = resolveEffectiveTags(customer, address);
    expect(result).toHaveLength(2);
    expect(result).toContain("categoria-di-sconto:sconto-45");
    expect(result).toContain("categoria-acquisto-medio-mensile:fascia-alta");
  });

  it("should handle customer with many tags and single address override", () => {
    const customer = {
      tags: [
        makeTagRef("prefix-a", "value-1"),
        makeTagRef("prefix-b", "value-2"),
        makeTagRef("prefix-c", "value-3"),
        makeTagRef("prefix-d", "value-4"),
        makeTagRef("prefix-e", "value-5"),
      ],
    };
    const address = {
      tag_overrides: [makeTagRef("prefix-c", "override-value")],
    };

    const result = resolveEffectiveTags(customer, address);
    expect(result).toHaveLength(5);
    expect(result).toContain("prefix-a:value-1");
    expect(result).toContain("prefix-b:value-2");
    expect(result).toContain("prefix-c:override-value");
    expect(result).toContain("prefix-d:value-4");
    expect(result).toContain("prefix-e:value-5");
    expect(result).not.toContain("prefix-c:value-3");
  });

  it("should handle undefined address (same as null)", () => {
    const customer = {
      tags: [makeTagRef("categoria-di-sconto", "sconto-45")],
    };

    const result = resolveEffectiveTags(customer, undefined);
    expect(result).toEqual(["categoria-di-sconto:sconto-45"]);
  });

  it("should handle address with undefined tag_overrides", () => {
    const customer = {
      tags: [makeTagRef("categoria-di-sconto", "sconto-45")],
    };
    const address = { tag_overrides: undefined as unknown as ICustomerTagRef[] };

    const result = resolveEffectiveTags(customer, address);
    expect(result).toEqual(["categoria-di-sconto:sconto-45"]);
  });
});

// ============================================
// buildFullTag / parseFullTag ROUND-TRIP
// ============================================

describe("unit: buildFullTag + parseFullTag round-trip", () => {
  const cases = [
    { prefix: "categoria-di-sconto", code: "sconto-45" },
    { prefix: "categoria-clienti", code: "idraulico" },
    { prefix: "custom-prefix", code: "custom-code" },
    { prefix: "a", code: "b" },
    { prefix: "abc-123-def", code: "value-999" },
  ];

  for (const { prefix, code } of cases) {
    it(`should round-trip ${prefix}:${code}`, () => {
      const fullTag = buildFullTag(prefix, code);
      const parsed = parseFullTag(fullTag);
      expect(parsed).not.toBeNull();
      expect(parsed!.prefix).toBe(prefix);
      expect(parsed!.code).toBe(code);
    });
  }
});

// ============================================
// MULTI-PACKAGING RESOLUTION
// ============================================

describe("unit: resolvePackagingByTags — Multi-Packaging", () => {
  function makePkg(
    code: string,
    pricingTagFilter?: string[],
    promos?: Promotion[]
  ): PackagingOption {
    return {
      packaging_code: code,
      packaging_label: code,
      packaging_type: "box",
      pack_size: 1,
      min_order_quantity: 1,
      pricing: {
        list_price: 100,
        sell_price: 80,
        sell_discount_pct: 20,
        sell_discount_amt: 20,
        tag_filter: pricingTagFilter,
      },
      promotions: promos,
    };
  }

  it("should resolve each packaging independently", () => {
    const pkgs = [
      makePkg("PKG-A", ["categoria-di-sconto:sconto-45"]),
      makePkg("PKG-B", ["categoria-di-sconto:sconto-50"]),
      makePkg("PKG-C"), // untagged
    ];

    const result = resolvePackagingByTags(pkgs, ["categoria-di-sconto:sconto-45"]);

    expect(result[0].pricing).toBeDefined(); // PKG-A matches
    expect(result[1].pricing).toBeUndefined(); // PKG-B doesn't match
    expect(result[2].pricing).toBeDefined(); // PKG-C untagged, always visible
  });

  it("should handle packaging with no pricing at all", () => {
    const pkgs: PackagingOption[] = [
      {
        packaging_code: "PKG-EMPTY",
        packaging_label: "Empty",
        packaging_type: "box",
        pack_size: 1,
        min_order_quantity: 1,
        // no pricing
      },
    ];

    const result = resolvePackagingByTags(pkgs, ["any:tag"]);
    expect(result[0].pricing).toBeUndefined();
  });

  it("should handle packaging with pricing but no promotions", () => {
    const pkgs = [makePkg("PKG-NO-PROMO")]; // untagged pricing, no promotions

    const result = resolvePackagingByTags(pkgs, ["any:tag"]);
    expect(result[0].pricing).toBeDefined();
    expect(result[0].promotions).toBeUndefined();
  });

  it("should filter promotions per packaging independently", () => {
    const pkgs = [
      makePkg("PKG-A", undefined, [
        makePromotion({ promo_code: "A-UNIVERSAL" }),
        makePromotion({
          promo_code: "A-TAGGED",
          tag_filter: ["categoria-di-sconto:sconto-45"],
        }),
      ]),
      makePkg("PKG-B", undefined, [
        makePromotion({
          promo_code: "B-TAGGED",
          tag_filter: ["categoria-di-sconto:sconto-50"],
        }),
      ]),
    ];

    const result = resolvePackagingByTags(pkgs, ["categoria-di-sconto:sconto-45"]);

    // PKG-A: universal + matching tagged
    expect(result[0].promotions).toHaveLength(2);
    // PKG-B: tagged promo doesn't match
    expect(result[1].promotions).toHaveLength(0);
  });
});

// ============================================
// TAG-FILTER INTERSECTION LOGIC
// ============================================

describe("unit: Promotion tag_filter intersection", () => {
  it("should match when customer has superset of filter tags", () => {
    const promos = [
      makePromotion({ tag_filter: ["categoria-di-sconto:sconto-45"] }),
    ];
    const tags = [
      "categoria-di-sconto:sconto-45",
      "categoria-clienti:idraulico",
      "categoria-acquisto-medio-mensile:fascia-alta",
    ];

    const result = filterPromotionsByTags(promos, tags);
    expect(result).toHaveLength(1);
  });

  it("should match with cross-prefix tags in filter", () => {
    const promos = [
      makePromotion({
        tag_filter: [
          "categoria-di-sconto:sconto-45",
          "categoria-clienti:idraulico",
        ],
      }),
    ];

    // Customer has only one of the filter tags — still matches (OR logic)
    const result = filterPromotionsByTags(promos, ["categoria-clienti:idraulico"]);
    expect(result).toHaveLength(1);
  });

  it("should NOT match when customer has no overlapping tags", () => {
    const promos = [
      makePromotion({
        tag_filter: ["categoria-di-sconto:sconto-45", "categoria-clienti:idraulico"],
      }),
    ];

    const result = filterPromotionsByTags(promos, [
      "categoria-di-sconto:sconto-60",
      "categoria-clienti:ferramenta",
    ]);
    expect(result).toHaveLength(0);
  });

  it("should handle many promotions efficiently", () => {
    const promos = Array.from({ length: 100 }, (_, i) =>
      makePromotion({
        promo_code: `PROMO-${i}`,
        tag_filter: i % 2 === 0 ? ["categoria-di-sconto:sconto-45"] : ["categoria-di-sconto:sconto-50"],
      })
    );

    const result = filterPromotionsByTags(promos, ["categoria-di-sconto:sconto-45"]);
    expect(result).toHaveLength(50); // Even-indexed promos match
  });
});

// ============================================
// upsertTagRef ADVANCED TESTS
// ============================================

describe("unit: upsertTagRef — Advanced", () => {
  it("should preserve order of unmodified tags", () => {
    const existing = [
      makeTagRef("prefix-a", "val-1"),
      makeTagRef("prefix-b", "val-2"),
      makeTagRef("prefix-c", "val-3"),
    ];
    const newTag = makeTagRef("prefix-d", "val-4");
    const result = upsertTagRef(existing, newTag);

    expect(result).toHaveLength(4);
    expect(result[0].full_tag).toBe("prefix-a:val-1");
    expect(result[1].full_tag).toBe("prefix-b:val-2");
    expect(result[2].full_tag).toBe("prefix-c:val-3");
    expect(result[3].full_tag).toBe("prefix-d:val-4");
  });

  it("should be idempotent when upserting same tag twice", () => {
    const tag = makeTagRef("categoria-di-sconto", "sconto-45");
    let tags = upsertTagRef([], tag);
    tags = upsertTagRef(tags, tag);
    expect(tags).toHaveLength(1);
    expect(tags[0].full_tag).toBe("categoria-di-sconto:sconto-45");
  });

  it("should not mutate the original array", () => {
    const existing = [makeTagRef("prefix-a", "val-1")];
    const originalLength = existing.length;
    upsertTagRef(existing, makeTagRef("prefix-b", "val-2"));
    expect(existing).toHaveLength(originalLength);
  });
});

// ============================================
// removeTagRef ADVANCED TESTS
// ============================================

describe("unit: removeTagRef — Advanced", () => {
  it("should remove only the exact full_tag match", () => {
    const tags = [
      makeTagRef("categoria-di-sconto", "sconto-45"),
      makeTagRef("categoria-di-sconto", "sconto-50"),
    ];
    const result = removeTagRef(tags, "categoria-di-sconto:sconto-45");
    expect(result).toHaveLength(1);
    expect(result[0].full_tag).toBe("categoria-di-sconto:sconto-50");
  });

  it("should not mutate the original array", () => {
    const tags = [
      makeTagRef("prefix-a", "val-1"),
      makeTagRef("prefix-b", "val-2"),
    ];
    const originalLength = tags.length;
    removeTagRef(tags, "prefix-a:val-1");
    expect(tags).toHaveLength(originalLength);
  });

  it("should handle removing from single-element array", () => {
    const tags = [makeTagRef("prefix-a", "val-1")];
    const result = removeTagRef(tags, "prefix-a:val-1");
    expect(result).toHaveLength(0);
  });
});

// ============================================
// END-TO-END HIDROS SCENARIO
// ============================================

describe("unit: End-to-End Hidros Pricing Scenario", () => {
  // Simulate the real Hidros use case from the plan
  const PRODUCT_GROSS_PRICE = 100;

  function makeHidrosPkg(tagFilter?: string[]): PackagingOption {
    return {
      packaging_code: "CONF-1",
      packaging_label: "Pezzo",
      packaging_type: "piece",
      pack_size: 1,
      min_order_quantity: 1,
      pricing: {
        list_price: PRODUCT_GROSS_PRICE,
        sell_price: tagFilter?.includes("categoria-di-sconto:sconto-45")
          ? 55
          : tagFilter?.includes("categoria-di-sconto:sconto-50")
            ? 50
            : PRODUCT_GROSS_PRICE,
        sell_discount_pct: tagFilter?.includes("categoria-di-sconto:sconto-45")
          ? 45
          : tagFilter?.includes("categoria-di-sconto:sconto-50")
            ? 50
            : 0,
        sell_discount_amt: tagFilter?.includes("categoria-di-sconto:sconto-45")
          ? 45
          : tagFilter?.includes("categoria-di-sconto:sconto-50")
            ? 50
            : 0,
        tag_filter: tagFilter,
      },
      promotions: [
        makePromotion({
          promo_code: "PROMO-EXTRA-10",
          promo_label: "Extra 10% off",
          discount_percent: 10,
          // Universal promo — applies to everyone
        }),
        makePromotion({
          promo_code: "PROMO-VIP-5",
          promo_label: "VIP extra 5%",
          discount_percent: 5,
          tag_filter: ["categoria-clienti:idraulico"],
        }),
      ],
    };
  }

  it("Customer with sconto-45, address A (no override) → 45% discount + universal promo", () => {
    const customer = {
      tags: [
        makeTagRef("categoria-di-sconto", "sconto-45"),
        makeTagRef("categoria-clienti", "idraulico"),
      ],
    };
    const addressA = { tag_overrides: [] };

    const effectiveTags = resolveEffectiveTags(customer, addressA);
    expect(effectiveTags).toContain("categoria-di-sconto:sconto-45");
    expect(effectiveTags).toContain("categoria-clienti:idraulico");

    const pkgs = [makeHidrosPkg(["categoria-di-sconto:sconto-45"])];
    const resolved = resolvePackagingByTags(pkgs, effectiveTags);

    // Pricing visible (sconto-45 matches)
    expect(resolved[0].pricing).toBeDefined();
    expect(resolved[0].pricing!.sell_price).toBe(55);

    // Both promotions visible (universal + idraulico VIP)
    expect(resolved[0].promotions).toHaveLength(2);
  });

  it("Same customer, address B (override to sconto-50) → sees sconto-50 pricing", () => {
    const customer = {
      tags: [
        makeTagRef("categoria-di-sconto", "sconto-45"),
        makeTagRef("categoria-clienti", "idraulico"),
      ],
    };
    const addressB = {
      tag_overrides: [makeTagRef("categoria-di-sconto", "sconto-50")],
    };

    const effectiveTags = resolveEffectiveTags(customer, addressB);
    expect(effectiveTags).toContain("categoria-di-sconto:sconto-50");
    expect(effectiveTags).not.toContain("categoria-di-sconto:sconto-45");

    // sconto-45 pricing → NOT visible (wrong tag)
    const pkgs45 = [makeHidrosPkg(["categoria-di-sconto:sconto-45"])];
    const resolved45 = resolvePackagingByTags(pkgs45, effectiveTags);
    expect(resolved45[0].pricing).toBeUndefined();

    // sconto-50 pricing → visible
    const pkgs50 = [makeHidrosPkg(["categoria-di-sconto:sconto-50"])];
    const resolved50 = resolvePackagingByTags(pkgs50, effectiveTags);
    expect(resolved50[0].pricing).toBeDefined();
    expect(resolved50[0].pricing!.sell_price).toBe(50);

    // VIP promo still visible (idraulico tag not overridden)
    expect(resolved50[0].promotions).toHaveLength(2);
  });

  it("Customer with no discount tag → no tagged pricing visible, only universal promos", () => {
    const customer = {
      tags: [makeTagRef("categoria-clienti", "ferramenta")],
    };

    const effectiveTags = resolveEffectiveTags(customer, null);

    const pkgs = [makeHidrosPkg(["categoria-di-sconto:sconto-45"])];
    const resolved = resolvePackagingByTags(pkgs, effectiveTags);

    // No pricing (tagged, doesn't match)
    expect(resolved[0].pricing).toBeUndefined();

    // Only universal promo (VIP requires idraulico)
    expect(resolved[0].promotions).toHaveLength(1);
    expect(resolved[0].promotions![0].promo_code).toBe("PROMO-EXTRA-10");
  });

  it("Address overrides clienti tag → VIP promo no longer visible", () => {
    const customer = {
      tags: [
        makeTagRef("categoria-di-sconto", "sconto-45"),
        makeTagRef("categoria-clienti", "idraulico"),
      ],
    };
    // Address overrides clienti to ferramenta
    const address = {
      tag_overrides: [makeTagRef("categoria-clienti", "ferramenta")],
    };

    const effectiveTags = resolveEffectiveTags(customer, address);
    expect(effectiveTags).toContain("categoria-clienti:ferramenta");
    expect(effectiveTags).not.toContain("categoria-clienti:idraulico");

    const pkgs = [makeHidrosPkg(["categoria-di-sconto:sconto-45"])];
    const resolved = resolvePackagingByTags(pkgs, effectiveTags);

    // Pricing still visible (sconto-45 not overridden)
    expect(resolved[0].pricing).toBeDefined();

    // Only universal promo (VIP requires idraulico, customer now has ferramenta)
    expect(resolved[0].promotions).toHaveLength(1);
    expect(resolved[0].promotions![0].promo_code).toBe("PROMO-EXTRA-10");
  });
});

// ============================================
// VALIDATION EDGE CASES
// ============================================

describe("unit: Tag Validation — Edge Cases", () => {
  it("should accept numeric-only prefix", () => {
    expect(isValidPrefix("123")).toBe(true);
  });

  it("should accept single character prefix", () => {
    expect(isValidPrefix("a")).toBe(true);
  });

  it("should reject double dash", () => {
    expect(isValidPrefix("a--b")).toBe(false);
  });

  it("should reject prefix with dots", () => {
    expect(isValidPrefix("a.b")).toBe(false);
  });

  it("should reject prefix with slash", () => {
    expect(isValidPrefix("a/b")).toBe(false);
  });

  it("should accept long valid kebab-case", () => {
    expect(isValidPrefix("this-is-a-very-long-kebab-case-prefix")).toBe(true);
  });

  it("should accept code with numbers", () => {
    expect(isValidCode("sconto-45")).toBe(true);
    expect(isValidCode("level-100")).toBe(true);
    expect(isValidCode("99")).toBe(true);
  });
});
