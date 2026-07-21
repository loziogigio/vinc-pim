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

  it("listSubscriptionPlans resolves without throwing when search contains unescaped regex special chars", async () => {
    // "(unclosed" is an invalid regex — without escaping this would throw / reject
    const res = await listSubscriptionPlans(TENANT_DB, { search: "(unclosed" });
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data!.items)).toBe(true);
  });

  it("listSubscriptionPlans matches literal special-char code exactly", async () => {
    await createSubscriptionPlan(TENANT_DB, { ...validPlan(), code: "promo(x)" });
    await createSubscriptionPlan(TENANT_DB, { ...validPlan(), code: "promox" });
    const res = await listSubscriptionPlans(TENANT_DB, { search: "promo(x)" });
    expect(res.success).toBe(true);
    expect(res.data!.items).toHaveLength(1);
    expect(res.data!.items[0].code).toBe("promo(x)");
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

  it("deleting a missing plan returns 404", async () => {
    const res = await deleteSubscriptionPlan(TENANT_DB, "plan_doesnotexist");
    expect(res.success).toBe(false);
    expect(res.status).toBe(404);
  });

  // ── enum validation: reject at the service boundary with 400, never let
  //    Mongoose throw into the route's catch-all (which would emit a 500)
  it.each([
    ["kind", { kind: "bogus" }],
    ["checkout_mode", { checkout_mode: "bogus" }],
    ["status", { status: "bogus" }],
  ])("create rejects an invalid %s with 400", async (_field, patch) => {
    const res = await createSubscriptionPlan(TENANT_DB, {
      ...validPlan(),
      ...patch,
    } as unknown as Parameters<typeof createSubscriptionPlan>[1]);
    expect(res.success).toBe(false);
    expect(res.status).toBe(400);
  });

  it("create rejects an invalid metric aggregation with 400", async () => {
    const res = await createSubscriptionPlan(TENANT_DB, {
      ...validPlan(),
      metrics: [{ metric_key: "invoices", included_quantity: 10, overage_unit_price: 1, aggregation: "bogus" }],
    } as unknown as Parameters<typeof createSubscriptionPlan>[1]);
    expect(res.success).toBe(false);
    expect(res.status).toBe(400);
  });

  it("update rejects an invalid enum with 400", async () => {
    const created = await createSubscriptionPlan(TENANT_DB, validPlan());
    const res = await updateSubscriptionPlan(
      TENANT_DB,
      created.data!.plan_id,
      { kind: "bogus" } as unknown as Parameters<typeof updateSubscriptionPlan>[2]
    );
    expect(res.success).toBe(false);
    expect(res.status).toBe(400);
  });

  // ── update must mirror create's required-field guards
  it("update rejects blanking the code with 400", async () => {
    const created = await createSubscriptionPlan(TENANT_DB, validPlan());
    const res = await updateSubscriptionPlan(TENANT_DB, created.data!.plan_id, { code: "" });
    expect(res.success).toBe(false);
    expect(res.status).toBe(400);
  });

  it("update rejects nulling the name with 400", async () => {
    const created = await createSubscriptionPlan(TENANT_DB, validPlan());
    const res = await updateSubscriptionPlan(
      TENANT_DB,
      created.data!.plan_id,
      { name: null } as unknown as Parameters<typeof updateSubscriptionPlan>[2]
    );
    expect(res.success).toBe(false);
    expect(res.status).toBe(400);
  });

  // ── duplicate collapsing
  it("rejects duplicate metric_key within a plan", async () => {
    const res = await createSubscriptionPlan(TENANT_DB, {
      ...validPlan(),
      metrics: [
        { metric_key: "invoices", included_quantity: 1000, overage_unit_price: 0.13, aggregation: "sum" as const },
        { metric_key: "invoices", included_quantity: 5000, overage_unit_price: 0.08, aggregation: "sum" as const },
      ],
    });
    expect(res.success).toBe(false);
    expect(res.status).toBe(400);
  });

  it("rejects two billing options with the same interval and count", async () => {
    const res = await createSubscriptionPlan(TENANT_DB, {
      ...validPlan(),
      billing_options: [
        { interval: "month" as const, interval_count: 1, base_price: 99 },
        { interval: "month" as const, interval_count: 1, base_price: 79 },
      ],
    });
    expect(res.success).toBe(false);
    expect(res.status).toBe(400);
  });

  it("allows monthly and quarterly (same interval, different count)", async () => {
    const res = await createSubscriptionPlan(TENANT_DB, {
      ...validPlan(),
      billing_options: [
        { interval: "month" as const, interval_count: 1, base_price: 99 },
        { interval: "month" as const, interval_count: 3, base_price: 270 },
      ],
    });
    expect(res.success).toBe(true);
    expect(res.data!.billing_options).toHaveLength(2);
  });

  // ── negative bounds
  it("rejects a negative hard_cap", async () => {
    const res = await createSubscriptionPlan(TENANT_DB, {
      ...validPlan(),
      metrics: [
        { metric_key: "invoices", included_quantity: 10, overage_unit_price: 1, hard_cap: -1, aggregation: "sum" as const },
      ],
    });
    expect(res.success).toBe(false);
    expect(res.status).toBe(400);
  });

  it("rejects negative trial_days", async () => {
    const res = await createSubscriptionPlan(TENANT_DB, { ...validPlan(), trial_days: -30 });
    expect(res.success).toBe(false);
    expect(res.status).toBe(400);
  });

  it("still accepts a null hard_cap and null trial_days", async () => {
    const res = await createSubscriptionPlan(TENANT_DB, {
      ...validPlan(),
      trial_days: null,
      metrics: [
        { metric_key: "invoices", included_quantity: 10, overage_unit_price: 1, hard_cap: null, aggregation: "sum" as const },
      ],
    });
    expect(res.success).toBe(true);
    expect(res.data!.metrics[0].hard_cap).toBeNull();
  });
});
