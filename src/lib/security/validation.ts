/**
 * Security Validation Utilities
 *
 * Using:
 * - zod for schema validation
 * - mongo-sanitize for NoSQL injection prevention
 */

import { z } from "zod";
import mongoSanitize from "mongo-sanitize";

// ============================================
// MongoDB Query Sanitization
// ============================================

/**
 * Sanitize a value to prevent NoSQL injection
 * Removes any keys starting with $ or containing .
 */
export function sanitizeMongoQuery<T>(data: T): T {
  return mongoSanitize(data);
}

/**
 * Safe regex pattern - escapes special characters
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Create a safe MongoDB regex query from user input
 */
export function safeRegexQuery(
  input: string,
  options: string = "i"
): { $regex: string; $options: string } {
  const sanitized = sanitizeMongoQuery(input);
  const escaped = escapeRegex(String(sanitized));
  return { $regex: escaped, $options: options };
}

/**
 * Create a safe text search query
 */
export function safeTextSearch(input: string): { $search: string } {
  const sanitized = sanitizeMongoQuery(input);
  // Remove MongoDB operators and special chars
  const cleaned = String(sanitized)
    .replace(/[${}]/g, "")
    .trim();
  return { $search: cleaned };
}

// ============================================
// Zod Schemas for Common Validations
// ============================================

/**
 * Safe string schema - trims and limits length
 */
export const safeString = (maxLength: number = 500) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((val) => sanitizeMongoQuery(val));

/**
 * Safe search query schema
 */
export const searchQuerySchema = z.object({
  q: safeString(200).optional(),
  search: safeString(200).optional(),
  query: safeString(200).optional(),
});

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  skip: z.coerce.number().int().min(0).max(100000).optional(),
});

/**
 * Sort schema
 */
export const sortSchema = z.object({
  sortBy: safeString(50).optional(),
  sortOrder: z.enum(["asc", "desc", "1", "-1"]).optional(),
});

/**
 * Product filter schema
 */
export const productFilterSchema = z.object({
  entity_code: safeString(100).optional(),
  sku: safeString(100).optional(),
  status: z.enum(["draft", "review", "published", "archived"]).optional(),
  brand: safeString(100).optional(),
  category: safeString(100).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
});

/**
 * Combined product list query schema
 */
export const productListQuerySchema = searchQuerySchema
  .merge(paginationSchema)
  .merge(sortSchema)
  .merge(productFilterSchema);

// ============================================
// Helper Functions
// ============================================

/**
 * Parse and validate URL search params
 */
export function parseSearchParams<T extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: T
): z.infer<T> {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return schema.parse(params);
}

/**
 * Safe parse - returns null on failure instead of throwing
 */
export function safeParseParams<T extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: T
): z.infer<T> | null {
  try {
    return parseSearchParams(searchParams, schema);
  } catch {
    return null;
  }
}

/**
 * Build MongoDB filter from validated params
 */
export function buildProductFilter(params: z.infer<typeof productFilterSchema>): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (params.entity_code) {
    filter.entity_code = safeRegexQuery(params.entity_code);
  }

  if (params.sku) {
    filter.sku = safeRegexQuery(params.sku);
  }

  if (params.status) {
    filter.status = params.status;
  }

  if (params.brand) {
    filter.brand = safeRegexQuery(params.brand);
  }

  if (params.category) {
    filter.category = safeRegexQuery(params.category);
  }

  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    filter.price = {};
    if (params.minPrice !== undefined) {
      (filter.price as Record<string, number>).$gte = params.minPrice;
    }
    if (params.maxPrice !== undefined) {
      (filter.price as Record<string, number>).$lte = params.maxPrice;
    }
  }

  return filter;
}

/**
 * Build search query with OR conditions
 */
export function buildSearchQuery(
  searchTerm: string | undefined,
  fields: string[] = ["name", "description", "sku", "entity_code"]
): Record<string, unknown> | null {
  if (!searchTerm) return null;

  const safeSearch = safeRegexQuery(searchTerm);

  return {
    $or: fields.map((field) => ({ [field]: safeSearch })),
  };
}

// ============================================
// Type Exports
// ============================================

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type ProductFilter = z.infer<typeof productFilterSchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;
