import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
} from "../conftest";
import { buildAuthedRequest } from "../helpers/auth";

const TENANT_ID = "test-tenant";
const TENANT_DB = "vinc-test-tenant";

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(() =>
    Promise.resolve({ success: true, tenantId: TENANT_ID, tenantDb: TENANT_DB, userId: "test-user" })
  ),
}));

vi.mock("@/lib/db/connection", async () => {
  const { SubscriptionPlanModel } = await import("@/lib/db/models/subscription-plan");
  return {
    connectToDatabase: vi.fn(() => Promise.resolve()),
    connectWithModels: vi.fn(() => Promise.resolve({ SubscriptionPlan: SubscriptionPlanModel })),
  };
});

import { GET as listPlans, POST as createPlan } from "@/app/api/b2b/subscription-plans/route";
import {
  GET as getPlan,
  PATCH as patchPlan,
  DELETE as deletePlan,
} from "@/app/api/b2b/subscription-plans/[plan_id]/route";
import { SubscriptionPlanModel } from "@/lib/db/models/subscription-plan";

const validBody = () => ({
  channel: "default",
  code: "basic",
  name: { en: "Basic" },
  billing_options: [{ interval: "month", base_price: 99 }],
  metrics: [{ metric_key: "invoices", included_quantity: 1000, overage_unit_price: 0.13, aggregation: "sum" }],
});

describe("api: /api/b2b/subscription-plans", () => {
  beforeAll(async () => { await setupTestDatabase(); await SubscriptionPlanModel.init(); });
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); });

  it("POST creates a plan (201) and GET lists it", async () => {
    const createRes = await createPlan(
      buildAuthedRequest("POST", "/api/b2b/subscription-plans", TENANT_ID, validBody())
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.success).toBe(true);
    expect(created.plan.plan_id).toMatch(/^plan_/);

    const listRes = await listPlans(
      buildAuthedRequest("GET", "/api/b2b/subscription-plans?channel=default", TENANT_ID)
    );
    const list = await listRes.json();
    expect(list.success).toBe(true);
    expect(list.items).toHaveLength(1);
    expect(list.pagination.total).toBe(1);
  });

  it("POST rejects a missing channel (400)", async () => {
    const res = await createPlan(
      buildAuthedRequest("POST", "/api/b2b/subscription-plans", TENANT_ID, { ...validBody(), channel: "" })
    );
    expect(res.status).toBe(400);
  });

  it("GET/PATCH/DELETE by id", async () => {
    const created = await (
      await createPlan(buildAuthedRequest("POST", "/api/b2b/subscription-plans", TENANT_ID, validBody()))
    ).json();
    const planId = created.plan.plan_id;
    const ctx = { params: Promise.resolve({ plan_id: planId }) };

    const getRes = await getPlan(
      buildAuthedRequest("GET", `/api/b2b/subscription-plans/${planId}`, TENANT_ID),
      ctx
    );
    expect((await getRes.json()).plan.code).toBe("basic");

    const patchRes = await patchPlan(
      buildAuthedRequest("PATCH", `/api/b2b/subscription-plans/${planId}`, TENANT_ID, { public: true }),
      ctx
    );
    expect((await patchRes.json()).plan.public).toBe(true);

    const delRes = await deletePlan(
      buildAuthedRequest("DELETE", `/api/b2b/subscription-plans/${planId}`, TENANT_ID),
      ctx
    );
    expect((await delRes.json()).success).toBe(true);

    const getAfter = await getPlan(
      buildAuthedRequest("GET", `/api/b2b/subscription-plans/${planId}`, TENANT_ID),
      ctx
    );
    expect(getAfter.status).toBe(404);
  });
});
