import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
vi.mock("@/lib/services/admin-tenant.service", () => ({ getTenant: vi.fn(async () => ({ enabled_modules: undefined })) }));
const sessionRef: { value: Record<string, unknown> | null } = { value: null };
vi.mock("@/lib/auth/b2b-session", () => ({ getB2BSession: vi.fn(async () => sessionRef.value ?? { isLoggedIn: false }) }));
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { connectWithModels } from "@/lib/db/connection";
import { __clearAuthzCache } from "@/lib/auth/authorization";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/b2b/users/route";
import { PATCH } from "@/app/api/b2b/users/[id]/route";

async function loginAs(perms: string[]) {
  const { B2BUser, Role } = await connectWithModels("vinc-test");
  await Role.create({ role_id: "role_actor", name: "Actor", permissions: perms, scope: { channels: "all", customers: "all", price_lists: "all" } });
  const u = await B2BUser.create({ username: "actor", email: "actor@example.com", passwordHash: "x", companyName: "Acme", role: "admin", role_id: "role_actor" });
  sessionRef.value = { isLoggedIn: true, tenantId: "test", userId: u._id.toString(), role: "admin" };
  return u;
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("/api/b2b/users", () => {
  beforeAll(async () => { await setupTestDatabase(); }, 30000);
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); sessionRef.value = null; __clearAuthzCache(); });

  it("GET lists staff paginated (users.manage), no password hash leaked", async () => {
    await loginAs(["users.manage"]);
    const { B2BUser } = await connectWithModels("vinc-test");
    await B2BUser.create({ username: "alice", email: "alice@example.com", passwordHash: "x", companyName: "Acme", role: "viewer" });
    const res = await GET(new NextRequest("http://localhost/api/b2b/users?limit=10"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(body.data.pagination).toMatchObject({ page: 1, limit: 10 });
    expect(body.data.items[0].passwordHash).toBeUndefined();
  });
  it("GET supports search", async () => {
    await loginAs(["users.manage"]);
    const { B2BUser } = await connectWithModels("vinc-test");
    await B2BUser.create({ username: "zoe", email: "zoe@example.com", passwordHash: "x", companyName: "Zeta", role: "viewer" });
    const res = await GET(new NextRequest("http://localhost/api/b2b/users?search=zoe"));
    const body = await res.json();
    expect(body.data.items.some((u: { username: string }) => u.username === "zoe")).toBe(true);
  });
  it("GET is 403 without users.manage", async () => {
    await loginAs(["roles.manage"]);
    expect((await GET(new NextRequest("http://localhost/api/b2b/users"))).status).toBe(403);
  });
  it("PATCH assigns role_id, scope_values, price_access override, isActive", async () => {
    await loginAs(["users.manage"]);
    const { B2BUser, Role } = await connectWithModels("vinc-test");
    await Role.create({ role_id: "role_target", name: "T", permissions: ["orders.view"], scope: { channels: "per_user", customers: "per_user", price_lists: "all" } });
    const u = await B2BUser.create({ username: "bob", email: "bob@example.com", passwordHash: "x", companyName: "Acme", role: "viewer" });
    const res = await PATCH(new NextRequest("http://localhost", { method: "PATCH", body: JSON.stringify({ role_id: "role_target", scope_values: { channels: ["ch_1"], customers: ["cust_9"], price_lists: "all" }, price_access: "edit", isActive: false }) }), ctx(u._id.toString()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.role_id).toBe("role_target");
    expect(body.data.price_access).toBe("edit");
    expect(body.data.isActive).toBe(false);
    expect(body.data.scope_values.channels).toEqual(["ch_1"]);
  });
  it("PATCH rejects an unknown role_id with 400", async () => {
    await loginAs(["users.manage"]);
    const { B2BUser } = await connectWithModels("vinc-test");
    const u = await B2BUser.create({ username: "carl", email: "carl@example.com", passwordHash: "x", companyName: "Acme", role: "viewer" });
    expect((await PATCH(new NextRequest("http://localhost", { method: "PATCH", body: JSON.stringify({ role_id: "role_ghost" }) }), ctx(u._id.toString()))).status).toBe(400);
  });
});
