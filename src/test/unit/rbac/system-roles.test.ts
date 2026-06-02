import { describe, it, expect } from "vitest";
import { SYSTEM_ROLE_KEYS, SYSTEM_ROLE_PRESETS } from "@/lib/auth/permissions/system-roles";
import { isPermissionKey, ALL_PERMISSION_KEYS } from "@/lib/auth/permissions/catalog";

describe("system role presets", () => {
  it("defines admin/helpdesk/agent/viewer", () => {
    expect(SYSTEM_ROLE_KEYS).toEqual(["admin", "helpdesk", "agent", "viewer"]);
  });

  it("only references valid permission keys", () => {
    for (const key of SYSTEM_ROLE_KEYS) {
      for (const perm of SYSTEM_ROLE_PRESETS[key].permissions) {
        expect(isPermissionKey(perm), `${key} -> ${perm}`).toBe(true);
      }
    }
  });

  it("admin grants every permission (superset of the others)", () => {
    const admin = new Set(SYSTEM_ROLE_PRESETS.admin.permissions);
    expect(admin.size).toBe(ALL_PERMISSION_KEYS.length);
    for (const key of SYSTEM_ROLE_KEYS) {
      for (const perm of SYSTEM_ROLE_PRESETS[key].permissions) {
        expect(admin.has(perm)).toBe(true);
      }
    }
  });

  it("agent is channel-scoped; viewer is read-only on every dimension 'all'", () => {
    expect(SYSTEM_ROLE_PRESETS.agent.scope.channels).toBe("per_user");
    expect(SYSTEM_ROLE_PRESETS.viewer.scope).toEqual({
      channels: "all", customers: "all", price_lists: "all",
    });
  });
});
