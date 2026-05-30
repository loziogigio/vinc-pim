/**
 * DB-backed authorization resolution for an authenticated request.
 * Loads the user's role + per-user scope, intersects with tenant entitlement
 * (Phase 0A: no entitlement filter yet — entitledApps stays undefined), and
 * assembles the AuthorizationContext. Never throws: any failure → deny-all.
 */
import type { TenantAuthResult } from "./tenant-auth";
import {
  assembleAuthorization,
  emptyAuthorization,
  type AuthorizationContext,
} from "./permissions/resolve";
import { isPermissionKey, type PermissionKey } from "./permissions/catalog";
import { SYSTEM_ROLE_PRESETS, type SystemRoleKey } from "./permissions/system-roles";
import { ALL_SCOPE, type RoleScope, type ScopeValues } from "./permissions/scope";
import { resolveEntitledModules } from "@/config/module-entitlement";

interface CacheEntry {
  authz: AuthorizationContext;
  expires: number;
}
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

const ALL_ROLE_SCOPE: RoleScope = { channels: "all", customers: "all", price_lists: "all" };

/** Maps legacy B2BUser.role (admin|manager|viewer) onto a system-role preset. */
const LEGACY_ROLE_MAP: Record<string, SystemRoleKey> = {
  admin: "admin",
  manager: "agent",
  viewer: "viewer",
};

/** Test helper — reset the in-memory cache between tests. */
export function __clearAuthzCache(): void {
  cache.clear();
}

/** Best-effort tenant entitlement read. Defaults to "all" (undefined) on any
 *  failure so an admin-DB blip never locks a user out of every app. */
async function readEntitledApps(tenantId: string): Promise<string[]> {
  try {
    const { getTenant } = await import("@/lib/services/admin-tenant.service");
    const tenant = await getTenant(tenantId);
    return resolveEntitledModules(tenant?.enabled_modules);
  } catch {
    return resolveEntitledModules(undefined); // all
  }
}

export async function resolveAuthorization(
  auth: TenantAuthResult
): Promise<AuthorizationContext> {
  // Only internal staff (b2b_user) carry RBAC roles in Phase 0A.
  if (auth.userType !== "b2b_user" || !auth.userId || !auth.tenantDb) {
    return emptyAuthorization();
  }

  const cacheKey = `${auth.tenantDb}:${auth.userId}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.authz;
  }

  let authz: AuthorizationContext;
  try {
    const { connectWithModels } = await import("@/lib/db/connection");
    const { B2BUser, Role } = await connectWithModels(auth.tenantDb);

    // isActive filter: a staff user deactivated after token issuance resolves
    // to no user → deny-all (fail-closed), without waiting for the token to expire.
    const user = await B2BUser.findOne({
      isActive: true,
      $or: [{ user_id: auth.userId }, { username: auth.userId }],
    }).lean<{ role_id?: string; role?: string; scope_values?: ScopeValues } | null>();

    if (!user) {
      authz = emptyAuthorization();
    } else {
      let permissions: PermissionKey[] = [];
      let roleScope: RoleScope = ALL_ROLE_SCOPE;

      if (user.role_id) {
        const role = await Role.findOne({ role_id: user.role_id, is_active: true })
          .lean<{ permissions: string[]; scope: RoleScope } | null>();
        if (role) {
          permissions = role.permissions.filter(isPermissionKey);
          roleScope = role.scope;
        }
      } else if (user.role && LEGACY_ROLE_MAP[user.role]) {
        const presetKey = LEGACY_ROLE_MAP[user.role];
        permissions = [...SYSTEM_ROLE_PRESETS[presetKey].permissions];
        roleScope = SYSTEM_ROLE_PRESETS[presetKey].scope;
      }

      const scopeValues: ScopeValues = user.scope_values ?? ALL_SCOPE;
      const entitledApps = await readEntitledApps(auth.tenantId!);

      authz = assembleAuthorization({
        permissions,
        roleScope,
        scopeValues,
        entitledApps,
      });
    }
  } catch (err) {
    console.warn("[resolveAuthorization] failed, denying:", err);
    authz = emptyAuthorization();
  }

  cache.set(cacheKey, { authz, expires: Date.now() + CACHE_TTL_MS });
  return authz;
}
