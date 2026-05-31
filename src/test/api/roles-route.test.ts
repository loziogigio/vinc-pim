import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
vi.mock("@/lib/services/admin-tenant.service", () => ({ getTenant: vi.fn(async () => ({ enabled_modules: undefined })) }));
const sessionRef: { value: Record<string, unknown> | null } = { value: null };
vi.mock("@/lib/auth/b2b-session", () => ({ getB2BSession: vi.fn(async () => sessionRef.value ?? { isLoggedIn: false }) }));
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { connectWithModels } from "@/lib/db/connection";
import { __clearAuthzCache } from "@/lib/auth/authorization";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/b2b/roles/route";

async function loginAs(perms: string[]) {
  const { B2BUser, Role } = await connectWithModels("vinc-test");
  await Role.create({ role_id: "role_actor", name: "Actor", permissions: perms, scope: { channels: "all", customers: "all", price_lists: "all" } });
  const u = await B2BUser.create({ username: "actor", email: "actor@example.com", passwordHash: "x", companyName: "Acme", role: "admin", role_id: "role_actor" });
  sessionRef.value = { isLoggedIn: true, tenantId: "test", userId: u._id.toString(), role: "admin" };
}

describe("/api/b2b/roles", () => {
  beforeAll(async () => { await setupTestDatabase(); }, 30000);
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); sessionRef.value = null; __clearAuthzCache(); });

  it("GET ensures + returns the 4 system roles (plus the actor's role)", async () => {
    await loginAs(["roles.manage"]);
    const res = await GET(new NextRequest("http://localhost/api/b2b/roles"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.filter((r: { is_system: boolean }) => r.is_system)).toHaveLength(4);
  });
  it("GET is allowed with only users.manage (user editor needs the role list)", async () => {
    await loginAs(["users.manage"]);
    expect((await GET(new NextRequest("http://localhost/api/b2b/roles"))).status).toBe(200);
  });
  it("GET is 403 without roles.manage or users.manage", async () => {
    await loginAs(["pim.product.view"]);
    expect((await GET(new NextRequest("http://localhost/api/b2b/roles"))).status).toBe(403);
  });
  it("POST creates a custom role (roles.manage)", async () => {
    await loginAs(["roles.manage"]);
    const res = await POST(new NextRequest("http://localhost/api/b2b/roles", { method: "POST", body: JSON.stringify({ name: "Sales", description: "x", permissions: ["orders.view"], scope: { channels: "per_user", customers: "all", price_lists: "all" }, price_access: "view" }) }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.is_system).toBe(false);
    expect(body.data.price_access).toBe("view");
    expect(body.data.role_id).toBeTruthy();
  });
  it("POST drops invalid permission keys and rejects empty name", async () => {
    await loginAs(["roles.manage"]);
    expect((await POST(new NextRequest("http://localhost/api/b2b/roles", { method: "POST", body: JSON.stringify({ name: "" }) }))).status).toBe(400);
    const ok = await POST(new NextRequest("http://localhost/api/b2b/roles", { method: "POST", body: JSON.stringify({ name: "Mixed", permissions: ["orders.view", "not.real"] }) }));
    expect((await ok.json()).data.permissions).toEqual(["orders.view"]);
  });
  it("POST is 403 with only users.manage", async () => {
    await loginAs(["users.manage"]);
    expect((await POST(new NextRequest("http://localhost/api/b2b/roles", { method: "POST", body: JSON.stringify({ name: "X" }) }))).status).toBe(403);
  });
});
