import { CategoryEmbedded, CategoryHierarchyItem } from "@/lib/types/entities/category.types";
import { connectWithModels } from "@/lib/db/connection";
import { invalidateB2CCache } from "@/lib/cache/redis-client";

/**
 * Get enabled language codes for the tenant
 */
export async function getEnabledLanguageCodes(LanguageModel: any): Promise<string[]> {
  const languages = await LanguageModel.find({ isEnabled: true }).select("code").lean();
  return languages.map((l: any) => l.code as string);
}

/**
 * Wrap a plain string in all enabled languages
 * e.g. "Bicchieri" → { it: "Bicchieri", de: "Bicchieri", en: "Bicchieri" }
 */
export function wrapMultilingual(value: string, langCodes: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const code of langCodes) {
    result[code] = value;
  }
  return result;
}

/**
 * Build the full embedded category object for product assignment.
 * Fetches ancestors and wraps names/slugs in all enabled tenant languages.
 */
export async function buildCategoryEmbedding(params: {
  category: any;
  CategoryModel: any;
  LanguageModel: any;
}): Promise<CategoryEmbedded> {
  const { category, CategoryModel, LanguageModel } = params;

  const langCodes = await getEnabledLanguageCodes(LanguageModel);
  if (langCodes.length === 0) {
    langCodes.push("it"); // fallback
  }

  const hierarchy: CategoryHierarchyItem[] = [];
  let channelCode = category.channel_code || null;

  if (category.path && category.path.length > 0) {
    const ancestorDocs = await CategoryModel.find({
      category_id: { $in: category.path },
    }).lean();

    const ancestorMap = new Map(
      (ancestorDocs as any[]).map((a: any) => [a.category_id, a])
    );

    for (const ancestorId of category.path) {
      const ancestor = ancestorMap.get(ancestorId);
      if (ancestor) {
        hierarchy.push({
          category_id: ancestor.category_id,
          name: wrapMultilingual(ancestor.name, langCodes),
          slug: wrapMultilingual(ancestor.slug, langCodes),
          level: ancestor.level,
        });
      }
    }

    // Resolve channel_code from root ancestor if not set on this category
    if (!channelCode) {
      const rootId = category.path[0];
      const root = ancestorMap.get(rootId);
      channelCode = root?.channel_code || null;
    }
  }

  return {
    category_id: category.category_id,
    name: wrapMultilingual(category.name, langCodes),
    slug: wrapMultilingual(category.slug, langCodes),
    parent_id: category.parent_id || null,
    level: category.level ?? 0,
    path: category.path || [],
    hierarchy,
    channel_code: channelCode,
    is_active: category.is_active ?? true,
  };
}

/**
 * Resolve channel_code for any category.
 * Root categories have it directly; children inherit from their root ancestor.
 */
export function resolveChannelCode(
  category: any,
  categoryMap: Map<string, any>
): string | null {
  if (!category.parent_id) return category.channel_code || null;
  if (category.path?.length > 0) {
    const rootId = category.path[0];
    const root = categoryMap.get(rootId);
    return root?.channel_code || null;
  }
  return null;
}

// ============================================
// BATCH REBUILD (for batch sync)
// ============================================

/**
 * Pre-loaded entity maps for batch rebuilding.
 * Load once before iterating products to avoid N+1 queries.
 */
export interface EmbeddingContext {
  langCodes: string[];
  categoryMap: Map<string, any>;
  brandMap: Map<string, any>;
}

/**
 * Load all entity data needed for embedding rebuilds.
 * Call once before processing products in batch.
 */
export async function loadEmbeddingContext(tenantDb: string): Promise<EmbeddingContext> {
  const { Language, Category, Brand } = await connectWithModels(tenantDb);

  const [langDocs, categories, brands] = await Promise.all([
    Language.find({ isEnabled: true }).select("code").lean(),
    Category.find({}).lean(),
    Brand.find({}).lean(),
  ]);

  const langCodes = langDocs.map((l: any) => l.code as string);
  if (langCodes.length === 0) langCodes.push("it");

  return {
    langCodes,
    categoryMap: new Map((categories as any[]).map((c) => [c.category_id, c])),
    brandMap: new Map((brands as any[]).map((b) => [b.brand_id, b])),
  };
}

/**
 * Rebuild category embedding from pre-loaded map (no DB queries).
 */
function buildCategoryFromMap(
  categoryId: string,
  ctx: EmbeddingContext
): CategoryEmbedded | null {
  const cat = ctx.categoryMap.get(categoryId);
  if (!cat) return null;

  const hierarchy: CategoryHierarchyItem[] = [];
  if (cat.path && cat.path.length > 0) {
    for (const ancestorId of cat.path) {
      const ancestor = ctx.categoryMap.get(ancestorId);
      if (ancestor) {
        hierarchy.push({
          category_id: ancestor.category_id,
          name: wrapMultilingual(ancestor.name, ctx.langCodes),
          slug: wrapMultilingual(ancestor.slug, ctx.langCodes),
          level: ancestor.level,
        });
      }
    }
  }

  return {
    category_id: cat.category_id,
    name: wrapMultilingual(cat.name, ctx.langCodes),
    slug: wrapMultilingual(cat.slug, ctx.langCodes),
    parent_id: cat.parent_id || null,
    level: cat.level ?? 0,
    path: cat.path || [],
    hierarchy,
    channel_code: resolveChannelCode(cat, ctx.categoryMap),
    is_active: cat.is_active ?? true,
  };
}

/**
 * Rebuild brand embedding from pre-loaded map.
 */
function buildBrandFromMap(
  brandId: string,
  ctx: EmbeddingContext
): Record<string, any> | null {
  const brand = ctx.brandMap.get(brandId);
  if (!brand) return null;

  const result: Record<string, any> = {
    id: brand.brand_id,
    brand_id: brand.brand_id,
    name: brand.label,
    slug: brand.slug,
  };

  if (brand.logo_url) {
    result.image = {
      id: brand.brand_id,
      thumbnail: brand.logo_url,
      original: brand.logo_url,
    };
  }

  if (brand.description) result.description = brand.description;
  if (brand.website_url) result.website_url = brand.website_url;

  return result;
}

/**
 * Rebuild all embedded entities on a product document (mutates in place).
 * Returns true if any embedding was updated.
 */
export function rebuildProductEmbeddings(
  product: any,
  ctx: EmbeddingContext
): boolean {
  let changed = false;

  // Rebuild category
  const catId = product.category?.category_id || product.category?.id;
  if (catId) {
    const newCat = buildCategoryFromMap(catId, ctx);
    if (newCat) {
      product.category = newCat;
      changed = true;
    }
  }

  // Rebuild channel_categories (per-channel category assignments)
  if (product.channel_categories?.length) {
    for (const cc of product.channel_categories) {
      const ccCatId = cc.category?.category_id || cc.category?.id;
      if (ccCatId) {
        const newCat = buildCategoryFromMap(ccCatId, ctx);
        if (newCat) {
          cc.category = newCat;
          changed = true;
        }
      }
    }
  }

  // Propagate channels from category assignments
  const resolvedChannels = new Set<string>(product.channels?.length ? product.channels : ["default"]);
  // From primary category
  if (product.category?.channel_code) {
    resolvedChannels.add(product.category.channel_code);
  }
  // From channel_categories
  if (product.channel_categories?.length) {
    for (const cc of product.channel_categories) {
      if (cc.channel_code) resolvedChannels.add(cc.channel_code);
    }
  }
  const newChannels = [...resolvedChannels];
  if (JSON.stringify(newChannels.sort()) !== JSON.stringify((product.channels || []).sort())) {
    product.channels = newChannels;
    changed = true;
  }

  // Rebuild brand
  const brandId = product.brand?.brand_id || product.brand?.id;
  if (brandId) {
    const newBrand = buildBrandFromMap(brandId, ctx);
    if (newBrand) {
      product.brand = newBrand;
      changed = true;
    }
  }

  return changed;
}

/**
 * Invalidate B2C category-landing cache for all storefronts in the tenant.
 * Publishes "category-landing" to each storefront's Redis invalidation channel.
 */
export async function invalidateCategoryCache(tenantDb: string): Promise<void> {
  await invalidateB2CCache(tenantDb, "category-landing");
}
