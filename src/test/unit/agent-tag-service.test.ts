import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
} from "../conftest";
import type { ICustomerTagRef } from "@/lib/db/models/customer-tag";

// Mock connection to use the in-memory models (must be before importing the service)
vi.mock("@/lib/db/connection", async () => {
  const { CustomerModel } = await import("@/lib/db/models/customer");
  const { CustomerTagModel } = await import("@/lib/db/models/customer-tag");
  return {
    connectToDatabase: vi.fn(() => Promise.resolve()),
    connectWithModels: vi.fn(() =>
      Promise.resolve({ Customer: CustomerModel, CustomerTag: CustomerTagModel }),
    ),
  };
});

import {
  applyAgentToRefs,
  ensureAgentTagDef,
  applyCustomerAgentTags,
} from "@/lib/services/agent-tag.service";
import { CustomerModel } from "@/lib/db/models/customer";
import { CustomerTagModel } from "@/lib/db/models/customer-tag";
import { nanoid } from "nanoid";

const TENANT = "test-tenant";
const TENANT_DB = `vinc-${TENANT}`;

function tagRef(prefix: string, code: string): ICustomerTagRef {
  return { tag_id: `ctag_${nanoid(6)}`, full_tag: `${prefix}:${code}`, prefix, code };
}

async function seedCustomer(overrides: Record<string, unknown> = {}) {
  const customer_id = `cust_${nanoid(8)}`;
  await CustomerModel.create({
    customer_id,
    external_code: `EXT-${nanoid(4)}`,
    tenant_id: TENANT,
    customer_type: "business",
    email: "c@example.com",
    tags: [],
    addresses: [],
    ...overrides,
  });
  return customer_id;
}

describe("unit: applyAgentToRefs (pure)", () => {
  it("assigns an agent ref, replacing any existing agent ref", () => {
    const refs = [tagRef("categoria-di-sconto", "sconto-45"), tagRef("agente", "m01")];
    const next = applyAgentToRefs(refs, tagRef("agente", "m02"));
    expect(next.filter((t) => t.prefix === "agente")).toHaveLength(1);
    expect(next.find((t) => t.prefix === "agente")!.code).toBe("m02");
    // non-agent tag preserved
    expect(next.find((t) => t.prefix === "categoria-di-sconto")).toBeTruthy();
  });

  it("clears the agent ref when given null", () => {
    const refs = [tagRef("categoria-di-sconto", "sconto-45"), tagRef("agente", "m01")];
    const next = applyAgentToRefs(refs, null);
    expect(next.find((t) => t.prefix === "agente")).toBeUndefined();
    expect(next).toHaveLength(1);
  });
});

describe("unit: agent-tag.service (DB)", () => {
  beforeAll(async () => { await setupTestDatabase(); });
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); });

  it("ensureAgentTagDef upserts a def and returns its ref", async () => {
    const ref = await ensureAgentTagDef(TENANT_DB, "M01", "Mario Rossi");
    expect(ref).not.toBeNull();
    expect(ref!.full_tag).toBe("agente:m01");
    expect(ref!.prefix).toBe("agente");
    expect(ref!.code).toBe("m01");

    const def = await CustomerTagModel.findOne({ full_tag: "agente:m01" }).lean();
    expect(def).toBeTruthy();
    expect(def!.description).toBe("Mario Rossi");

    // idempotent + updates name
    const ref2 = await ensureAgentTagDef(TENANT_DB, "M01", "Mario Bianchi");
    expect(ref2!.tag_id).toBe(ref!.tag_id);
    const def2 = await CustomerTagModel.findOne({ full_tag: "agente:m01" }).lean();
    expect(def2!.description).toBe("Mario Bianchi");
  });

  it("ensureAgentTagDef returns null for junk code", async () => {
    expect(await ensureAgentTagDef(TENANT_DB, "///")).toBeNull();
  });

  it("applyCustomerAgentTags assigns the agent at customer level", async () => {
    const id = await seedCustomer();
    await applyCustomerAgentTags(TENANT_DB, TENANT, id, { agent_code: "M01", agent_name: "Mario" });
    const c = await CustomerModel.findOne({ customer_id: id }).lean();
    expect(c!.tags.find((t: ICustomerTagRef) => t.full_tag === "agente:m01")).toBeTruthy();
  });

  it("applyCustomerAgentTags replaces the agent on reassignment", async () => {
    const id = await seedCustomer({ tags: [tagRef("agente", "m01")] });
    await applyCustomerAgentTags(TENANT_DB, TENANT, id, { agent_code: "M02" });
    const c = await CustomerModel.findOne({ customer_id: id }).lean();
    const agentTags = c!.tags.filter((t: ICustomerTagRef) => t.prefix === "agente");
    expect(agentTags).toHaveLength(1);
    expect(agentTags[0].code).toBe("m02");
  });

  it("applyCustomerAgentTags clears the agent on explicit null", async () => {
    const id = await seedCustomer({ tags: [tagRef("agente", "m01")] });
    await applyCustomerAgentTags(TENANT_DB, TENANT, id, { agent_code: null });
    const c = await CustomerModel.findOne({ customer_id: id }).lean();
    expect(c!.tags.find((t: ICustomerTagRef) => t.prefix === "agente")).toBeUndefined();
  });

  it("applyCustomerAgentTags applies an address-level override by external_code", async () => {
    const id = await seedCustomer({
      addresses: [{
        address_id: nanoid(8), external_code: "ADDR-1", address_type: "delivery",
        is_default: true, recipient_name: "x", street_address: "s", city: "c",
        province: "p", postal_code: "z", country: "IT", tag_overrides: [],
        created_at: new Date(), updated_at: new Date(),
      }],
    });
    await applyCustomerAgentTags(TENANT_DB, TENANT, id, {
      addresses: [{ external_code: "ADDR-1", agent_code: "M09" }],
    });
    const c = await CustomerModel.findOne({ customer_id: id }).lean();
    expect(c!.addresses[0].tag_overrides.find((t: ICustomerTagRef) => t.full_tag === "agente:m09")).toBeTruthy();
  });
});
