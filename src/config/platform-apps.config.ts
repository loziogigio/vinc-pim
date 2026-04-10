/**
 * Platform Apps Configuration
 *
 * Defines the top-level platform applications that can be enabled/disabled per tenant.
 * These are separate from the module-level apps in apps.config.ts (PIM, Store, etc.).
 *
 * Used by: Super-admin tenant management, B2B app launcher/toggle
 */

export const PLATFORM_APP_IDS = ["b2b", "vetrina", "vinc-office"] as const;
export type PlatformAppId = (typeof PLATFORM_APP_IDS)[number];

export interface PlatformAppConfig {
  id: PlatformAppId;
  name: string;
  description: string;
  url?: string;
}

export const PLATFORM_APPS: PlatformAppConfig[] = [
  {
    id: "b2b",
    name: "B2B",
    description: "B2B Commerce Portal",
  },
  {
    id: "vetrina",
    name: "Vetrina",
    description: "Public Storefront / Ufficio Digitale",
  },
  {
    id: "vinc-office",
    name: "Vinc Office",
    description: "Admin Commerce Suite",
  },
];

/**
 * Resolve effective enabled apps for a tenant (static fallback).
 * If enabled_apps is undefined or empty, all apps are enabled (backward compatible).
 */
export function resolveEnabledApps(
  enabled_apps?: string[]
): PlatformAppId[] {
  if (!enabled_apps || enabled_apps.length === 0) {
    return [...PLATFORM_APP_IDS];
  }
  return enabled_apps.filter((id): id is PlatformAppId =>
    (PLATFORM_APP_IDS as readonly string[]).includes(id)
  );
}

/**
 * Sort platform apps so that the app with app_id "b2b" always comes first.
 * Preserves the original order (sort_order) for the remaining apps.
 */
export function sortWithB2BFirst<T extends { app_id: string }>(
  apps: T[]
): T[] {
  return [...apps].sort((a, b) => {
    if (a.app_id === "b2b") return -1;
    if (b.app_id === "b2b") return 1;
    return 0;
  });
}

/**
 * Fetch platform apps from the database. Falls back to static PLATFORM_APPS
 * if the DB collection is empty or unavailable.
 */
export async function getDynamicPlatformApps(): Promise<
  Array<{ app_id: string; name: string; description: string; url: string }>
> {
  try {
    const { getPlatformAppModel } = await import(
      "@/lib/db/models/admin-platform-app"
    );
    const PlatformApp = await getPlatformAppModel();
    const apps = await PlatformApp.find({ is_active: true })
      .sort({ sort_order: 1 })
      .lean();

    if (apps.length > 0) {
      return apps.map((a) => ({
        app_id: a.app_id,
        name: a.name,
        description: a.description || "",
        url: a.url,
      }));
    }
  } catch {
    // DB unavailable — fall through to static
  }

  return PLATFORM_APPS.map((a) => ({
    app_id: a.id,
    name: a.name,
    description: a.description,
    url: "",
  }));
}
