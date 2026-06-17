import { describe, it, expect } from "vitest";
import { ORDER_HISTORY_DEFINITIONS } from "../../../scripts/demo/demo-order-history";
import { findExternalRefField, validateFieldsTree } from "@/lib/db/models/data-model-definition";

describe("order-history definitions", () => {
  it("installs the 4 customer-keyed b2b models, all end-user readable", () => {
    const slugs = ORDER_HISTORY_DEFINITIONS.map((d) => d.slug).sort();
    expect(slugs).toEqual(["credit_exposure", "delivery_note", "historical_order", "invoice"]);
    for (const d of ORDER_HISTORY_DEFINITIONS) {
      expect(d.relation).toBe("customer");
      expect(d.cardinality).toBe("multiple");
      expect(d.channel).toBe("b2b");
      expect(d.readable_by_end_user).toBe(true);
      expect(d.enabled).toBe(true);
      expect(() => validateFieldsTree(d.fields)).not.toThrow();
      expect(findExternalRefField(d.fields)).toBeTruthy(); // each has an idempotency key
    }
  });
  it("date sort fields exist as `date` type", () => {
    const bySlug = Object.fromEntries(ORDER_HISTORY_DEFINITIONS.map((d) => [d.slug, d]));
    const hasDate = (d: any, slug: string) => d.fields.find((f: any) => f.slug === slug)?.type === "date";
    expect(hasDate(bySlug.historical_order, "document_date")).toBe(true);
    expect(hasDate(bySlug.invoice, "data")).toBe(true);
    expect(hasDate(bySlug.delivery_note, "data")).toBe(true);
  });
});
