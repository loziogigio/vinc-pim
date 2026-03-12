/**
 * UI Translation System
 *
 * Lightweight client-side i18n for the B2B admin panel.
 * Supports: English (default), Italian, Slovak.
 */

import en from "./locales/en";
import it from "./locales/it";
import sk from "./locales/sk";

export type UILocale = "en" | "it" | "sk";

export const UI_LOCALES: { code: UILocale; name: string; nativeName: string; flag: string }[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  { code: "sk", name: "Slovak", nativeName: "Slovenčina", flag: "🇸🇰" },
];

const locales: Record<UILocale, typeof en> = { en, it, sk };

export const DEFAULT_UI_LOCALE: UILocale = "en";

/**
 * Get a nested value from an object using dot-notation path.
 * e.g. getNestedValue(obj, "nav.pim.title") → obj.nav.pim.title
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current : undefined;
}

/**
 * Create a translation function for a given locale.
 * Falls back to English if key not found in current locale.
 */
export function createT(locale: UILocale) {
  const messages = locales[locale] || locales.en;
  const fallback = locales.en;

  return function t(key: string, params?: Record<string, string | number>): string {
    let value =
      getNestedValue(messages as unknown as Record<string, unknown>, key) ??
      getNestedValue(fallback as unknown as Record<string, unknown>, key) ??
      key;

    // Simple parameter substitution: {{name}} → value
    if (params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, "g"), String(paramValue));
      }
    }

    return value;
  };
}

export type TranslationFunction = ReturnType<typeof createT>;
