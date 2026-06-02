import { PERMISSIONS, type PermissionKey } from "./catalog";
import { buildAbility, type AppAbility } from "./ability";
import { scopeConditionsFor, type RoleScope, type ScopeValues } from "./scope";
import type { PriceAccess } from "./price-access";

/**
 * Intersect a role's permissions with the tenant's entitled apps. When
 * `entitledApps` is undefined, no filtering is applied (Phase 0A default —
 * module-app entitlement plumbing arrives in plan 0B).
 */
export function intersectWithEntitlement(
  permissions: PermissionKey[],
  entitledApps: string[] | undefined
): PermissionKey[] {
  if (!entitledApps) return permissions;
  const allowed = new Set(entitledApps);
  return permissions.filter((p) => allowed.has(PERMISSIONS[p].app));
}

export interface AuthorizationContext {
  permissions: Set<PermissionKey>;
  entitledApps: string[] | undefined;
  ability: AppAbility;
  scope: ScopeValues;
  priceAccess: PriceAccess;
  can(permission: PermissionKey): boolean;
}

export interface AssembleInput {
  permissions: PermissionKey[];
  roleScope: RoleScope;
  scopeValues: ScopeValues;
  entitledApps: string[] | undefined;
  priceAccess?: PriceAccess;
}

/**
 * Pure assembler: turn a role's permissions + scope into the authorization
 * context attached to every authenticated request. No DB access.
 */
export function assembleAuthorization(input: AssembleInput): AuthorizationContext {
  const effective = intersectWithEntitlement(input.permissions, input.entitledApps);
  const permissionSet = new Set(effective);
  const conditions = scopeConditionsFor(input.roleScope, input.scopeValues);
  const ability = buildAbility(effective, conditions);

  return {
    permissions: permissionSet,
    entitledApps: input.entitledApps,
    ability,
    scope: input.scopeValues,
    priceAccess: input.priceAccess ?? "none",
    can: (permission: PermissionKey) => permissionSet.has(permission),
  };
}

/** The authorization context for an unauthenticated/non-staff identity: deny all. */
export function emptyAuthorization(): AuthorizationContext {
  return assembleAuthorization({
    permissions: [],
    roleScope: { channels: "all", customers: "all", price_lists: "all" },
    scopeValues: { channels: "all", customers: "all", price_lists: "all" },
    entitledApps: undefined,
  });
}
