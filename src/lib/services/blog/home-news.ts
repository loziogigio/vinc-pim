// src/lib/services/blog/home-news.ts
/**
 * Pure helpers + types for the Home-launcher "Novità & aggiornamenti" feed.
 *
 * No DB / network imports live here so the merge/format logic can be unit-tested
 * in isolation and the resulting types can be imported by the (client) launcher
 * component without pulling in server-only code.
 */
import type { MultiLangString } from "@/lib/types/pim";

export type HomeNewsSource = "local" | "central";

/** One normalized item in the merged home news stream. */
export interface HomeNewsItem {
  /** Stable, source-prefixed id (e.g. `local:bp_x` / `central:my-slug`). */
  id: string;
  source: HomeNewsSource;
  title: string;
  excerpt: string | null;
  /** Resolved category label, when known. */
  category: string | null;
  coverUrl: string | null;
  /** ISO date used for sorting; may be null. */
  publishedAt: string | null;
  /** Pre-formatted, locale-aware date label (formatted server-side to avoid hydration drift). */
  dateLabel: string;
  /** Link target for the card. */
  href: string;
  /** When true the link points off-app and should open in a new tab. */
  external: boolean;
}

/** A platform CMS static page surfaced as a link on the launcher. */
export interface HomeNewsPageLink {
  slug: string;
  title: string;
}

export const HOME_NEWS_DEFAULT_LIMIT = 6;

/** Pick the best string for `locale` from a MultiLangString, with sensible fallbacks. */
export function pickLang(value: MultiLangString | undefined | null, locale: string): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[locale] || value.it || value.en || Object.values(value)[0] || "";
}

/** Map a tenant language code (it/en/sk) to an Intl locale for date formatting. */
export function intlLocale(locale: string): string {
  if (locale === "en") return "en-GB";
  if (locale === "sk") return "sk-SK";
  return "it-IT";
}

/** Format an ISO date into a short, locale-aware label (e.g. "12 giu 2026"). Empty on missing/invalid. */
export function formatNewsDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(intlLocale(locale), { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Merge two source streams into one chronological list (newest first), capped at `limit`.
 * Items with no `publishedAt` sort last. Pure — no side effects.
 */
export function mergeNews(local: HomeNewsItem[], central: HomeNewsItem[], limit: number): HomeNewsItem[] {
  return [...local, ...central]
    .slice()
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))
    .slice(0, Math.max(0, limit));
}
