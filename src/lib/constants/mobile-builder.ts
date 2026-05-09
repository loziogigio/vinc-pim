/**
 * Mobile Builder constants and small pure helpers.
 *
 * Types live in `@/lib/types/mobile-builder` and are imported directly by consumers.
 * This module owns: UI label keys, API URL constants, and the `config_id` parser/guard.
 */

import { MOBILE_CONFIG_IDS, type MobileConfigId } from "@/lib/types/mobile-builder";

export const MOBILE_HOME_CONFIG_ID: MobileConfigId = "mobile-home";
export const POST_LOGIN_CONFIG_ID: MobileConfigId = "post-login";

export const isMobileHome = (id: MobileConfigId): boolean => id === MOBILE_HOME_CONFIG_ID;

export const MOBILE_CONFIG_LABEL_KEYS: Record<MobileConfigId, string> = {
  "mobile-home": "pages.mobileBuilder.postLogin.tabStandard",
  "post-login": "pages.mobileBuilder.postLogin.tabLanding",
};

export const MOBILE_BUILDER_API = {
  config: "/api/b2b/mobile-builder/config",
  publish: "/api/b2b/mobile-builder/config/publish",
  versions: "/api/b2b/mobile-builder/config/versions",
} as const;

/**
 * Resolve & validate `config_id` from URLSearchParams. Returns the standard-home id
 * when absent. Throws on unknown values so callers can map to a 400 response.
 */
export function parseConfigId(searchParams: URLSearchParams): MobileConfigId {
  const raw = searchParams.get("config_id");
  if (!raw) return MOBILE_HOME_CONFIG_ID;
  if (!(MOBILE_CONFIG_IDS as readonly string[]).includes(raw)) {
    throw new Error(`Invalid config_id: ${raw}`);
  }
  return raw as MobileConfigId;
}
