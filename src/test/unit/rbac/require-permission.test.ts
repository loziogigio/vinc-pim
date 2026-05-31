import { describe, it, expect } from "vitest";
import { requirePermission, requireAnyPermission } from "@/lib/api/require-permission";
import type { AuthSuccess } from "@/lib/auth/tenant-auth";
import type { PermissionKey } from "@/lib/auth/permissions/catalog";

function authWith(perms: string[]): AuthSuccess {
  const set = new Set(perms as PermissionKey[]);
  return {
    success: true, tenantId: "test", tenantDb: "vinc-test", userId: "u1", authMethod: "session",
    permissions: set, entitledApps: [], scope: { channels: "all", customers: "all", price_lists: "all" }, priceAccess: "none",
    can: (p: PermissionKey) => set.has(p),
  } as unknown as AuthSuccess;
}

describe("requirePermission", () => {
  it("returns null when the permission is granted", () => {
    expect(requirePermission(authWith(["roles.manage"]), "roles.manage")).toBeNull();
  });
  it("returns a 403 response when the permission is missing", async () => {
    const res = requirePermission(authWith(["users.manage"]), "roles.manage");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toMatch(/forbidden|permission/i);
  });
  it("requireAnyPermission allows when any is present", () => {
    expect(requireAnyPermission(authWith(["users.manage"]), ["roles.manage", "users.manage"])).toBeNull();
  });
  it("requireAnyPermission 403s when none present", () => {
    expect(requireAnyPermission(authWith(["pim.product.view"]), ["roles.manage", "users.manage"])!.status).toBe(403);
  });
});
