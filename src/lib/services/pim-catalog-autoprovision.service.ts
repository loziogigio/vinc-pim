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
