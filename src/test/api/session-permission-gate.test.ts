import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
vi.mock("@/lib/services/admin-tenant.service", () => ({ getTenant: vi.fn(async () => ({ enabled_modules: undefined })) }));
const sessionRef: { value: Record<string, unknown> | null } = { value: null };
vi.mock("@/lib/auth/b2b-session", () => ({ getB2BSession: vi.fn(async () => sessionRef.value ?? { isLoggedIn: false }) }));
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { connectWithModels } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { __clearAuthzCache } from "@/lib/auth/authorization";
import { NextRequest } from "next/server";

describe("requireTenantAuth resolves permissions for a cookie-session staff user", () => {
  beforeAll(async () => { await setupTestDatabase(); }, 30000);
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); sessionRef.value = null; __clearAuthzCache(); });

  it("grants the role's permissions to a session caller (by _id)", async () => {
    const { B2BUser, Role } = await connectWithModels("vinc-test");
    await Role.create({ role_id: "role_mgr", name: "Mgr", permissions: ["roles.manage", "users.manage"], scope: { channels: "all", customers: "all", price_lists: "all" } });
    const u = await B2BUser.create({ username: "mgr", email: "mgr@example.com", passwordHash: "x", companyName: "Acme", role: "admin", role_id: "role_mgr" });
    sessionRef.value = { isLoggedIn: true, tenantId: "test", userId: u._id.toString(), role: "admin" };

    const auth = await requireTenantAuth(new NextRequest("http://localhost/api/b2b/roles"));
    expect(auth.success).toBe(true);
    if (!auth.success) return;
    expect(auth.can("roles.manage")).toBe(true);
    expect(auth.can("users.manage")).toBe(true);
    expect(auth.can("pim.product.delete")).toBe(false);
  });
});
