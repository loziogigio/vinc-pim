import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { connectWithModels } from "@/lib/db/connection";
import { ensureSystemRoles, SYSTEM_ROLE_IDS } from "@/lib/auth/permissions/seed-system-roles";

describe("ensureSystemRoles", () => {
  beforeAll(async () => { await setupTestDatabase(); }, 30000);
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); });

  it("seeds the four system roles with stable ids, locked + priced", async () => {
    await ensureSystemRoles("vinc-test");
    const { Role } = await connectWithModels("vinc-test");
    const roles = await Role.find({ is_system: true }).lean();
    expect(roles).toHaveLength(4);
    const byId = Object.fromEntries(roles.map((r) => [r.role_id, r]));
    expect(byId[SYSTEM_ROLE_IDS.admin].price_access).toBe("edit");
    expect(byId[SYSTEM_ROLE_IDS.viewer].price_access).toBe("view");
    expect(byId[SYSTEM_ROLE_IDS.admin].is_system).toBe(true);
    expect(byId[SYSTEM_ROLE_IDS.admin].permissions.length).toBeGreaterThan(0);
  });
  it("is idempotent — running twice does not duplicate", async () => {
    await ensureSystemRoles("vinc-test");
    await ensureSystemRoles("vinc-test");
    const { Role } = await connectWithModels("vinc-test");
    expect(await Role.countDocuments({ is_system: true })).toBe(4);
  });
  it("restores an edited system role back to preset state", async () => {
    await ensureSystemRoles("vinc-test");
    const { Role } = await connectWithModels("vinc-test");
    await Role.updateOne({ role_id: SYSTEM_ROLE_IDS.viewer }, { $set: { permissions: [], price_access: "none", name: "Hacked" } });
    await ensureSystemRoles("vinc-test");
    const restored = await Role.findOne({ role_id: SYSTEM_ROLE_IDS.viewer }).lean();
    expect(restored?.name).toBe("Viewer");
    expect(restored?.price_access).toBe("view");
    expect(restored?.permissions.length).toBeGreaterThan(0);
  });
  it("does not touch custom (non-system) roles", async () => {
    const { Role } = await connectWithModels("vinc-test");
    await Role.create({ role_id: "role_custom", name: "Custom", permissions: ["orders.view"], scope: { channels: "all", customers: "all", price_lists: "all" } });
    await ensureSystemRoles("vinc-test");
    const custom = await Role.findOne({ role_id: "role_custom" }).lean();
    expect(custom?.name).toBe("Custom");
    expect(await Role.countDocuments()).toBe(5);
  });
});
