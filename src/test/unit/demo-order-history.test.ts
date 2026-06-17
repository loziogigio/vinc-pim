import { describe, it, expect } from "vitest";
import { ORDER_HISTORY_DEFINITIONS } from "../../../scripts/demo/demo-order-history";
import { buildOrderHistoryRecords } from "../../../scripts/demo/demo-order-history";
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

describe("order-history records", () => {
  const recs = buildOrderHistoryRecords(new Date("2026-06-01T00:00:00Z"));
  it("keys every record by the ERP customer code DEMO-C01/02 (= external_code)", () => {
    for (const r of recs) {
      expect(["DEMO-C01", "DEMO-C02"]).toContain(r.relation_id);
      expect(r.relation_id).not.toMatch(/^CUST-DEMO/); // NOT the internal customer_id
      expect(r.channel).toBe("b2b");
    }
  });
  it("produces 6+ historical_orders per customer spread over months", () => {
    const orders = recs.filter((r) => r.slug === "historical_order" && r.relation_id === "DEMO-C01");
    expect(orders.length).toBeGreaterThanOrEqual(6);
    const months = orders.map((o) => new Date(o.data.document_date as string).getMonth());
    expect(new Set(months).size).toBeGreaterThanOrEqual(4);
  });
  it("invoice/delivery_note carry the BFF sort date field `data`", () => {
    const inv = recs.find((r) => r.slug === "invoice")!;
    expect(inv.data.data).toBeTruthy();
    const ddt = recs.find((r) => r.slug === "delivery_note")!;
    expect(ddt.data.data).toBeTruthy();
  });
});
