import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  ALL_PERMISSION_KEYS,
  permissionsForApp,
  type PermissionKey,
} from "@/lib/auth/permissions/catalog";
import { isAppId } from "@/config/app-ids";

describe("permission catalog", () => {
  it("every entry maps to a real app id and a non-empty action/subject", () => {
    for (const [key, def] of Object.entries(PERMISSIONS)) {
      expect(isAppId(def.app), `${key}.app=${def.app}`).toBe(true);
      expect(def.action.length).toBeGreaterThan(0);
      expect(def.subject.length).toBeGreaterThan(0);
    }
  });

  it("ALL_PERMISSION_KEYS matches the catalog keys", () => {
    expect(ALL_PERMISSION_KEYS.sort()).toEqual(
      (Object.keys(PERMISSIONS) as PermissionKey[]).sort()
    );
  });

  it("permissionsForApp filters by app id", () => {
    const pim = permissionsForApp("pim");
    expect(pim).toContain("pim.product.view");
    expect(pim).not.toContain("orders.cancel");
  });
});
