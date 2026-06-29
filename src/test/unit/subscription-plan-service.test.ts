import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
} from "../conftest";

// Mock the connection to use the in-memory model (must precede service import)
vi.mock("@/lib/db/connection", async () => {
  const { SubscriptionPlanModel } = await import("@/lib/db/models/subscription-plan");
  return {
    connectToDatabase: vi.fn(() => Promise.resolve()),
    connectWithModels: vi.fn(() =>
      Promise.resolve({ SubscriptionPlan: SubscriptionPlanModel })
    ),
  };
});

import {
  createSubscriptionPlan,
  getSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  listSubscriptionPlans,
} from "@/lib/services/subscription-plan.service";
import { SubscriptionPlanModel } from "@/lib/db/models/subscription-plan";

const TENANT_DB = "vinc-test";

const validPlan = () => ({
  channel: "default",
  code: "basic",
  name: { en: "Basic", it: "Base" },
  currency: "EUR",
  billing_options: [{ interval: "month" as const, interval_count: 1, base_price: 99 }],
  metrics: [
    { metric_key: "invoices", included_quantity: 1000, overage_unit_price: 0.13, aggregation: "sum" as const },
  ],
});

describe("unit: subscription-plan.service", () => {
  beforeAll(async () => { await setupTestDatabase(); await SubscriptionPlanModel.init(); });
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); });

  it("creates a plan", async () => {
    const res = await createSubscriptionPlan(TENANT_DB, validPlan());
    expect(res.success).toBe(true);
    expect(res.data!.plan_id).toMatch(/^plan_/);
    expect(res.data!.code).toBe("basic");
  });

  it("rejects an invalid channel code", async () => {
    const res = await createSubscriptionPlan(TENANT_DB, { ...validPlan(), channel: "Not Valid" });
    expect(res.success).toBe(false);
    expect(res.status).toBe(400);
  });

  it("rejects a plan with no billing options", async () => {
    const res = await createSubscriptionPlan(TENANT_DB, { ...validPlan(), billing_options: [] });
    expect(res.success).toBe(false);
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate (channel, code)", async () => {
    await createSubscriptionPlan(TENANT_DB, validPlan());
    const res = await createSubscriptionPlan(TENANT_DB, validPlan());
    expect(res.success).toBe(false);
    expect(res.status).toBe(409);
  });

  it("lists plans filtered by channel and paginated", async () => {
    await createSubscriptionPlan(TENANT_DB, validPlan());
    await createSubscriptionPlan(TENANT_DB, { ...validPlan(), code: "pro", channel: "b2b" });
    const res = await listSubscriptionPlans(TENANT_DB, { channel: "default", page: 1, limit: 10 });
    expect(res.success).toBe(true);
    expect(res.data!.items).toHaveLength(1);
    expect(res.data!.items[0].code).toBe("basic");
    expect(res.data!.pagination.total).toBe(1);
  });

  it("updates and deletes a plan", async () => {
    const created = await createSubscriptionPlan(TENANT_DB, validPlan());
    const id = created.data!.plan_id;

    const upd = await updateSubscriptionPlan(TENANT_DB, id, { status: "archived", public: true });
    expect(upd.success).toBe(true);
    expect(upd.data!.status).toBe("archived");
    expect(upd.data!.public).toBe(true);

    const got = await getSubscriptionPlan(TENANT_DB, id);
    expect(got.success).toBe(true);

    const del = await deleteSubscriptionPlan(TENANT_DB, id);
    expect(del.success).toBe(true);
    const after = await getSubscriptionPlan(TENANT_DB, id);
    expect(after.success).toBe(false);
    expect(after.status).toBe(404);
  });
});
