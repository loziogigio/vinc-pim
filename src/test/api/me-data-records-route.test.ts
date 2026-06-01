import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/services/admin-tenant.service", () => ({
  getTenant: vi.fn(async () => ({ enabled_modules: undefined })),
}));

// Bearer auth path. The SSO session's customers decide userType:
//   customers present  -> userType "b2b_user"  (a real storefront customer)
//   customers empty    -> userType "portal_user" (NOT a customer)
const ssoRef: { customers: unknown[]; throws: boolean } = { customers: [{ id: "c1" }], throws: false };
vi.mock("@/lib/sso/tokens", () => ({
  validateAccessToken: vi.fn(async () => ({
    sub: "cust-sub-1", email: "shopper@example.com", tenant_id: "test", session_id: "s1",
  })),
}));
vi.mock("@/lib/db/models/sso-session", () => ({
  getSSOSessionModel: vi.fn(async () => ({
    findBySessionId: vi.fn(async () => {
      if (ssoRef.throws) throw new Error("simulated SSO session store outage");
      return { vinc_profile: { customers: ssoRef.customers } };
    }),
  })),
}));

// Dashboard cookie (staff) auth path — userType "b2b_user", authMethod "session".
const sessionRef: { value: Record<string, unknown> | null } = { value: null };
vi.mock("@/lib/auth/b2b-session", () => ({
  getB2BSession: vi.fn(async () => sessionRef.value ?? { isLoggedIn: false }),
}));

import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { connectWithModels } from "@/lib/db/connection";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/b2b/me/data/[slug]/records/route";
import { GET as GET_ONE } from "@/app/api/b2b/me/data/[slug]/records/[id]/route";

const listCtx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const oneCtx = (slug: string, id: string) => ({ params: Promise.resolve({ slug, id }) });
const bearer = (slug: string) =>
  new NextRequest(`http://localhost/api/b2b/me/data/${slug}/records`, { headers: { authorization: "Bearer faketoken" } });

async function createCustomerModel() {
  const { DataModelDefinition } = await connectWithModels("vinc-test");
  await DataModelDefinition.create({
    name: "Invoices", slug: "invoices", relation: "customer", cardinality: "multiple",
    channel: "*", readable_by_end_user: true, enabled: true, fields: [],
  });
}

describe("GET /api/b2b/me/data/[slug]/records — relation gate (flip-1)", () => {
  beforeAll(async () => { await setupTestDatabase(); }, 30000);
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); sessionRef.value = null; ssoRef.customers = [{ id: "c1" }]; ssoRef.throws = false; });

  it("allows a real SSO customer (Bearer, userType b2b_user) on a customer-keyed model", async () => {
    await createCustomerModel();
    expect((await GET(bearer("invoices"), listCtx("invoices"))).status).toBe(200);
  });

  it("rejects a dashboard-session staff user (authMethod=session) on a customer-keyed model", async () => {
    await createCustomerModel();
    sessionRef.value = { isLoggedIn: true, tenantId: "test", userId: "6a1cf2de4a6ed850259ab279" };
    const req = new NextRequest("http://localhost/api/b2b/me/data/invoices/records");
    expect((await GET(req, listCtx("invoices"))).status).toBe(403);
  });

  it("rejects a portal_user Bearer token (no SSO customers) on a customer-keyed model", async () => {
    await createCustomerModel();
    ssoRef.customers = []; // SSO session without customers -> userType "portal_user"
    expect((await GET(bearer("invoices"), listCtx("invoices"))).status).toBe(403);
  });

  it("rejects a Bearer token when the SSO session lookup THROWS (fail-closed to portal_user)", async () => {
    await createCustomerModel();
    ssoRef.throws = true; // simulated SSO-store outage: cannot verify customer membership
    expect((await GET(bearer("invoices"), listCtx("invoices"))).status).toBe(403);
  });

  it("[id] route also rejects a dashboard-session staff user on a customer-keyed model", async () => {
    await createCustomerModel();
    sessionRef.value = { isLoggedIn: true, tenantId: "test", userId: "6a1cf2de4a6ed850259ab279" };
    // Use a valid ObjectId so the request reaches the relation gate (the [id]
    // route 400s on a malformed id before that check).
    const recId = "6a1cf2de4a6ed850259ab280";
    const req = new NextRequest(`http://localhost/api/b2b/me/data/invoices/records/${recId}`);
    expect((await GET_ONE(req, oneCtx("invoices", recId))).status).toBe(403);
  });
});
