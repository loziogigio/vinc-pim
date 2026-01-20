/**
 * Product Completeness Scorer
 * Calculates quality score (0-100) based on field completeness
 */

import { IPIMProduct } from "../db/models/pim-product";
import { MultilingualText } from "@/lib/types/pim";

/**
 * Helper to get text length from string or MultilingualText
 */
function getTextLength(text: string | MultilingualText | undefined): number {
  if (!text) return 0;
  if (typeof text === "string") return text.length;
  // For multilingual, get the longest translation
  const values = Object.values(text);
  if (values.length === 0) return 0;
  return Math.max(...values.map((v) => (v ? v.length : 0)));
}

/**
 * Helper to check if text has content
 */
function hasText(text: string | MultilingualText | undefined): boolean {
  return getTextLength(text) > 0;
}

/**
 * Helper to check if features has content (multilingual object or legacy array)
 */
function hasFeatures(features: IPIMProduct["features"] | string[] | undefined): boolean {
  if (!features) return false;
  // Legacy: simple array
  if (Array.isArray(features)) return features.length > 0;
  // New: multilingual object { it: [], en: [], ... }
  if (typeof features === "object") {
    return Object.values(features).some(
      (arr) => Array.isArray(arr) && arr.length > 0
    );
  }
  return false;
}

/**
 * Helper to count features
 */
function countFeatures(features: IPIMProduct["features"] | string[] | undefined): number {
  if (!features) return 0;
  // Legacy: simple array
  if (Array.isArray(features)) return features.length;
  // New: multilingual object - count max from any language
  if (typeof features === "object") {
    const counts = Object.values(features).map((arr) =>
      Array.isArray(arr) ? arr.length : 0
    );
    return Math.max(0, ...counts);
  }
  return 0;
}

/**
 * Calculate product completeness score (0-100)
 * Weighted scoring based on field importance
 */
export function calculateCompletenessScore(
  product: Partial<IPIMProduct>
): number {
  let score = 0;

  // Product name (15 points) - CRITICAL
  const nameLength = getTextLength(product.name);
  if (nameLength >= 10) {
    score += 15;
  } else if (nameLength > 0) {
    score += 7; // Partial credit for short name
  }

  // Description (10 points)
  const descLength = getTextLength(product.description);
  if (descLength >= 50) {
    score += 10;
  } else if (descLength > 0) {
    score += 5; // Partial credit
  }

  // Brand (10 points) - check for brand_id and either label or name
  const brandName = (product.brand as any)?.label || (product.brand as any)?.name;
  if (product.brand?.brand_id && brandName) {
    score += 10;
  }

  // Category (10 points)
  if (product.category?.category_id && hasText(product.category?.name)) {
    score += 10;
  }

  // Images (20 points) - CRITICAL
  // Primary image (15 points) - check images array
  if (product.images && product.images.length > 0 && product.images[0]?.url) {
    score += 15;
  }

  // Gallery - bonus for multiple images (5 points)
  if (product.images && product.images.length >= 3) {
    score += 5;
  }

  // Marketing Features (25 points)
  if (hasFeatures(product.marketing_features)) {
    const featureCount = countFeatures(product.marketing_features);
    if (featureCount >= 5) {
      score += 25;
    } else {
      score += featureCount * 5; // 5 points per feature
    }
  }

  // Packaging (10 points)
  if (product.packaging_options && product.packaging_options.length > 0) {
    score += 10;
  }

  return Math.min(score, 100);
}

/**
 * Find critical issues that need immediate attention
 */
export function findCriticalIssues(
  product: Partial<IPIMProduct>
): string[] {
  const issues: string[] = [];

  const nameLength = getTextLength(product.name);
  if (nameLength < 10) {
    issues.push("Missing or too short product name (min 10 chars)");
  }

  if (!product.images || product.images.length === 0 || !product.images[0]?.url) {
    issues.push("Missing primary product image");
  }

  const brandNameForIssues = (product.brand as any)?.label || (product.brand as any)?.name;
  if (!product.brand?.brand_id || !brandNameForIssues) {
    issues.push("Missing brand information");
  }

  if (!product.category?.category_id) {
    issues.push("Missing category");
  }

  const descLength = getTextLength(product.description);
  if (descLength < 50) {
    issues.push("Missing or too short description (min 50 chars)");
  }

  return issues;
}

/**
 * Check if all required fields are present
 */
export function validateRequiredFields(
  product: Partial<IPIMProduct>,
  requiredFields: string[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const field of requiredFields) {
    // Handle nested fields like "brand.brand_id"
    const value = field.split(".").reduce((obj: any, key) => obj?.[key], product);

    if (value === undefined || value === null || value === "") {
      missing.push(field);
    }

    // Special handling for arrays
    if (Array.isArray(value) && value.length === 0) {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get field weight for scoring
 * Returns the maximum possible points for a field
 */
export function getFieldWeight(fieldName: string): number {
  const weights: Record<string, number> = {
    name: 15,
    description: 10,
    brand: 10,
    category: 10,
    images: 15,
    gallery: 5,
    features: 25,
    packaging_options: 10,
  };

  return weights[fieldName] || 0;
}

/**
 * Get detailed scoring breakdown
 * Returns score contribution by field
 */
export function getScoreBreakdown(
  product: Partial<IPIMProduct>
): Record<string, { current: number; max: number; percentage: number }> {
  const breakdown: Record<string, { current: number; max: number; percentage: number }> = {};

  // Product name
  const nameMax = 15;
  const nameLength = getTextLength(product.name);
  let nameCurrent = 0;
  if (nameLength >= 10) {
    nameCurrent = 15;
  } else if (nameLength > 0) {
    nameCurrent = 7;
  }
  breakdown.name = {
    current: nameCurrent,
    max: nameMax,
    percentage: (nameCurrent / nameMax) * 100,
  };

  // Description
  const descMax = 10;
  const descLength = getTextLength(product.description);
  let descCurrent = 0;
  if (descLength >= 50) {
    descCurrent = 10;
  } else if (descLength > 0) {
    descCurrent = 5;
  }
  breakdown.description = {
    current: descCurrent,
    max: descMax,
    percentage: (descCurrent / descMax) * 100,
  };

  // Brand
  const brandMax = 10;
  const brandNameForBreakdown = (product.brand as any)?.label || (product.brand as any)?.name;
  const brandCurrent =
    product.brand?.brand_id && brandNameForBreakdown ? 10 : 0;
  breakdown.brand = {
    current: brandCurrent,
    max: brandMax,
    percentage: (brandCurrent / brandMax) * 100,
  };

  // Category
  const categoryMax = 10;
  const categoryCurrent =
    product.category?.category_id && hasText(product.category?.name) ? 10 : 0;
  breakdown.category = {
    current: categoryCurrent,
    max: categoryMax,
    percentage: (categoryCurrent / categoryMax) * 100,
  };

  // Primary image
  const imageMax = 15;
  const imageCurrent =
    product.images && product.images.length > 0 && product.images[0]?.url ? 15 : 0;
  breakdown.images = {
    current: imageCurrent,
    max: imageMax,
    percentage: (imageCurrent / imageMax) * 100,
  };

  // Gallery (multiple images)
  const galleryMax = 5;
  const galleryCurrent =
    product.images && product.images.length >= 3 ? 5 : 0;
  breakdown.gallery = {
    current: galleryCurrent,
    max: galleryMax,
    percentage: (galleryCurrent / galleryMax) * 100,
  };

  // Marketing Features
  const featuresMax = 25;
  let featuresCurrent = 0;
  if (hasFeatures(product.marketing_features)) {
    const featureCount = countFeatures(product.marketing_features);
    if (featureCount >= 5) {
      featuresCurrent = 25;
    } else {
      featuresCurrent = featureCount * 5;
    }
  }
  breakdown.marketing_features = {
    current: featuresCurrent,
    max: featuresMax,
    percentage: (featuresCurrent / featuresMax) * 100,
  };

  // Packaging
  const packagingMax = 10;
  const packagingCurrent =
    product.packaging_options && product.packaging_options.length > 0 ? 10 : 0;
  breakdown.packaging_options = {
    current: packagingCurrent,
    max: packagingMax,
    percentage: (packagingCurrent / packagingMax) * 100,
  };

  return breakdown;
}
