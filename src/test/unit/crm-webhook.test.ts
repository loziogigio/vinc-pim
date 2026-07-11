// vinc-commerce-suite/src/test/unit/crm-webhook.test.ts
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "../conftest";
import { DealSchema } from "@/lib/db/models/deal";
import { verifyWebhook } from "@/lib/leads/crm-webhook";

const Deal = mongoose.models.Deal || mongoose.model("Deal", DealSchema);
beforeAll(async () => { await setupTestDatabase(); });
afterAll(async () => { await teardownTestDatabase(); });
beforeEach(async () => { await clearDatabase(); vi.restoreAllMocks(); });

describe("unit: crm-webhook", () => {
  it("verifies an HMAC-SHA256 signature (timing-safe)", () => {
    const secret = "s"; const body = '{"a":1}';
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyWebhook(body, sig, secret)).toBe(true);
    expect(verifyWebhook(body, "deadbeef", secret)).toBe(false);
  });

  it("advances the deal and emits the commercial event on stage change", async () => {
    await Deal.create({ form_submission_id: "fs1", buyer_segment: "b2b", source_form: "demo", page_slug: "richiedi-demo", crm_opportunity_id: "op1", stage: "audit_booked", first_touch: { channel: "paid_search", source: "google" } });
    const emit = vi.fn(async () => true);
    vi.resetModules();
    vi.doMock("@/lib/analytics/emit", () => ({ emitEvent: emit }));
    const { handleOpportunityEvent } = await import("@/lib/leads/crm-webhook");
    const res = await handleOpportunityEvent({ Deal } as any, {
      objectMetadata: { nameSingular: "opportunity" }, eventName: "opportunity.updated",
      record: { id: "op1", stage: "AUDIT_SOLD", amount: { amountMicros: 1900000000 } },
    });
    expect(res.applied).toBe(true);
    expect(res.event).toBe("Audit Sold");
    // Verify emit was actually called with the stage event (not silently dropped).
    // 2nd arg is the rsConfig (undefined here — not threaded in this call).
    expect(emit).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ event: "Audit Sold" }), undefined);
    const d = await Deal.findOne({ crm_opportunity_id: "op1" });
    expect(d?.stage).toBe("audit_sold");
    expect(d?.amount).toBe(1900);
  });

  it("no-ops when the mapped stage is unchanged", async () => {
    await Deal.create({ form_submission_id: "fs2", buyer_segment: "b2b", source_form: "demo", page_slug: "richiedi-demo", crm_opportunity_id: "op2", stage: "audit_sold" });
    vi.resetModules();
    const { handleOpportunityEvent } = await import("@/lib/leads/crm-webhook");
    const res = await handleOpportunityEvent({ Deal } as any, { record: { id: "op2", stage: "AUDIT_SOLD" } });
    expect(res.applied).toBe(false);
  });

  it("uses stored deal.amount when payload omits amountMicros (Fix 1 — no undefined regression)", async () => {
    await Deal.create({ form_submission_id: "fs3", buyer_segment: "b2b", source_form: "demo", page_slug: "richiedi-demo", crm_opportunity_id: "op3", stage: "audit_booked", amount: 9900, first_touch: {} });
    const emit = vi.fn(async () => true);
    vi.resetModules();
    vi.doMock("@/lib/analytics/emit", () => ({ emitEvent: emit }));
    const { handleOpportunityEvent } = await import("@/lib/leads/crm-webhook");
    const res = await handleOpportunityEvent({ Deal } as any, {
      record: { id: "op3", stage: "AUDIT_SOLD" }, // no amount field
    });
    expect(res.applied).toBe(true);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "Audit Sold",
        properties: expect.objectContaining({ amount: 9900 }),
      }),
      undefined
    );
  });

  it("threads the rsConfig (dynamic RudderStack settings) into emitEvent", async () => {
    await Deal.create({ form_submission_id: "fs5", buyer_segment: "b2b", source_form: "demo", page_slug: "richiedi-demo", crm_opportunity_id: "op5", stage: "audit_booked", first_touch: {} });
    const emit = vi.fn(async () => true);
    vi.resetModules();
    vi.doMock("@/lib/analytics/emit", () => ({ emitEvent: emit }));
    const { handleOpportunityEvent } = await import("@/lib/leads/crm-webhook");
    const rsConfig = { writeKey: "dyn-wk", dataPlaneUrl: "https://dyn.events" };
    await handleOpportunityEvent({ Deal } as any, { record: { id: "op5", stage: "AUDIT_SOLD" } }, rsConfig);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ event: "Audit Sold" }), rsConfig);
  });

  it("cash + new stage both fire (Fix 3 — no early return drops stage event)", async () => {
    await Deal.create({ form_submission_id: "fs4", buyer_segment: "b2b", source_form: "demo", page_slug: "richiedi-demo", crm_opportunity_id: "op4", stage: "audit_sold", amount: 1900, first_touch: {} });
    const emit = vi.fn(async () => true);
    vi.resetModules();
    vi.doMock("@/lib/analytics/emit", () => ({ emitEvent: emit }));
    const { handleOpportunityEvent } = await import("@/lib/leads/crm-webhook");
    const res = await handleOpportunityEvent({ Deal } as any, {
      record: { id: "op4", stage: "WON", cashCollected: true },
    });
    expect(res.applied).toBe(true);
    // Both events must be emitted
    const eventNames = emit.mock.calls.map((c: any) => c[0].event);
    expect(eventNames).toContain("Cash Collected");
    expect(eventNames).toContain("Deal Won");
    // Deal stage must advance
    const d = await Deal.findOne({ crm_opportunity_id: "op4" });
    expect(d?.stage).toBe("won");
    expect(d?.cash_collected_at).toBeTruthy();
  });
});
