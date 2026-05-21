import type { Model } from "mongoose";

interface EmbeddedBrand {
  brand_id?: string;
  label?: string;
  slug?: string;
  logo_url?: string;
  description?: string;
}

interface EmbeddedProductType {
  product_type_id?: string;
  code?: string;
  name?: unknown;
  slug?: unknown;
}

interface CategoryHierarchyNode {
  category_id?: string;
  name?: unknown;
  slug?: unknown;
  level?: number;
}

interface EmbeddedChannelCategory {
  channel_code?: string;
  category?: {
    category_id?: string;
    code?: string;
    external_code?: string;
    name?: unknown;
    slug?: unknown;
    level?: number;
    hierarchy?: CategoryHierarchyNode[];
  };
}

export interface AutoProvisionStats {
  brandsCreated: number;
  productTypesCreated: number;
  categoriesCreated: number;
}

function pickString(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidate = obj.it ?? obj.en ?? Object.values(obj)[0];
    return candidate ? String(candidate).trim() : "";
  }
  return String(value).trim();
}

async function ensureBrand(
  BrandModel: Model<unknown>,
  brand: EmbeddedBrand | undefined,
  stats: AutoProvisionStats,
): Promise<void> {
  if (!brand?.brand_id || !brand.label) return;

  const slug =
    brand.slug?.trim() ||
    brand.label
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const update: Record<string, unknown> = {
    brand_id: brand.brand_id,
    label: brand.label.trim(),
    slug,
    is_active: true,
  };
  if (brand.logo_url) update.logo_url = brand.logo_url;
  if (brand.description) update.description = brand.description;

  const res = await BrandModel.updateOne(
    { brand_id: brand.brand_id },
    { $setOnInsert: update },
    { upsert: true },
  );
  if ((res as { upsertedCount?: number }).upsertedCount) stats.brandsCreated++;
}

async function ensureProductType(
  ProductTypeModel: Model<unknown>,
  productType: EmbeddedProductType | undefined,
  stats: AutoProvisionStats,
): Promise<void> {
  if (!productType?.code) return;

  const productTypeId = productType.product_type_id || productType.code;
  const slug = pickString(productType.slug) || productType.code;
  const name = productType.name || { it: productType.code };

  const res = await ProductTypeModel.updateOne(
    { $or: [{ product_type_id: productTypeId }, { code: productType.code }] },
    {
      $setOnInsert: {
        product_type_id: productTypeId,
        code: productType.code,
        name,
        slug,
        technical_specifications: [],
        is_active: true,
        product_count: 0,
        display_order: 0,
      },
    },
    { upsert: true },
  );
  if ((res as { upsertedCount?: number }).upsertedCount) stats.productTypesCreated++;
}

async function ensureCategoryNode(
  CategoryModel: Model<unknown>,
  node: CategoryHierarchyNode,
  level: number,
  parentId: string | undefined,
  pathSoFar: string[],
  channelCode: string | undefined,
  stats: AutoProvisionStats,
): Promise<void> {
  const categoryId = node.category_id;
  if (!categoryId) return;

  const nameStr = pickString(node.name);
  const slugStr = pickString(node.slug);
  if (!nameStr || !slugStr) return;

  const insertDoc: Record<string, unknown> = {
    category_id: categoryId,
    name: nameStr,
    slug: slugStr,
    level,
    path: [...pathSoFar],
    is_active: true,
  };
  if (parentId) insertDoc.parent_id = parentId;
  if (level === 0 && channelCode) insertDoc.channel_code = channelCode;

  try {
    const res = await CategoryModel.updateOne(
      { category_id: categoryId },
      { $setOnInsert: insertDoc },
      { upsert: true },
    );
    if ((res as { upsertedCount?: number }).upsertedCount) stats.categoriesCreated++;
  } catch (err) {
    // Duplicate key on the slug index — a different category already claims this slug.
    // Retry once with the category_id suffixed for disambiguation.
    if ((err as { code?: number }).code === 11000) {
      insertDoc.slug = `${slugStr}-${categoryId}`;
      try {
        const res = await CategoryModel.updateOne(
          { category_id: categoryId },
          { $setOnInsert: insertDoc },
          { upsert: true },
        );
        if ((res as { upsertedCount?: number }).upsertedCount) stats.categoriesCreated++;
      } catch {
        // give up silently — the product still has the embedded category data
      }
    }
  }
}

async function ensureCategories(
  CategoryModel: Model<unknown>,
  channelCategories: EmbeddedChannelCategory[] | undefined,
  stats: AutoProvisionStats,
): Promise<void> {
  if (!channelCategories?.length) return;

  for (const cc of channelCategories) {
    const cat = cc.category;
    if (!cat) continue;

    const chain: CategoryHierarchyNode[] = cat.hierarchy?.length
      ? cat.hierarchy
      : cat.category_id
        ? [{ category_id: cat.category_id, name: cat.name, slug: cat.slug, level: cat.level }]
        : [];
    if (chain.length === 0) continue;

    const pathSoFar: string[] = [];
    let parentId: string | undefined;
    for (let i = 0; i < chain.length; i++) {
      await ensureCategoryNode(CategoryModel, chain[i], i, parentId, pathSoFar, cc.channel_code, stats);
      if (chain[i].category_id) {
        pathSoFar.push(chain[i].category_id as string);
        parentId = chain[i].category_id;
      }
    }
  }
}

/**
 * Resolve channel_categories entries that arrive with only `external_code`
 * (no category_id). For each such entry, look up the matching Category by
 * external_code and fill in category_id, name, slug, level, plus the full
 * hierarchy chain (root → ... → leaf) so downstream code (auto-provision,
 * Solr adapter, search facets) has everything it needs.
 *
 * Entries that already carry a category_id are passed through unchanged.
 * Entries with no resolvable external_code are dropped.
 */
export async function resolveChannelCategoriesByExternalCode(
  CategoryModel: Model<unknown>,
  channelCategories: EmbeddedChannelCategory[] | undefined,
): Promise<EmbeddedChannelCategory[] | undefined> {
  if (!channelCategories?.length) return channelCategories;

  // Collect external codes that need resolving
  const externalCodes = new Set<string>();
  for (const cc of channelCategories) {
    const cat = cc.category;
    if (!cat) continue;
    if (cat.category_id) continue; // already resolved
    if (cat.external_code) externalCodes.add(cat.external_code);
  }
  if (externalCodes.size === 0) return channelCategories;

  // Fetch the matching leaf categories
  const leafCats = (await CategoryModel.find({
    external_code: { $in: Array.from(externalCodes) },
  }).lean()) as Array<{
    category_id: string;
    external_code?: string;
    name?: unknown;
    slug?: unknown;
    level?: number;
    path?: string[];
    channel_code?: string;
    parent_id?: string | null;
  }>;

  if (leafCats.length === 0) return [];

  // Fetch all ancestor categories in one query
  const ancestorIds = new Set<string>();
  for (const c of leafCats) {
    for (const id of c.path || []) ancestorIds.add(id);
  }
  const ancestorCats = ancestorIds.size
    ? ((await CategoryModel.find({
        category_id: { $in: Array.from(ancestorIds) },
      }).lean()) as Array<{
        category_id: string;
        name?: unknown;
        slug?: unknown;
        level?: number;
        channel_code?: string;
      }>)
    : [];
  const ancestorById = new Map(ancestorCats.map((a) => [a.category_id, a]));
  const leafByExternalCode = new Map(
    leafCats.filter((c) => c.external_code).map((c) => [c.external_code as string, c]),
  );

  // Walk the root of each chain to pick up the channel_code (only roots carry it)
  function resolveChannelCode(leaf: typeof leafCats[number]): string | undefined {
    if (leaf.channel_code) return leaf.channel_code;
    const root = (leaf.path && leaf.path.length > 0)
      ? ancestorById.get(leaf.path[0])
      : undefined;
    return root?.channel_code;
  }

  const resolved: EmbeddedChannelCategory[] = [];
  for (const cc of channelCategories) {
    const cat = cc.category;
    if (!cat) continue;
    if (cat.category_id) {
      resolved.push(cc);
      continue;
    }
    if (!cat.external_code) continue;
    const leaf = leafByExternalCode.get(cat.external_code);
    if (!leaf) continue; // no PIM category matches this code — drop the entry

    const hierarchy: CategoryHierarchyNode[] = [];
    for (const ancestorId of leaf.path || []) {
      const a = ancestorById.get(ancestorId);
      if (!a) continue;
      hierarchy.push({
        category_id: a.category_id,
        name: a.name,
        slug: a.slug,
        level: a.level ?? 0,
      });
    }

    resolved.push({
      channel_code: cc.channel_code || resolveChannelCode(leaf),
      category: {
        category_id: leaf.category_id,
        external_code: leaf.external_code,
        name: leaf.name,
        slug: leaf.slug,
        level: leaf.level ?? hierarchy.length,
        hierarchy,
      },
    });
  }
  return resolved;
}

/**
 * Auto-provision standalone Brand / ProductType / Category records from the data
 * embedded in a product import payload. Records are inserted only if missing
 * (idempotent), so existing manually-curated records are preserved.
 */
export async function autoProvisionCatalogEntities(params: {
  BrandModel: Model<unknown>;
  ProductTypeModel: Model<unknown>;
  CategoryModel: Model<unknown>;
  brand?: EmbeddedBrand;
  product_type?: EmbeddedProductType;
  channel_categories?: EmbeddedChannelCategory[];
}): Promise<AutoProvisionStats> {
  const stats: AutoProvisionStats = {
    brandsCreated: 0,
    productTypesCreated: 0,
    categoriesCreated: 0,
  };

  await ensureBrand(params.BrandModel, params.brand, stats);
  await ensureProductType(params.ProductTypeModel, params.product_type, stats);
  await ensureCategories(params.CategoryModel, params.channel_categories, stats);

  return stats;
}
