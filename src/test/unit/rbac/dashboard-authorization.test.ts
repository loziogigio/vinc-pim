import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { connectWithModels } from "@/lib/db/connection";

vi.mock("@/lib/services/admin-tenant.service", () => ({
  getTenant: vi.fn(async () => ({ enabled_modules: undefined })),
}));
const sessionRef: { value: Record<string, unknown> | null } = { value: null };
vi.mock("@/lib/auth/b2b-session", () => ({
  getB2BSession: vi.fn(async () => sessionRef.value ?? { isLoggedIn: false }),
}));

import { getDashboardAuthorization } from "@/lib/auth/dashboard-authorization";

describe("getDashboardAuthorization", () => {
  beforeAll(async () => { await setupTestDatabase(); }, 30000);
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); sessionRef.value = null; });

  it("returns a deny-all DTO when not logged in", async () => {
    sessionRef.value = { isLoggedIn: false };
    const dto = await getDashboardAuthorization();
    expect(dto.permissions).toEqual([]);
    expect(dto.entitledApps).toEqual([]);
  });

  it("resolves permissions for the logged-in session user (by _id)", async () => {
    const { B2BUser, Role } = await connectWithModels("vinc-test");
    await Role.create({
      role_id: "role_dash", name: "Dash", permissions: ["orders.view", "pim.product.view"],
      scope: { channels: "all", customers: "all", price_lists: "all" },
    });
    const u = await B2BUser.create({
      username: "dash", email: "dash@example.com", passwordHash: "x",
      companyName: "Acme", role: "viewer", role_id: "role_dash",
    });
    sessionRef.value = { isLoggedIn: true, tenantId: "test", userId: u._id.toString(), role: "viewer" };

    const dto = await getDashboardAuthorization();
    expect(dto.permissions).toContain("orders.view");
    expect(dto.permissions).toContain("pim.product.view");
    expect(dto.scope.channels).toBe("all");
  });
});
