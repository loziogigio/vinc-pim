import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
} from "../conftest";
import { nanoid } from "nanoid";
import type { ICustomerTagRef } from "@/lib/db/models/customer-tag";

// Importing the worker module instantiates `new Worker(...)`; mock bullmq so no
// real Redis connection is attempted (mirrors import-worker-dynamic-blocks.test.ts).
vi.mock("bullmq", () => ({
  Worker: class MockWorker { on = vi.fn(); close = vi.fn(); },
  Queue: class MockQueue { add = vi.fn(); },
  Job: vi.fn(),
}));

// Deterministic public code
vi.mock("@/lib/db/models/counter", () => ({
  getNextCustomerPublicCode: vi.fn(async () => `PUB-${nanoid(4)}`),
}));

// Real in-memory Customer/CustomerTag; ImportJob is stubbed (the worker tolerates
// a missing job — findOneAndUpdate/findOne just return null).
vi.mock("@/lib/db/connection", async () => {
  const { CustomerModel } = await import("@/lib/db/models/customer");
  const { CustomerTagModel } = await import("@/lib/db/models/customer-tag");
  const ImportJobStub = {
    findOne: vi.fn(async () => null),
    findOneAndUpdate: vi.fn(async () => null),
  };
  return {
    connectToDatabase: vi.fn(() => Promise.resolve()),
    connectWithModels: vi.fn(() =>
      Promise.resolve({
        Customer: CustomerModel,
        CustomerTag: CustomerTagModel,
        ImportJob: ImportJobStub,
      }),
    ),
  };
});

import { processCustomerImportData } from "@/lib/queue/customer-import-worker";
import { CustomerModel } from "@/lib/db/models/customer";
import { CustomerTagModel } from "@/lib/db/models/customer-tag";

const TENANT = "test-tenant";

async function runImport(customers: unknown[], merge_mode: "replace" | "partial" = "replace") {
  return processCustomerImportData({
    job_id: `job_${nanoid(6)}`,
    tenant_id: TENANT,
    merge_mode,
    customers: customers as never,
  });
}

describe("unit: customer import — agent tags", () => {
  beforeAll(async () => { await setupTestDatabase(); });
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); });

  it("creates the agent tag def and assigns it on import", async () => {
    const res = await runImport([
      {
        external_code: "CUST-1",
        company_name: "Acme",
        agent_code: "M01",
        agent_name: "Mario Rossi",
      },
    ]);
    expect(res.successful).toBe(1);

    const def = await CustomerTagModel.findOne({ full_tag: "agente:m01" }).lean();
    expect(def).toBeTruthy();
    expect(def!.description).toBe("Mario Rossi");

    const c = await CustomerModel.findOne({ external_code: "CUST-1" }).lean();
    expect(c!.tags.find((t: ICustomerTagRef) => t.full_tag === "agente:m01")).toBeTruthy();
  });

  it("applies an address-level agent override", async () => {
    await runImport([
      {
        external_code: "CUST-2",
        company_name: "Beta",
        agent_code: "M01",
        addresses: [
          {
            external_code: "ADDR-A",
            address_type: "delivery",
            recipient_name: "B",
            street_address: "Via 1",
            city: "Milano",
            province: "MI",
            postal_code: "20100",
            agent_code: "M07",
          },
        ],
      },
    ]);
    const c = await CustomerModel.findOne({ external_code: "CUST-2" }).lean();
    expect(c!.tags.find((t: ICustomerTagRef) => t.full_tag === "agente:m01")).toBeTruthy();
    const addr = c!.addresses.find((a: { external_code?: string }) => a.external_code === "ADDR-A");
    expect(addr.tag_overrides.find((t: ICustomerTagRef) => t.full_tag === "agente:m07")).toBeTruthy();
  });

  it("clears the agent on a later import with agent_code: null", async () => {
    await runImport([{ external_code: "CUST-3", company_name: "Gamma", agent_code: "M01" }]);
    await runImport([{ external_code: "CUST-3", company_name: "Gamma", agent_code: null }]);
    const c = await CustomerModel.findOne({ external_code: "CUST-3" }).lean();
    expect(c!.tags.find((t: ICustomerTagRef) => t.prefix === "agente")).toBeUndefined();
  });
});
