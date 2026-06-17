import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "../conftest";
import { DealSchema } from "@/lib/db/models/deal";

const Deal = mongoose.models.Deal || mongoose.model("Deal", DealSchema);

beforeAll(async () => { await setupTestDatabase(); });
afterAll(async () => { await teardownTestDatabase(); });
beforeEach(async () => { await clearDatabase(); });

describe("unit: Deal model", () => {
  it("defaults stage to new_lead and stores a first-touch snapshot", async () => {
    const d = await Deal.create({
      form_submission_id: "fs1", contact_email: "a@b.com", buyer_segment: "b2b",
      source_form: "demo", page_slug: "richiedi-demo",
      marketing_last: { channel: "organic_social", source: "linkedin" },
      first_touch: { channel: "paid_search", source: "google", ts: "2026-06-17T00:00:00Z" },
      consent: { analytics: true, marketing: false },
    });
    expect(d.stage).toBe("new_lead");
    expect(d.currency).toBe("EUR");
    expect(d.first_touch?.source).toBe("google");
    expect(d.marketing_last?.channel).toBe("organic_social");
  });

  it("enforces one deal per form_submission_id", async () => {
    await Deal.create({ form_submission_id: "dup", buyer_segment: "b2b", source_form: "demo", page_slug: "richiedi-demo" });
    await expect(
      Deal.create({ form_submission_id: "dup", buyer_segment: "b2c", source_form: "demo", page_slug: "richiedi-demo" })
    ).rejects.toThrow();
  });
});
