import type { Model } from "mongoose";
import { safeRegexQuery } from "@/lib/security";

/**
 * Server-side search helpers for PIM list endpoints whose `name` field is a
 * multilingual object (`{ it: "...", en: "..." }`). Used so the client passes
 * the search term to the API instead of fetching everything and filtering
 * in-memory (see the client-filtering standard).
 */

const FALLBACK_LOCALES = ["it", "en"];

/**
 * Enabled language codes for the tenant. Falls back to a small default set if
 * the languages collection is empty/unavailable, so search never silently
 * matches nothing.
 */
export async function getEnabledLocaleCodes(
  LanguageModel: Model<unknown>,
): Promise<string[]> {
  try {
    const langs = await LanguageModel.find(
      { isEnabled: true },
      { code: 1, _id: 0 },
    ).lean();
    const codes = (langs as Array<{ code?: string }>)
      .map((l) => l.code)
      .filter((c): c is string => Boolean(c));
    return codes.length ? codes : FALLBACK_LOCALES;
  } catch {
    return FALLBACK_LOCALES;
  }
}

/**
 * Build a Mongo `$or` matching `search` (case-insensitive, escaped) against a
 * multilingual field — `<nameField>.<code>` for each locale — plus any plain
 * string fields (slug, code, …). Returns [] when `search` is empty.
 *
 *   query.$or = buildMultilangSearchOr(search, codes, { plainFields: ["slug", "code"] });
 */
export function buildMultilangSearchOr(
  search: string | null | undefined,
  localeCodes: string[],
  opts: { nameField?: string; plainFields?: string[] } = {},
): Record<string, unknown>[] {
  const term = search?.trim();
  if (!term) return [];

  const rx = safeRegexQuery(term);
  const nameField = opts.nameField ?? "name";
  const or: Record<string, unknown>[] = localeCodes.map((code) => ({
    [`${nameField}.${code}`]: rx,
  }));
  for (const field of opts.plainFields ?? []) {
    or.push({ [field]: rx });
  }
  return or;
}
