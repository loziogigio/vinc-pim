/**
 * B2B Product Resolver Service
 *
 * Resolves a published PIM product from its (per-locale) URL slug, scoped to a
 * tenant. Used by the public `resolve-product` endpoint that the B2B storefront
 * calls for flat slug URLs (`/{lang}/{product-slug}`).
 *
 * Strategy (seo-url spec §6.1 / decision D1):
 *   1. Primary path — slug-filtered PIM search (`filters.slug`), peer of `sku`.
 *   2. Fallback path — direct Mongo `pimproducts` query on `slug.{lang}` when
 *      Solr is disabled or returns no result. vcs owns the data, so the resolver
 *      never blocks on the search engine.
 */

import { connectWithModels } from "@/lib/db/connection";
import { getSolrConfig, isSolrEnabled } from "@/config/project.config";
import { buildSearchQuery } from "@/lib/search/query-builder";
import { transformSearchResponse } from "@/lib/search/response-transformer";
import type { SearchRequest, SolrProduct } from "@/lib/types/search";

const logPrefix = "[b2b-resolve-product]";

/** §5.1 success shape. */
export interface ResolvedProduct {
  sku: string;
  parentSku: string | null;
  name: string;
  slug: string;
  categoryAncestors: string[];
  found: true;
}

export interface NotResolvedProduct {
  found: false;
}

export type ResolveProductResult = ResolvedProduct | NotResolvedProduct;

/**
 * Build the `categoryAncestors` array (root → leaf category_ids) from a
 * product's embedded category. `path` holds ancestor ids; the leaf id is
 * appended last.
 */
function categoryAncestorsFromCategory(category?: {
  category_id?: string;
  path?: string[];
}): string[] {
  if (!category) return [];
  const ancestors = Array.isArray(category.path) ? [...category.path] : [];
  if (category.category_id && !ancestors.includes(category.category_id)) {
    ancestors.push(category.category_id);
  }
  return ancestors.filter(Boolean);
}

/**
 * Slug-filtered PIM search (primary path).
 * Returns the first matching product or null. Never throws — a Solr failure
 * degrades to the Mongo fallback.
 */
async function resolveViaSearch(
  tenantDb: string,
  slug: string,
  lang: string,
): Promise<SolrProduct | null> {
  if (!isSolrEnabled()) return null;

  try {
    const config = getSolrConfig();
    const searchRequest: SearchRequest = {
      lang,
      // include all products regardless of variant faceting flags so a variant
      // (child) slug still resolves; we only need identity fields here.
      include_faceting: false,
      start: 0,
      rows: 1,
      filters: { slug, status: "published" },
    };

    const solrQuery = buildSearchQuery(searchRequest);
    const { SolrClient } = await import("@/lib/search/solr-client");
    const solrClient = new SolrClient(config.url, tenantDb);
    const solrResponse = await solrClient.search(solrQuery);
    const response = transformSearchResponse(solrResponse, lang);
    return response.results[0] ?? null;
  } catch (err) {
    console.warn(
      `${logPrefix} search path failed, falling back to Mongo:`,
      (err as Error).message,
    );
    return null;
  }
}

/**
 * Direct Mongo `pimproducts` lookup (fallback path).
 * Matches the requested locale first, then any locale (locale fallback).
 */
async function resolveViaMongo(
  tenantDb: string,
  slug: string,
  lang: string,
): Promise<ResolvedProduct | null> {
  const { PIMProduct } = await connectWithModels(tenantDb);

  const baseScope = { status: "published", isCurrent: true };

  // Exact locale slug (indexed by the `slug.$**` wildcard index).
  let doc = (await PIMProduct.findOne({
    ...baseScope,
    [`slug.${lang}`]: slug,
  }).lean()) as Record<string, any> | null;

  // SKU fallback: the sitemap emits each product as `canonicalProductSlug`
  // (`slug?.[locale] || sku`), so products without a human slug are reachable
  // at /{lang}/{sku}. Without this they'd 404 despite being in the sitemap.
  if (!doc) {
    doc = (await PIMProduct.findOne({
      ...baseScope,
      sku: slug,
    }).lean()) as Record<string, any> | null;
  }

  if (!doc) return null;

  const name = doc.name?.[lang] ?? firstValue(doc.name) ?? doc.sku ?? "";
  const resolvedSlug = doc.slug?.[lang] ?? firstValue(doc.slug) ?? slug;

  return {
    sku: doc.sku,
    parentSku: doc.parent_sku ?? null,
    name,
    slug: resolvedSlug,
    categoryAncestors: categoryAncestorsFromCategory(doc.category),
    found: true,
  };
}

/** First defined value of a multilingual map. */
function firstValue(map?: Record<string, unknown>): string | undefined {
  if (!map || typeof map !== "object") return undefined;
  for (const v of Object.values(map)) {
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

/**
 * Map a Solr search hit to the §5.1 shape.
 */
function fromSearchHit(
  hit: SolrProduct,
  lang: string,
  slug: string,
): ResolvedProduct {
  return {
    sku: hit.sku,
    parentSku: hit.parent_sku ?? null,
    name: hit.name ?? hit.sku ?? "",
    slug: hit.slug ?? slug,
    categoryAncestors: categoryAncestorsFromCategory(hit.category),
    found: true,
  };
}

/**
 * Resolve a published product by slug, scoped to a tenant.
 * Tries the slug-filtered search first, then a Mongo fallback.
 */
export async function resolveProductBySlug(
  tenantDb: string,
  slug: string,
  lang: string,
): Promise<ResolveProductResult> {
  const trimmedSlug = (slug || "").trim();
  if (!trimmedSlug) return { found: false };

  const hit = await resolveViaSearch(tenantDb, trimmedSlug, lang);
  if (hit) return fromSearchHit(hit, lang, trimmedSlug);

  const viaMongo = await resolveViaMongo(tenantDb, trimmedSlug, lang);
  if (viaMongo) return viaMongo;

  return { found: false };
}

// Exported for unit testing.
export const __test = {
  categoryAncestorsFromCategory,
  firstValue,
};
