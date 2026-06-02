import { APP_IDS, isAppId, type AppId } from "./app-ids";

/** Apps a tenant can always reach regardless of entitlement (the dashboard shell). */
export const ALWAYS_ENTITLED: AppId[] = ["home"];

/**
 * Resolve which module apps a tenant is entitled to.
 * - undefined/non-array ⇒ ALL app ids (back-compat for tenants without config)
 * - []                  ⇒ only ALWAYS_ENTITLED
 * - otherwise           ⇒ configured ids (invalid dropped) ∪ ALWAYS_ENTITLED
 */
export function resolveEntitledModules(enabled_modules?: string[]): AppId[] {
  if (!Array.isArray(enabled_modules)) return [...APP_IDS];
  const configured = enabled_modules.filter(isAppId);
  return Array.from(new Set<AppId>([...ALWAYS_ENTITLED, ...configured]));
}
