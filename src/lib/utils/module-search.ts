/**
 * Module Search Utility
 *
 * Pure, React-free matching used by the header command palette (`ModuleSearch`).
 * Keeps the matching logic unit-testable: the translated display name is injected
 * by the caller via `nameOf`, so this util never imports React, the router, or `t()`.
 */

import { getLauncherApps, type AppConfig } from "@/config/apps.config";

/**
 * Returns launcher apps whose translated name, description, or id contains the
 * query (case-insensitive, trimmed). Registry order from `getLauncherApps()` is
 * preserved. An empty / whitespace-only query returns `[]`.
 *
 * @param query   Raw user input from the search box.
 * @param nameOf  Resolves an app's translated display name (e.g. `t(\`apps.${app.id}.name\`)`).
 */
export function matchApps(
  query: string,
  nameOf: (app: AppConfig) => string
): AppConfig[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [];

  return getLauncherApps().filter((app) => {
    const haystack = [nameOf(app), app.description, app.id]
      .join("\n")
      .toLowerCase();
    return haystack.includes(needle);
  });
}
