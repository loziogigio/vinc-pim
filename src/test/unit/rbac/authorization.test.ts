import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
vi.mock("@/lib/services/admin-tenant.service", () => ({
  getTenant: vi.fn(async () => ({ enabled_modules: undefined })), // default: all entitled
}));
import { getTenant } from "@/lib/services/admin-tenant.service";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { connectWithModels } from "@/lib/db/connection";
import { resolveAuthorization, __clearAuthzCache } from "@/lib/auth/authorization";

describe("resolveAuthorization", () => {
  beforeAll(async () => { await setupTestDatabase(); }, 30000);
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); __clearAuthzCache(); });

  it("returns empty (deny-all) for non-b2b_user identities", async () => {
    const authz = await resolveAuthorization({
      authenticated: true,
      tenantId: "test",
      tenantDb: "vinc-test",
      userId: "u1",
      userType: "portal_user",
      authMethod: "session",
    });
    expect(authz.can("pim.product.view")).toBe(false);
    expect(authz.permissions.size).toBe(0);
  });

  it("resolves permissions from the user's role_id", async () => {
    const { B2BUser, Role } = await connectWithModels("vinc-test");
    await Role.create({
      role_id: "role_agent",
      name: "Agent",
      permissions: ["orders.view", "customers.edit"],
      scope: { channels: "per_user", customers: "all", price_lists: "all" },
    });
    await B2BUser.create({
      username: "agent1", email: "agent1@example.com", passwordHash: "x",
      companyName: "Acme", role: "manager", user_id: "sub-123",
      role_id: "role_agent",
      scope_values: { channels: ["retail"], customers: "all", price_lists: "all" },
    });

    const authz = await resolveAuthorization({
      authenticated: true, tenantId: "test", tenantDb: "vinc-test",
      userId: "sub-123", userType: "b2b_user", authMethod: "bearer",
    });
    expect(authz.can("orders.view")).toBe(true);
    expect(authz.can("customers.edit")).toBe(true);
    expect(authz.can("orders.cancel")).toBe(false);
  });

  it("falls back to legacy role mapping when role_id is absent (admin)", async () => {
    const { B2BUser } = await connectWithModels("vinc-test");
    await B2BUser.create({
      username: "boss", email: "boss@example.com", passwordHash: "x",
      companyName: "Acme", role: "admin", user_id: "sub-admin",
    });
    const authz = await resolveAuthorization({
      authenticated: true, tenantId: "test", tenantDb: "vinc-test",
      userId: "sub-admin", userType: "b2b_user", authMethod: "bearer",
    });
    // legacy "admin" maps to the admin system preset → full access
    expect(authz.can("roles.manage")).toBe(true);
  });

  it("maps legacy 'manager' role to the agent preset", async () => {
    const { B2BUser } = await connectWithModels("vinc-test");
    await B2BUser.create({
      username: "mgr", email: "mgr@example.com", passwordHash: "x",
      companyName: "Acme", role: "manager", user_id: "sub-mgr",
    });
    const authz = await resolveAuthorization({
      authenticated: true, tenantId: "test", tenantDb: "vinc-test",
      userId: "sub-mgr", userType: "b2b_user", authMethod: "bearer",
    });
    expect(authz.can("orders.confirm")).toBe(true);  // agent preset has it
    expect(authz.can("roles.manage")).toBe(false);    // agent preset does not
  });

  it("returns empty when no B2BUser is found (fail-closed)", async () => {
    const authz = await resolveAuthorization({
      authenticated: true, tenantId: "test", tenantDb: "vinc-test",
      userId: "ghost", userType: "b2b_user", authMethod: "bearer",
    });
    expect(authz.permissions.size).toBe(0);
  });

  it("denies a deactivated B2BUser (fail-closed)", async () => {
    const { B2BUser, Role } = await connectWithModels("vinc-test");
    await Role.create({
      role_id: "role_x", name: "X", permissions: ["orders.view"],
      scope: { channels: "all", customers: "all", price_lists: "all" },
    });
    await B2BUser.create({
      username: "gone", email: "gone@example.com", passwordHash: "x",
      companyName: "Acme", role: "admin", user_id: "sub-gone",
      role_id: "role_x", isActive: false,
    });
    const authz = await resolveAuthorization({
      authenticated: true, tenantId: "test", tenantDb: "vinc-test",
      userId: "sub-gone", userType: "b2b_user", authMethod: "bearer",
    });
    expect(authz.permissions.size).toBe(0);
  });

  it("intersects role permissions with tenant module entitlement", async () => {
    const { B2BUser, Role } = await connectWithModels("vinc-test");
    await Role.create({
      role_id: "role_multi", name: "Multi",
      permissions: ["pim.product.view", "orders.view"],
      scope: { channels: "all", customers: "all", price_lists: "all" },
    });
    await B2BUser.create({
      username: "usr", email: "usr@example.com", passwordHash: "x",
      companyName: "Acme", role: "admin", user_id: "sub-ent", role_id: "role_multi",
    });
    // tenant entitled to PIM only (not store-orders) for THIS call
    (getTenant as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ enabled_modules: ["pim"] });

    const authz = await resolveAuthorization({
      authenticated: true, tenantId: "test", tenantDb: "vinc-test",
      userId: "sub-ent", userType: "b2b_user", authMethod: "bearer",
    });
    expect(authz.can("pim.product.view")).toBe(true);
    expect(authz.can("orders.view")).toBe(false); // store-orders not entitled
    expect(authz.entitledApps).toContain("pim");
  });
});
