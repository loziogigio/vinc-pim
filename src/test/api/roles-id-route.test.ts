import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
vi.mock("@/lib/services/admin-tenant.service", () => ({ getTenant: vi.fn(async () => ({ enabled_modules: undefined })) }));
const sessionRef: { value: Record<string, unknown> | null } = { value: null };
vi.mock("@/lib/auth/b2b-session", () => ({ getB2BSession: vi.fn(async () => sessionRef.value ?? { isLoggedIn: false }) }));
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { connectWithModels } from "@/lib/db/connection";
import { __clearAuthzCache } from "@/lib/auth/authorization";
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "@/app/api/b2b/roles/[id]/route";
import { POST as RESTORE } from "@/app/api/b2b/roles/restore-system/route";
import { ensureSystemRoles, SYSTEM_ROLE_IDS } from "@/lib/auth/permissions/seed-system-roles";

async function loginAs(perms: string[]) {
  const { B2BUser, Role } = await connectWithModels("vinc-test");
  await Role.create({ role_id: "role_actor", name: "Actor", permissions: perms, scope: { channels: "all", customers: "all", price_lists: "all" } });
  const u = await B2BUser.create({ username: "actor", email: "actor@example.com", passwordHash: "x", companyName: "Acme", role: "admin", role_id: "role_actor" });
  sessionRef.value = { isLoggedIn: true, tenantId: "test", userId: u._id.toString(), role: "admin" };
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("/api/b2b/roles/[id]", () => {
  beforeAll(async () => { await setupTestDatabase(); }, 30000);
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); sessionRef.value = null; __clearAuthzCache(); });

  it("PATCH updates a custom role", async () => {
    await loginAs(["roles.manage"]);
    const { Role } = await connectWithModels("vinc-test");
    const r = await Role.create({ role_id: "role_c", name: "C", permissions: [], scope: { channels: "all", customers: "all", price_lists: "all" } });
    const res = await PATCH(new NextRequest("http://localhost", { method: "PATCH", body: JSON.stringify({ name: "C2", price_access: "edit" }) }), ctx(r.role_id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("C2");
    expect(body.data.price_access).toBe("edit");
  });
  it("PATCH on a system role is 403", async () => {
    await loginAs(["roles.manage"]); await ensureSystemRoles("vinc-test");
    expect((await PATCH(new NextRequest("http://localhost", { method: "PATCH", body: JSON.stringify({ name: "X" }) }), ctx(SYSTEM_ROLE_IDS.admin))).status).toBe(403);
  });
  it("DELETE soft-deletes a custom role with no users", async () => {
    await loginAs(["roles.manage"]);
    const { Role } = await connectWithModels("vinc-test");
    const r = await Role.create({ role_id: "role_d", name: "D", permissions: [], scope: { channels: "all", customers: "all", price_lists: "all" } });
    expect((await DELETE(new NextRequest("http://localhost", { method: "DELETE" }), ctx(r.role_id))).status).toBe(200);
    expect((await Role.findOne({ role_id: "role_d" }).lean())?.is_active).toBe(false);
  });
  it("DELETE is 409 when users still reference the role", async () => {
    await loginAs(["roles.manage"]);
    const { Role, B2BUser } = await connectWithModels("vinc-test");
    const r = await Role.create({ role_id: "role_used", name: "Used", permissions: [], scope: { channels: "all", customers: "all", price_lists: "all" } });
    await B2BUser.create({ username: "member", email: "m@example.com", passwordHash: "x", companyName: "Acme", role: "viewer", role_id: "role_used" });
    expect((await DELETE(new NextRequest("http://localhost", { method: "DELETE" }), ctx(r.role_id))).status).toBe(409);
  });
  it("DELETE on a system role is 403", async () => {
    await loginAs(["roles.manage"]); await ensureSystemRoles("vinc-test");
    expect((await DELETE(new NextRequest("http://localhost", { method: "DELETE" }), ctx(SYSTEM_ROLE_IDS.viewer))).status).toBe(403);
  });
  it("restore-system recreates a deleted system role", async () => {
    await loginAs(["roles.manage"]); await ensureSystemRoles("vinc-test");
    const { Role } = await connectWithModels("vinc-test");
    await Role.deleteOne({ role_id: SYSTEM_ROLE_IDS.viewer });
    expect((await RESTORE(new NextRequest("http://localhost", { method: "POST" }))).status).toBe(200);
    expect(await Role.countDocuments({ is_system: true })).toBe(4);
  });
});
