import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "../conftest";
import { DealSchema } from "@/lib/db/models/deal";
import { createDealFromLead, updateDealStage, findByOpportunity, attachCrmIds } from "@/lib/services/deal.service";

const Deal = mongoose.models.Deal || mongoose.model("Deal", DealSchema);
const models = { Deal } as any;

beforeAll(async () => { await setupTestDatabase(); });
afterAll(async () => { await teardownTestDatabase(); });
beforeEach(async () => { await clearDatabase(); });

const lead = {
  form_submission_id: "fs1",
  contact: { name: "Mario", email: "m@acme.it", company: "Acme", phone: "123" },
  buyer_segment: "b2b" as const,
  source_form: "demo" as const,
  page_slug: "richiedi-demo",
  attribution: {
    anonymous_id: "anon1", buyer_segment: "b2b" as const,
    marketing: { channel: "organic_social", source: "linkedin" },
    first: { channel: "paid_search", source: "google", ts: "2026-06-17T00:00:00Z" },
    consent: { analytics: true, marketing: false },
  },
};

describe("unit: deal.service", () => {
  it("creates a deal carrying contact, segment, anonymous_id, first_touch and coarse marketing_last", async () => {
    const d = await createDealFromLead(models, lead);
    expect(d.contact_email).toBe("m@acme.it");
    expect(d.anonymous_id).toBe("anon1");
    expect(d.first_touch?.source).toBe("google");
    expect(d.marketing_last?.channel).toBe("organic_social");
    expect(d.stage).toBe("new_lead");
  });

  it("is idempotent on form_submission_id (returns the existing deal, no duplicate)", async () => {
    const a = await createDealFromLead(models, lead);
    const b = await createDealFromLead(models, lead);
    expect(String(a._id)).toBe(String(b._id));
    expect(await Deal.countDocuments({ form_submission_id: "fs1" })).toBe(1);
  });

  it("attaches CRM ids then finds + advances by opportunity id", async () => {
    const d = await createDealFromLead(models, lead);
    await attachCrmIds(models, String(d._id), { company_id: "c1", person_id: "p1", opportunity_id: "op1", stage: "New Lead" });
    const found = await findByOpportunity(models, "op1");
    expect(found?.crm_company_id).toBe("c1");
    const moved = await updateDealStage(models, "op1", "audit_sold", { amount: 1900, crm_stage: "Audit Sold" });
    expect(moved?.stage).toBe("audit_sold");
    expect(moved?.amount).toBe(1900);
  });
});
