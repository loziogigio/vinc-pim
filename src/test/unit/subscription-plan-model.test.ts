import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
} from "../conftest";
import { SubscriptionPlanModel } from "@/lib/db/models/subscription-plan";

describe("unit: SubscriptionPlan model (DB)", () => {
  beforeAll(async () => { await setupTestDatabase(); });
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); });

  it("creates a plan with generated id and defaults", async () => {
    const plan = await SubscriptionPlanModel.create({
      channel: "default",
      code: "basic",
      name: { en: "Basic", it: "Base" },
      currency: "EUR",
      billing_options: [{ interval: "month", base_price: 99 }],
      metrics: [
        { metric_key: "invoices", included_quantity: 1000, overage_unit_price: 0.13, aggregation: "sum" },
      ],
    });
    expect(plan.plan_id).toMatch(/^plan_/);
    expect(plan.status).toBe("active");
    expect(plan.kind).toBe("standard");
    expect(plan.checkout_mode).toBe("self_serve");
    expect(plan.public).toBe(false);
    expect(plan.sandbox_included).toBe(false);
    expect(plan.billing_options[0].interval_count).toBe(1);
    expect(plan.metrics[0].metric_key).toBe("invoices");
    expect(plan.created_at).toBeInstanceOf(Date);
  });

  it("enforces unique (channel, code)", async () => {
    const base = {
      channel: "default",
      code: "pro",
      name: { en: "Pro" },
      billing_options: [{ interval: "month", base_price: 299 }],
      metrics: [],
    };
    await SubscriptionPlanModel.create(base);
    await SubscriptionPlanModel.init(); // ensure indexes built
    await expect(SubscriptionPlanModel.create(base)).rejects.toThrow();
  });

  it("allows the same code on a different channel", async () => {
    await SubscriptionPlanModel.create({
      channel: "default", code: "pro", name: { en: "Pro" },
      billing_options: [{ interval: "month", base_price: 299 }], metrics: [],
    });
    const other = await SubscriptionPlanModel.create({
      channel: "b2b", code: "pro", name: { en: "Pro" },
      billing_options: [{ interval: "month", base_price: 299 }], metrics: [],
    });
    expect(other.plan_id).toMatch(/^plan_/);
  });
});
