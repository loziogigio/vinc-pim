import { describe, it, expect } from "vitest";
import { buildLeadContext } from "@/lib/leads/lead-context";

describe("unit: buildLeadContext", () => {
  it("uses full touch attribution when present + segment demo link + opening line", () => {
    const ctx = buildLeadContext({
      buyer_segment: "b2b",
      crm_opportunity_id: "op1",
      attribution: { buyer_segment: "b2b", marketing: { channel: "x" }, first: { channel: "paid_search", source: "google" }, last: { channel: "organic_social", source: "linkedin" }, consent: { analytics: true, marketing: false } },
    });
    expect(ctx.segmentLabel).toMatch(/Fornitore|Distributore/i);
    expect(ctx.demoUrl).toContain("demo-b2b.vendereincloud.it");
    expect(ctx.crmUrl).toContain("/object/opportunity/op1");
    expect(ctx.attributionLines.join(" ")).toMatch(/google/);
    expect(ctx.openingLine.length).toBeGreaterThan(10);
  });

  it("falls back to coarse marketing when no consent, then to 'non tracciata'", () => {
    const coarse = buildLeadContext({ buyer_segment: "b2c", attribution: { buyer_segment: "b2c", marketing: { channel: "referral", source: "partner" }, consent: { analytics: false, marketing: false } } });
    expect(coarse.attributionLines.join(" ")).toMatch(/referral|partner/);
    const none = buildLeadContext({ buyer_segment: "unsure" });
    expect(none.attributionLines.join(" ")).toMatch(/non tracciat/i);
  });
});
