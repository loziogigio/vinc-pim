import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
vi.mock("@/lib/services/admin-tenant.service", () => ({ getTenant: vi.fn(async () => ({ enabled_modules: undefined })) }));
const sessionRef: { value: Record<string, unknown> | null } = { value: null };
vi.mock("@/lib/auth/b2b-session", () => ({ getB2BSession: vi.fn(async () => sessionRef.value ?? { isLoggedIn: false }) }));
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { connectWithModels } from "@/lib/db/connection";
import { __clearAuthzCache } from "@/lib/auth/authorization";
import { NextRequest } from "next/server";
import { GET as GET_ONE } from "@/app/api/b2b/users/[id]/route";
import { GET } from "@/app/api/b2b/users/route";
import { PATCH } from "@/app/api/b2b/users/[id]/route";
import { ALL_PERMISSION_KEYS } from "@/lib/auth/permissions/catalog";

type ScopeValues = { channels: "all" | string[]; customers: "all" | string[]; price_lists: "all" | string[] };

async function loginAs(
  perms: string[],
  opts: { priceAccess?: "none" | "view" | "edit"; scopeValues?: ScopeValues } = {}
) {
  const { B2BUser, Role } = await connectWithModels("vinc-test");
  await Role.create({ role_id: "role_actor", name: "Actor", permissions: perms, scope: { channels: "all", customers: "all", price_lists: "all" }, price_access: opts.priceAccess });
  const u = await B2BUser.create({ username: "actor", email: "actor@example.com", passwordHash: "x", companyName: "Acme", role: "admin", role_id: "role_actor", scope_values: opts.scopeValues });
  sessionRef.value = { isLoggedIn: true, tenantId: "test", userId: u._id.toString(), role: "admin" };
  return u;
}
const patch = (id: string, body: Record<string, unknown>) =>
  PATCH(new NextRequest("http://localhost", { method: "PATCH", body: JSON.stringify(body) }), ctx(id));
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
  it("PATCH assigns role_id, scope_values, price_access override, isActive (admin within ceiling)", async () => {
    await loginAs([...ALL_PERMISSION_KEYS], { priceAccess: "edit" });
    const { B2BUser, Role } = await connectWithModels("vinc-test");
    await Role.create({ role_id: "role_target", name: "T", permissions: ["orders.view"], scope: { channels: "per_user", customers: "per_user", price_lists: "all" } });
    const u = await B2BUser.create({ username: "bob", email: "bob@example.com", passwordHash: "x", companyName: "Acme", role: "viewer" });
    const res = await patch(u._id.toString(), { role_id: "role_target", scope_values: { channels: ["ch_1"], customers: ["cust_9"], price_lists: "all" }, price_access: "edit", isActive: false });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.role_id).toBe("role_target");
    expect(body.data.price_access).toBe("edit");
    expect(body.data.isActive).toBe(false);
    expect(body.data.scope_values.channels).toEqual(["ch_1"]);
  });
  it("PATCH rejects an unknown role_id with 400", async () => {
    await loginAs([...ALL_PERMISSION_KEYS]);
    const { B2BUser } = await connectWithModels("vinc-test");
    const u = await B2BUser.create({ username: "carl", email: "carl@example.com", passwordHash: "x", companyName: "Acme", role: "viewer" });
    expect((await patch(u._id.toString(), { role_id: "role_ghost" })).status).toBe(400);
  });

  // --- No-escalation ceiling (priv-esc fix: authz-1 / idor-1 / inputval-1 / authz-2) ---

  it("PATCH 403: a users.manage-only caller cannot assign a role carrying permissions they lack", async () => {
    await loginAs(["users.manage"]);
    const { B2BUser, Role } = await connectWithModels("vinc-test");
    await Role.create({ role_id: "role_powerful", name: "Powerful", permissions: ["orders.view", "roles.manage"], scope: { channels: "all", customers: "all", price_lists: "all" } });
    const bob = await B2BUser.create({ username: "bob", email: "bob@example.com", passwordHash: "x", companyName: "Acme", role: "viewer" });
    expect((await patch(bob._id.toString(), { role_id: "role_powerful" })).status).toBe(403);
  });

  it("PATCH 403: a caller cannot grant price_access above their own level", async () => {
    await loginAs(["users.manage"], { priceAccess: "view" });
    const { B2BUser } = await connectWithModels("vinc-test");
    const bob = await B2BUser.create({ username: "bob", email: "bob@example.com", passwordHash: "x", companyName: "Acme", role: "viewer" });
    expect((await patch(bob._id.toString(), { price_access: "edit" })).status).toBe(403);
  });

  it("PATCH 200: a caller CAN assign a role whose permissions are a subset of their own (delegation still works)", async () => {
    await loginAs(["users.manage", "orders.view"]);
    const { B2BUser, Role } = await connectWithModels("vinc-test");
    await Role.create({ role_id: "role_weak", name: "Weak", permissions: ["orders.view"], scope: { channels: "all", customers: "all", price_lists: "all" } });
    const bob = await B2BUser.create({ username: "bob", email: "bob@example.com", passwordHash: "x", companyName: "Acme", role: "viewer" });
    expect((await patch(bob._id.toString(), { role_id: "role_weak" })).status).toBe(200);
  });

  // --- Self-elevation / self-lockout guards (idor-2) ---

  it("PATCH 403: a caller cannot change their own role_id (even within ceiling)", async () => {
    const actor = await loginAs(["users.manage"]);
    const { Role } = await connectWithModels("vinc-test");
    await Role.create({ role_id: "role_same", name: "Same", permissions: ["users.manage"], scope: { channels: "all", customers: "all", price_lists: "all" } });
    expect((await patch(actor._id.toString(), { role_id: "role_same" })).status).toBe(403);
  });

  it("PATCH 403: a caller cannot change their own price_access", async () => {
    const actor = await loginAs(["users.manage"], { priceAccess: "edit" });
    expect((await patch(actor._id.toString(), { price_access: "view" })).status).toBe(403);
  });

  it("PATCH 403: a caller cannot deactivate themselves", async () => {
    const actor = await loginAs(["users.manage"]);
    expect((await patch(actor._id.toString(), { isActive: false })).status).toBe(403);
  });

  // --- Role-clear ceiling: clearing role_id must not expose a higher legacy role (authz-3) ---

  it("PATCH 403: clearing role_id cannot expose a higher legacy role than the caller holds", async () => {
    await loginAs(["users.manage"]);
    const { B2BUser, Role } = await connectWithModels("vinc-test");
    await Role.create({ role_id: "role_low", name: "Low", permissions: ["orders.view"], scope: { channels: "all", customers: "all", price_lists: "all" } });
    // bob's legacy role is "admin" (full perms); clearing role_id would resolve to it.
    const bob = await B2BUser.create({ username: "bob", email: "bob@example.com", passwordHash: "x", companyName: "Acme", role: "admin", role_id: "role_low" });
    expect((await patch(bob._id.toString(), { role_id: null })).status).toBe(403);
  });

  it("PATCH 200: an admin may clear another user's role_id (legacy fallback within ceiling)", async () => {
    await loginAs([...ALL_PERMISSION_KEYS], { priceAccess: "edit" });
    const { B2BUser, Role } = await connectWithModels("vinc-test");
    await Role.create({ role_id: "role_low", name: "Low", permissions: ["orders.view"], scope: { channels: "all", customers: "all", price_lists: "all" } });
    const bob = await B2BUser.create({ username: "bob", email: "bob@example.com", passwordHash: "x", companyName: "Acme", role: "admin", role_id: "role_low" });
    expect((await patch(bob._id.toString(), { role_id: null })).status).toBe(200);
  });

  // --- Scope ceiling: cannot grant broader scope than the caller's own (authz-4) ---

  it("PATCH 403: a caller cannot grant a broader channel scope than their own", async () => {
    await loginAs(["users.manage"], { scopeValues: { channels: ["ch_1"], customers: "all", price_lists: "all" } });
    const { B2BUser } = await connectWithModels("vinc-test");
    const bob = await B2BUser.create({ username: "bob", email: "bob@example.com", passwordHash: "x", companyName: "Acme", role: "viewer" });
    expect((await patch(bob._id.toString(), { scope_values: { channels: "all", customers: "all", price_lists: "all" } })).status).toBe(403);
  });

  it("PATCH 200: a caller may grant a scope within their own (subset)", async () => {
    await loginAs(["users.manage"], { scopeValues: { channels: ["ch_1", "ch_2"], customers: "all", price_lists: "all" } });
    const { B2BUser } = await connectWithModels("vinc-test");
    const bob = await B2BUser.create({ username: "bob", email: "bob@example.com", passwordHash: "x", companyName: "Acme", role: "viewer" });
    expect((await patch(bob._id.toString(), { scope_values: { channels: ["ch_1"], customers: "all", price_lists: "all" } })).status).toBe(200);
  });

  // --- Last active roles.manage holder lockout guard (idor-2) ---

  it("PATCH 403: cannot deactivate the last active roles.manage holder", async () => {
    await loginAs(["users.manage"]);
    const { B2BUser, Role } = await connectWithModels("vinc-test");
    await Role.create({ role_id: "role_admin", name: "RoleAdmin", permissions: ["roles.manage"], scope: { channels: "all", customers: "all", price_lists: "all" } });
    const bob = await B2BUser.create({ username: "bob", email: "bob@example.com", passwordHash: "x", companyName: "Acme", role: "viewer", role_id: "role_admin" });
    expect((await patch(bob._id.toString(), { isActive: false })).status).toBe(403);
  });

  it("PATCH 200: can deactivate a roles.manage holder when another active one remains", async () => {
    await loginAs(["users.manage"]);
    const { B2BUser, Role } = await connectWithModels("vinc-test");
    await Role.create({ role_id: "role_admin", name: "RoleAdmin", permissions: ["roles.manage"], scope: { channels: "all", customers: "all", price_lists: "all" } });
    const bob = await B2BUser.create({ username: "bob", email: "bob@example.com", passwordHash: "x", companyName: "Acme", role: "viewer", role_id: "role_admin" });
    await B2BUser.create({ username: "carol", email: "carol@example.com", passwordHash: "x", companyName: "Acme", role: "viewer", role_id: "role_admin" });
    expect((await patch(bob._id.toString(), { isActive: false })).status).toBe(200);
  });

  it("PATCH 403: cannot strip roles.manage from the last role-admin via a role change", async () => {
    await loginAs(["users.manage", "orders.view"]);
    const { B2BUser, Role } = await connectWithModels("vinc-test");
    await Role.create({ role_id: "role_admin", name: "RoleAdmin", permissions: ["roles.manage"], scope: { channels: "all", customers: "all", price_lists: "all" } });
    await Role.create({ role_id: "role_low", name: "Low", permissions: ["orders.view"], scope: { channels: "all", customers: "all", price_lists: "all" } });
    const bob = await B2BUser.create({ username: "bob", email: "bob@example.com", passwordHash: "x", companyName: "Acme", role: "viewer", role_id: "role_admin" });
    expect((await patch(bob._id.toString(), { role_id: "role_low" })).status).toBe(403);
  });

  // --- Malformed id robustness (idor-3), both verbs ---

  it("PATCH 404: a malformed (non-ObjectId) user id returns 404, not 500", async () => {
    await loginAs(["users.manage"]);
    expect((await patch("not-a-valid-objectid", { isActive: true })).status).toBe(404);
  });

  it("GET 404: a malformed (non-ObjectId) user id returns 404, not 500", async () => {
    await loginAs(["users.manage"]);
    const res = await GET_ONE(new NextRequest("http://localhost"), ctx("not-a-valid-objectid"));
    expect(res.status).toBe(404);
  });
});
