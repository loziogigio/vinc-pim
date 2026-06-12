/**
 * Per-language menu helpers.
 *
 * A menu "version" is the full set of items for a given (channel, location,
 * language). The default language is the base version: legacy items created
 * before i18n have no `language` field and belong to it. Other languages store
 * their own items tagged with `language`. The public endpoint resolves the
 * requested language and falls back to the default version when empty.
 *
 * The set of valid languages is **tenant-specific** and lives in the tenant's
 * `languages` collection — the same source the PIM language tabs use. The
 * default resolves from that collection (`LanguageModel.find({ isEnabled: true })`,
 * preferring the `isDefault` entry), falling back to `"it"` only when the tenant
 * has no enabled languages seeded. Always resolve through a
 * {@link MenuLanguageContext} loaded from the tenant DB via
 * {@link loadMenuLanguageContext}.
 */

/** The tenant's menu language configuration, loaded once per request. */
export interface MenuLanguageContext {
  /** Lowercased codes of the tenant's enabled languages. */
  enabledCodes: string[];
  /** The tenant's default language code (lowercased). */
  defaultCode: string;
}

/** Minimal shape of the Mongoose Language model this module depends on. */
interface LanguageModelLike {
  find: (filter: Record<string, unknown>) => {
    select: (fields: string) => {
      lean: () => Promise<Array<{ code: string; isDefault?: boolean }>>;
    };
  };
}

/**
 * Build a language context from the tenant's `languages` collection. Falls back
 * to the global default language only when the tenant has no enabled languages.
 */
export async function loadMenuLanguageContext(
  LanguageModel: LanguageModelLike,
): Promise<MenuLanguageContext> {
  const langs = await LanguageModel.find({ isEnabled: true })
    .select("code isDefault")
    .lean();

  const enabledCodes = langs
    .map((l) => (l.code || "").trim().toLowerCase())
    .filter(Boolean);

  const dbDefault = langs.find((l) => l.isDefault)?.code;
  const defaultCode = (dbDefault || enabledCodes[0] || "it")
    .trim()
    .toLowerCase();

  return { enabledCodes, defaultCode };
}

/** Normalize a requested code to one the tenant has enabled, or the default. */
export function resolveMenuLanguage(
  lang: string | null | undefined,
  ctx: MenuLanguageContext,
): string {
  const code = (lang || "").trim().toLowerCase();
  return code && ctx.enabledCodes.includes(code) ? code : ctx.defaultCode;
}

/** Whether a (already-resolved) code is the tenant's default language. */
export function isDefaultMenuLanguage(
  lang: string,
  ctx: MenuLanguageContext,
): boolean {
  return lang === ctx.defaultCode;
}

/**
 * Mongo filter selecting the items that make up `lang`'s menu version.
 * The default language also matches legacy items with no `language` set.
 */
export function menuLanguageFilter(
  lang: string,
  ctx: MenuLanguageContext,
): Record<string, unknown> {
  if (isDefaultMenuLanguage(lang, ctx)) {
    return {
      $or: [
        { language: lang },
        { language: { $exists: false } },
        { language: null },
      ],
    };
  }
  return { language: lang };
}

/**
 * Combine a base query with the language-version filter. Uses `$and` because
 * both sides may carry their own `$or` (time bounds + default-language match).
 */
export function withMenuLanguage(
  baseQuery: Record<string, unknown>,
  lang: string,
  ctx: MenuLanguageContext,
): Record<string, unknown> {
  return { $and: [baseQuery, menuLanguageFilter(lang, ctx)] };
}
