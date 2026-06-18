// vinc-commerce-suite/src/test/unit/crm-webhook.test.ts
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "../conftest";
import { DealSchema } from "@/lib/db/models/deal";
import { verifyWebhook, handleOpportunityEvent } from "@/lib/leads/crm-webhook";

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
    vi.doMock("@/lib/analytics/emit", () => ({ emitEvent: emit }));
    const { handleOpportunityEvent } = await import("@/lib/leads/crm-webhook");
    const res = await handleOpportunityEvent({ Deal } as any, {
      objectMetadata: { nameSingular: "opportunity" }, eventName: "opportunity.updated",
      record: { id: "op1", stage: "AUDIT_SOLD", amount: { amountMicros: 1900000000 } },
    });
    expect(res.applied).toBe(true);
    expect(res.event).toBe("Audit Sold");
    const d = await Deal.findOne({ crm_opportunity_id: "op1" });
    expect(d?.stage).toBe("audit_sold");
    expect(d?.amount).toBe(1900);
  });

  it("no-ops when the mapped stage is unchanged", async () => {
    await Deal.create({ form_submission_id: "fs2", buyer_segment: "b2b", source_form: "demo", page_slug: "richiedi-demo", crm_opportunity_id: "op2", stage: "audit_sold" });
    const res = await handleOpportunityEvent({ Deal } as any, { record: { id: "op2", stage: "AUDIT_SOLD" } });
    expect(res.applied).toBe(false);
  });
});
