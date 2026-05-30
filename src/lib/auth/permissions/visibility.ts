import { permissionsForApp, type PermissionKey } from "./catalog";
import { isAppId } from "@/config/app-ids";

export type AppVisibility = "usable" | "hidden" | "cta";

/**
 * Classify one app for the current user:
 * - not entitled (tenant lacks it)                     ⇒ "cta" (upsell)
 * - entitled, app has catalog permissions, user has ≥1 ⇒ "usable"
 * - entitled, app has catalog permissions, user has 0  ⇒ "hidden"
 * - entitled, app has NO catalog permissions           ⇒ "usable" (entitlement-only; non-breaking)
 */
export function appVisibility(
  appId: string,
  entitledApps: string[],
  permissions: Set<PermissionKey>
): AppVisibility {
  if (!entitledApps.includes(appId)) return "cta";
  if (!isAppId(appId)) return "usable"; // unknown id: don't gate
  const perms = permissionsForApp(appId);
  if (perms.length === 0) return "usable"; // not yet cataloged → entitlement-only
  return perms.some((p) => permissions.has(p)) ? "usable" : "hidden";
}

export interface VisibleApp<T extends { id: string }> {
  app: T;
  state: AppVisibility;
}

/** Tag a list of apps with their visibility state for the current user. */
export function getVisibleApps<T extends { id: string }>(
  apps: T[],
  entitledApps: string[],
  permissions: Set<PermissionKey>
): VisibleApp<T>[] {
  return apps.map((app) => ({ app, state: appVisibility(app.id, entitledApps, permissions) }));
}
