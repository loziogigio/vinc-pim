/**
 * Security Utilities
 *
 * Centralized security functions for:
 * - NoSQL injection prevention (mongo-sanitize)
 * - Input validation (zod)
 * - XSS prevention (dompurify - client side)
 */

// Server-side validation
export {
  // MongoDB sanitization
  sanitizeMongoQuery,
  escapeRegex,
  safeRegexQuery,
  safeRegexQueryWithMatchMode,
  safeTextSearch,
  // Zod schemas
  safeString,
  searchQuerySchema,
  paginationSchema,
  sortSchema,
  productFilterSchema,
  productListQuerySchema,
  // Helper functions
  parseSearchParams,
  safeParseParams,
  buildProductFilter,
  buildSearchQuery,
  // Types
  type ProductListQuery,
  type ProductFilter,
  type PaginationParams,
  type MatchMode,
} from "./validation";
