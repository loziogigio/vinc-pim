/**
 * Shared query builder for PIM product filtering.
 * Used by both the products list API and the bulk-update worker
 * to guarantee identical filter semantics.
 */

import {
  safeRegexQuery,
  safeRegexQueryWithMatchMode,
  sanitizeMongoQuery,
  type MatchMode,
} from "@/lib/security";
import { buildProductSearchConditions } from "@/lib/search/product-search";

export interface ProductFilterParams {
  search?: string;
  status?: string;
  source_id?: string;
  batch_id?: string;
  date_from?: string;
  date_to?: string;
  entity_code?: string;
  sku?: string;
  sku_match?: MatchMode;
  parent_sku?: string;
  parent_sku_match?: MatchMode;
  brand?: string;
  category?: string;
  product_type?: string;
  exclude_product_type?: string;
  product_kind?: string;
  price_min?: string;
  price_max?: string;
  score_min?: string;
  score_max?: string;
}

/**
 * Build a MongoDB query object from product filter parameters.
 * Always includes `{ isCurrent: true }` as base condition.
 */
export async function buildProductListQuery(
  filters: ProductFilterParams,
  tenantDb: string
): Promise<Record<string, any>> {
  const query: any = {
    isCurrent: true,
  };

  const {
    search, status, source_id, batch_id,
    date_from, date_to, entity_code,
    sku, sku_match, parent_sku, parent_sku_match,
    brand, category, product_type, exclude_product_type,
    product_kind, price_min, price_max, score_min, score_max,
  } = filters;

  if (status) query.status = sanitizeMongoQuery(status);
  if (product_kind) query.product_kind = sanitizeMongoQuery(product_kind);

  if (exclude_product_type) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { "product_type.product_type_id": { $ne: exclude_product_type } },
        { "product_type.product_type_id": { $exists: false } },
        { product_type: { $exists: false } },
      ],
    });
  }

  if (source_id) query["source.source_id"] = sanitizeMongoQuery(source_id);
  if (batch_id) {
    query["source.batch_id"] = safeRegexQuery(batch_id);
  }

  if (search) {
    query.$or = await buildProductSearchConditions(search, tenantDb);
  }

  if (date_from || date_to) {
    query.updated_at = {};
    if (date_from) {
      query.updated_at.$gte = new Date(date_from);
    }
    if (date_to) {
      const endDate = new Date(date_to);
      endDate.setHours(23, 59, 59, 999);
      query.updated_at.$lte = endDate;
    }
  }

  if (entity_code) {
    query.entity_code = safeRegexQuery(entity_code);
  }
  if (sku) {
    query.sku = safeRegexQueryWithMatchMode(sku, sku_match || "exact");
  }
  if (parent_sku) {
    query.parent_sku = safeRegexQueryWithMatchMode(parent_sku, parent_sku_match || "exact");
  }
  if (brand) {
    const brandRegex = safeRegexQuery(brand);
    query.$and = query.$and || [];
    query.$and.push({ "brand.label": brandRegex });
  }
  if (category) {
    const catRegex = safeRegexQuery(category);
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { "category.name.it": catRegex },
        { "category.name.en": catRegex },
        { "category.name": catRegex },
      ],
    });
  }
  if (product_type) {
    const ptRegex = safeRegexQuery(product_type);
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { "product_type.name.it": ptRegex },
        { "product_type.name.en": ptRegex },
        { "product_type.name": ptRegex },
      ],
    });
  }

  if (price_min || price_max) {
    query.price = {};
    if (price_min) query.price.$gte = parseFloat(price_min);
    if (price_max) query.price.$lte = parseFloat(price_max);
  }

  if (score_min || score_max) {
    query.completeness_score = {};
    if (score_min) query.completeness_score.$gte = parseInt(score_min);
    if (score_max) query.completeness_score.$lte = parseInt(score_max);
  }

  return query;
}
