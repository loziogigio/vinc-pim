/**
 * Product Completeness Scorer
 * Calculates quality score (0-100) based on field completeness
 */

import { IPIMProduct } from "../db/models/pim-product";

/**
 * Calculate product completeness score (0-100)
 * Weighted scoring based on field importance
 */
export function calculateCompletenessScore(
  product: Partial<IPIMProduct>
): number {
  let score = 0;

  // Product name (15 points) - CRITICAL
  if (product.name && product.name.length >= 10) {
    score += 15;
  } else if (product.name) {
    score += 7; // Partial credit for short name
  }

  // Description (10 points)
  if (
    product.description &&
    product.description.length >= 50
  ) {
    score += 10;
  } else if (product.description) {
    score += 5; // Partial credit
  }

  // Brand (10 points)
  if (product.brand?.id && product.brand?.name) {
    score += 10;
  }

  // Category (10 points)
  if (product.category?.id && product.category?.name) {
    score += 10;
  }

  // Images (20 points) - CRITICAL
  // Primary image (15 points)
  if (product.image?.id && product.image?.original) {
    score += 15;
  }

  // Gallery - bonus for multiple images (5 points)
  if (product.gallery && product.gallery.length >= 2) {
    score += 5;
  }

  // Features (25 points)
  if (product.features && product.features.length > 0) {
    if (product.features.length >= 5) {
      score += 25;
    } else {
      score += product.features.length * 5; // 5 points per feature
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

  if (!product.name || product.name.length < 10) {
    issues.push("Missing or too short product name (min 10 chars)");
  }

  if (!product.image?.id || !product.image?.original) {
    issues.push("Missing primary product image");
  }

  if (!product.brand?.id || !product.brand?.name) {
    issues.push("Missing brand information");
  }

  if (!product.category?.id) {
    issues.push("Missing category");
  }

  if (!product.description || product.description.length < 50) {
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
    // Handle nested fields like "brand.cprec_darti"
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
    image: 15,
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
  let nameCurrent = 0;
  if (product.name && product.name.length >= 10) {
    nameCurrent = 15;
  } else if (product.name) {
    nameCurrent = 7;
  }
  breakdown.name = {
    current: nameCurrent,
    max: nameMax,
    percentage: (nameCurrent / nameMax) * 100,
  };

  // Description
  const descMax = 10;
  let descCurrent = 0;
  if (product.description && product.description.length >= 50) {
    descCurrent = 10;
  } else if (product.description) {
    descCurrent = 5;
  }
  breakdown.description = {
    current: descCurrent,
    max: descMax,
    percentage: (descCurrent / descMax) * 100,
  };

  // Brand
  const brandMax = 10;
  const brandCurrent =
    product.brand?.id && product.brand?.name ? 10 : 0;
  breakdown.brand = {
    current: brandCurrent,
    max: brandMax,
    percentage: (brandCurrent / brandMax) * 100,
  };

  // Category
  const categoryMax = 10;
  const categoryCurrent =
    product.category?.id && product.category?.name ? 10 : 0;
  breakdown.category = {
    current: categoryCurrent,
    max: categoryMax,
    percentage: (categoryCurrent / categoryMax) * 100,
  };

  // Primary image
  const imageMax = 15;
  const imageCurrent =
    product.image?.id && product.image?.original ? 15 : 0;
  breakdown.image = {
    current: imageCurrent,
    max: imageMax,
    percentage: (imageCurrent / imageMax) * 100,
  };

  // Gallery
  const galleryMax = 5;
  const galleryCurrent =
    product.gallery && product.gallery.length >= 2 ? 5 : 0;
  breakdown.gallery = {
    current: galleryCurrent,
    max: galleryMax,
    percentage: (galleryCurrent / galleryMax) * 100,
  };

  // Features
  const featuresMax = 25;
  let featuresCurrent = 0;
  if (product.features && product.features.length > 0) {
    if (product.features.length >= 5) {
      featuresCurrent = 25;
    } else {
      featuresCurrent = product.features.length * 5;
    }
  }
  breakdown.features = {
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
