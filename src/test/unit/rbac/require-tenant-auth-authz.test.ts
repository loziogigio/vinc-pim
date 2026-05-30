import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { connectWithModels } from "@/lib/db/connection";
import { NextRequest } from "next/server";

// Force the bearer path to resolve to our b2b_user without real JWT/SSO.
vi.mock("@/lib/sso/tokens", () => ({
  validateAccessToken: vi.fn(async () => ({
    sub: "sub-123", email: "agent1@example.com", tenant_id: "test", session_id: "s1",
  })),
}));
vi.mock("@/lib/db/models/sso-session", () => ({
  getSSOSessionModel: vi.fn(async () => ({
    findBySessionId: vi.fn(async () => ({ vinc_profile: { customers: [{ id: "c1" }] } })),
  })),
}));

import { requireTenantAuth } from "@/lib/auth/tenant-auth";

describe("requireTenantAuth surfaces authorization", () => {
  beforeAll(async () => { await setupTestDatabase(); }, 30000);
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); });

  it("attaches can()/permissions resolved from the user's role", async () => {
    const { B2BUser, Role } = await connectWithModels("vinc-test");
    await Role.create({
      role_id: "role_agent", name: "Agent", permissions: ["orders.view"],
      scope: { channels: "all", customers: "all", price_lists: "all" },
    });
    await B2BUser.create({
      username: "agent1", email: "agent1@example.com", passwordHash: "x",
      companyName: "Acme", role: "manager", user_id: "sub-123", role_id: "role_agent",
    });

    const req = new NextRequest("http://localhost:3000/api/b2b/orders", {
      headers: { authorization: "Bearer faketoken" },
    });
    const auth = await requireTenantAuth(req);
    expect(auth.success).toBe(true);
    if (!auth.success) return;
    expect(auth.can("orders.view")).toBe(true);
    expect(auth.can("orders.cancel")).toBe(false);
    expect(auth.permissions.has("orders.view")).toBe(true);
  });

  it("denies by default when the request is unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3000/api/b2b/orders");
    const auth = await requireTenantAuth(req);
    expect(auth.success).toBe(false);
  });
});
