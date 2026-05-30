import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { connectWithModels } from "@/lib/db/connection";
import { NextRequest } from "next/server";

vi.mock("@/lib/services/admin-tenant.service", () => ({
  getTenant: vi.fn(async () => ({ enabled_modules: undefined })),
}));

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

import { GET } from "@/app/api/b2b/me/route";

describe("GET /api/b2b/me", () => {
  beforeAll(async () => { await setupTestDatabase(); }, 30000);
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); });

  it("returns the caller's role, permissions and scope", async () => {
    const { B2BUser, Role } = await connectWithModels("vinc-test");
    await Role.create({
      role_id: "role_agent", name: "Agent", permissions: ["orders.view", "customers.view"],
      scope: { channels: "all", customers: "all", price_lists: "all" },
    });
    await B2BUser.create({
      username: "agent1", email: "agent1@example.com", passwordHash: "x",
      companyName: "Acme", role: "manager", user_id: "sub-123", role_id: "role_agent",
    });

    const req = new NextRequest("http://localhost:3000/api/b2b/me", {
      headers: { authorization: "Bearer faketoken" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.permissions).toContain("orders.view");
    expect(data.data.permissions).toContain("customers.view");
    expect(data.data.scope.channels).toBe("all");
  });

  it("401s when unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3000/api/b2b/me");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
