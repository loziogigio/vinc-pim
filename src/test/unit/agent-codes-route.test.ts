import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
} from "../conftest";
import { nanoid } from "nanoid";

vi.mock("@/app/api/b2b/customer-tags/_auth", () => ({
  getTagAuth: vi.fn(async () => ({ tenantId: "test-tenant", tenantDb: "vinc-test-tenant" })),
}));

vi.mock("@/lib/db/connection", async () => {
  const { CustomerModel } = await import("@/lib/db/models/customer");
  const { CustomerTagModel } = await import("@/lib/db/models/customer-tag");
  return {
    connectWithModels: vi.fn(() =>
      Promise.resolve({ Customer: CustomerModel, CustomerTag: CustomerTagModel })),
  };
});

import { GET } from "@/app/api/b2b/agent-codes/route";
import { CustomerModel } from "@/lib/db/models/customer";
import { CustomerTagModel } from "@/lib/db/models/customer-tag";

function agentRef(code: string) {
  return { tag_id: `ctag_${nanoid(6)}`, full_tag: `agente:${code}`, prefix: "agente", code };
}

async function seed() {
  await CustomerTagModel.create({
    prefix: "agente", code: "m01", full_tag: "agente:m01", description: "Mario",
  });
  await CustomerTagModel.create({
    prefix: "agente", code: "m02", full_tag: "agente:m02", description: "Anna",
  });
  // m99 has a def but NO assignment → must NOT appear (auto-retire)
  await CustomerTagModel.create({
    prefix: "agente", code: "m99", full_tag: "agente:m99", description: "Retired",
  });

  await CustomerModel.create({
    customer_id: `cust_${nanoid(8)}`, tenant_id: "test-tenant", external_code: "C1",
    customer_type: "business", email: "a@x.it", tags: [agentRef("m01")], addresses: [],
  });
  await CustomerModel.create({
    customer_id: `cust_${nanoid(8)}`, tenant_id: "test-tenant", external_code: "C2",
    customer_type: "business", email: "b@x.it", tags: [agentRef("m01")],
    addresses: [{
      address_id: nanoid(8), external_code: "A2", address_type: "delivery", is_default: true,
      recipient_name: "x", street_address: "s", city: "c", province: "p", postal_code: "z",
      country: "IT", tag_overrides: [agentRef("m02")], created_at: new Date(), updated_at: new Date(),
    }],
  });
}

describe("unit: GET /api/b2b/agent-codes", () => {
  beforeAll(async () => { await setupTestDatabase(); });
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); });

  it("returns only assigned agents with live counts, sorted by code", async () => {
    await seed();
    const res = await GET();
    const body = await res.json();

    expect(body.success).toBe(true);
    const codes = body.agents.map((a: { code: string }) => a.code);
    expect(codes).toEqual(["m01", "m02"]); // m99 excluded (no assignment)

    const m01 = body.agents.find((a: { code: string }) => a.code === "m01");
    expect(m01.name).toBe("Mario");
    expect(m01.customer_count).toBe(2); // C1 + C2

    const m02 = body.agents.find((a: { code: string }) => a.code === "m02");
    expect(m02.customer_count).toBe(1); // C2 address override
  });

  it("returns an empty list when no agents are assigned", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.agents).toEqual([]);
  });
});
