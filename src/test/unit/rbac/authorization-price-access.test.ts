import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
vi.mock("@/lib/services/admin-tenant.service", () => ({ getTenant: vi.fn(async () => ({ enabled_modules: undefined })) }));
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { connectWithModels } from "@/lib/db/connection";
import { authorizationForB2BUser } from "@/lib/auth/authorization";

describe("effective price access", () => {
  beforeAll(async () => { await setupTestDatabase(); }, 30000);
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); });

  async function makeRole(price_access: "none" | "view" | "edit") {
    const { Role } = await connectWithModels("vinc-test");
    return Role.create({ role_id: "role_px", name: "Px", price_access, permissions: ["pim.product.view"], scope: { channels: "all", customers: "all", price_lists: "all" } });
  }

  it("uses the role's price_access when the user has no override", async () => {
    await makeRole("view");
    const authz = await authorizationForB2BUser({ role_id: "role_px" }, "vinc-test", "test");
    expect(authz.priceAccess).toBe("view");
  });
  it("user override wins over the role default", async () => {
    await makeRole("view");
    const authz = await authorizationForB2BUser({ role_id: "role_px", price_access: "edit" } as never, "vinc-test", "test");
    expect(authz.priceAccess).toBe("edit");
  });
  it("defaults to 'none' when no role found and no override", async () => {
    const authz = await authorizationForB2BUser({}, "vinc-test", "test");
    expect(authz.priceAccess).toBe("none");
  });
  it("legacy admin role maps to edit", async () => {
    const authz = await authorizationForB2BUser({ role: "admin" }, "vinc-test", "test");
    expect(authz.priceAccess).toBe("edit");
  });
});
