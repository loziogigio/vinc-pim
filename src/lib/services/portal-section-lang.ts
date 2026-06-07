import { getDefaultLanguage, isValidLanguageCode } from "@/config/languages";
import type { HeaderConfig } from "@/lib/types/home-settings";
import type { IB2CStorefrontFooter } from "@/lib/db/models/b2c-storefront";

/** Read a value from a `*_by_lang` field that may be a Mongoose Map OR a plain object. */
function fromMap<T>(map: unknown, key: string): T | undefined {
  if (!map) return undefined;
  if (map instanceof Map) return map.get(key) as T | undefined;
  return (map as Record<string, T>)[key];
}

function normalizeLang(lang: string | undefined): string {
  return lang && isValidLanguageCode(lang) ? lang : getDefaultLanguage().code;
}

function isDefault(lang: string): boolean {
  return lang === getDefaultLanguage().code;
}

/** Published-or-draft header config for `lang`, falling back to the default-language base. */
export function resolveHeaderConfig(
  portal: any,
  lang: string | undefined,
  opts: { draft?: boolean } = {}
): HeaderConfig {
  const code = normalizeLang(lang);
  const base = opts.draft
    ? portal.header_config_draft ?? portal.header_config
    : portal.header_config;
  if (isDefault(code)) return base;
  const map = opts.draft ? portal.header_config_draft_by_lang : portal.header_config_by_lang;
  return fromMap<HeaderConfig>(map, code) ?? base;
}

/** Published-or-draft footer for `lang`, falling back to the default-language base. */
export function resolveFooter(
  portal: any,
  lang: string | undefined,
  opts: { draft?: boolean } = {}
): IB2CStorefrontFooter {
  const code = normalizeLang(lang);
  const base = opts.draft ? portal.footer_draft ?? portal.footer : portal.footer;
  if (isDefault(code)) return base;
  const map = opts.draft ? portal.footer_draft_by_lang : portal.footer_by_lang;
  return fromMap<IB2CStorefrontFooter>(map, code) ?? base;
}

// ---- Admin patch builders (default lang → base field; other → by-lang map) ----

export function headerDraftPatch(
  lang: string,
  value: HeaderConfig,
  currentMap: Record<string, HeaderConfig>
): Record<string, unknown> {
  if (isDefault(lang)) return { header_config_draft: value };
  return { header_config_draft_by_lang: { ...currentMap, [lang]: value } };
}

export function footerDraftPatch(
  lang: string,
  value: IB2CStorefrontFooter,
  currentMap: Record<string, IB2CStorefrontFooter>
): Record<string, unknown> {
  if (isDefault(lang)) return { footer_draft: value };
  return { footer_draft_by_lang: { ...currentMap, [lang]: value } };
}

export function headerPublishPatch(
  lang: string,
  draftValue: HeaderConfig,
  currentPubMap: Record<string, HeaderConfig>,
  currentDraftMap: Record<string, HeaderConfig>
): Record<string, unknown> {
  if (isDefault(lang)) {
    return { header_config: draftValue, header_config_draft: draftValue };
  }
  return {
    header_config_by_lang: { ...currentPubMap, [lang]: draftValue },
    header_config_draft_by_lang: { ...currentDraftMap, [lang]: draftValue },
  };
}

export function footerPublishPatch(
  lang: string,
  publishedValue: IB2CStorefrontFooter,
  currentPubMap: Record<string, IB2CStorefrontFooter>,
  currentDraftMap: Record<string, IB2CStorefrontFooter>
): Record<string, unknown> {
  if (isDefault(lang)) {
    return { footer: publishedValue, footer_draft: publishedValue };
  }
  return {
    footer_by_lang: { ...currentPubMap, [lang]: publishedValue },
    footer_draft_by_lang: { ...currentDraftMap, [lang]: publishedValue },
  };
}
