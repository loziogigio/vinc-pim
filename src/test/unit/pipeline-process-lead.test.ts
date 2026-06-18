import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "../conftest";
import { DealSchema } from "@/lib/db/models/deal";

const Deal = mongoose.models.Deal || mongoose.model("Deal", DealSchema);

vi.mock("@/lib/services/crm-client", async (orig) => {
  const actual = await orig<typeof import("@/lib/services/crm-client")>();
  return {
    ...actual,
    TwentyClient: vi.fn(function () {
      return {
        findOrCreateCompany: vi.fn(async () => ({ id: "c1" })),
        findOrCreatePerson: vi.fn(async () => ({ id: "p1" })),
        createOpportunity: vi.fn(async () => ({ id: "op1" })),
      };
    }),
  };
});

beforeAll(async () => { await setupTestDatabase(); });
afterAll(async () => { await teardownTestDatabase(); });
beforeEach(async () => { await clearDatabase(); vi.restoreAllMocks(); });

describe("unit: processLead", () => {
  it("creates a deal, upserts Twenty, attaches op id, returns lead context", async () => {
    const { processLead } = await import("@/lib/leads/pipeline");
    const r = await processLead({
      models: { Deal } as any,
      twentyCfg: { baseUrl: "https://vinc.crm.vendereincloud.it", apiKey: "tok" },
      form_submission_id: "fs1",
      contact: { name: "Mario", email: "m@acme.it", company: "Acme", phone: "1" },
      buyer_segment: "b2b", source_form: "demo", page_slug: "richiedi-demo",
      attribution: { buyer_segment: "b2b", marketing: { channel: "organic_social", source: "linkedin" }, consent: { analytics: false, marketing: false } },
    });
    expect(r.crm_opportunity_id).toBe("op1");
    expect(r.leadContext.crmUrl).toContain("op1");
    const d = await Deal.findOne({ form_submission_id: "fs1" });
    expect(d?.crm_opportunity_id).toBe("op1");
  });
});
