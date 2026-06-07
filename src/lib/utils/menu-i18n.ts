/**
 * Helpers for per-language menu item labels (`label_i18n`).
 *
 * `label_i18n` is a map of language code → label override. The public menu
 * endpoint resolves a label for the requested language, falling back to the
 * default `label` when no translation exists.
 */

/**
 * Clean a raw `label_i18n` payload: lowercase keys, trim values, drop empty
 * entries. Returns `undefined` when nothing remains so we don't persist an
 * empty object.
 */
export function normalizeLabelI18n(
  raw: unknown,
): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const out: Record<string, string> = {};
  for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(code).trim().toLowerCase();
    const label = typeof value === "string" ? value.trim() : "";
    if (key && label) out[key] = label;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Resolve the label to display for a menu item in the given language.
 * Falls back to the default label when no translation is set.
 */
export function resolveMenuLabel(
  item: { label?: string; label_i18n?: Record<string, string> | null },
  lang?: string | null,
): string | undefined {
  const code = lang?.trim().toLowerCase();
  if (code && item.label_i18n && item.label_i18n[code]) {
    return item.label_i18n[code];
  }
  return item.label;
}
