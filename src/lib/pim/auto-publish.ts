/**
 * Auto-Publish Logic
 * Determines if a product should be automatically published
 */

import { IPIMProduct } from "../db/models/pim-product";
import { IImportSource } from "../db/models/import-source";
import { calculateCompletenessScore, validateRequiredFields } from "./scorer";

export interface AutoPublishResult {
  eligible: boolean;
  reason: string;
  score?: number;
  missing_fields?: string[];
}

/**
 * Check if a product is eligible for auto-publishing
 *
 * Rules:
 * 1. Auto-publish must be enabled for the source
 * 2. Product must not have manually locked fields
 * 3. Completeness score must meet threshold
 * 4. All required fields must be present
 */
export function checkAutoPublishEligibility(
  product: IPIMProduct,
  source: IImportSource
): AutoPublishResult {
  // Rule 1: Auto-publish must be enabled for this source
  if (!source.auto_publish_enabled) {
    return {
      eligible: false,
      reason: "Auto-publish not enabled for this source",
    };
  }

  // Rule 2: Product must not be manually edited with locked fields
  if (product.manually_edited && product.locked_fields.length > 0) {
    return {
      eligible: false,
      reason: `Product has ${product.locked_fields.length} manually locked fields`,
    };
  }

  // Rule 3: Check completeness score
  const score = product.completeness_score || calculateCompletenessScore(product);
  if (score < source.min_score_threshold) {
    return {
      eligible: false,
      reason: `Score ${score} below threshold ${source.min_score_threshold}`,
      score,
    };
  }

  // Rule 4: Check required fields
  const validation = validateRequiredFields(product, source.required_fields);
  if (!validation.valid) {
    return {
      eligible: false,
      reason: `Missing required fields: ${validation.missing.join(", ")}`,
      score,
      missing_fields: validation.missing,
    };
  }

  // All checks passed - eligible for auto-publish
  return {
    eligible: true,
    reason: `Score ${score} >= ${source.min_score_threshold} threshold, all required fields present`,
    score,
  };
}

/**
 * Calculate priority score for product improvement
 * High priority = High traffic + Low quality
 *
 * Formula: (traffic_score × quality_gap) / 100
 *
 * Examples:
 * - 10,000 views, 40% complete = (100 × 60) / 100 = 60 (HIGH)
 * - 100 views, 40% complete = (1 × 60) / 100 = 0.6 (LOW)
 * - 10,000 views, 100% complete = (100 × 0) / 100 = 0 (NO PRIORITY)
 */
export function calculatePriorityScore(product: IPIMProduct): number {
  // Normalize traffic to 0-100 scale (100 views = 1 point, 10k views = 100 points)
  const trafficScore = product.analytics.views_30d / 100;

  // Quality gap: how much improvement is needed
  const qualityGap = 100 - product.completeness_score;

  // Priority = (traffic × quality_gap) / 100
  const priority = (trafficScore * qualityGap) / 100;

  return Math.round(priority * 10) / 10; // Round to 1 decimal
}

/**
 * Determine if a product should be auto-published or remain as draft
 * This is the main function used during import
 */
export function determinePublishStatus(
  product: Partial<IPIMProduct>,
  source: IImportSource
): {
  status: "draft" | "published";
  auto_publish_eligible: boolean;
  auto_publish_reason: string;
} {
  const result = checkAutoPublishEligibility(
    product as IPIMProduct,
    source
  );

  if (result.eligible) {
    return {
      status: "published",
      auto_publish_eligible: true,
      auto_publish_reason: result.reason,
    };
  } else {
    return {
      status: "draft",
      auto_publish_eligible: false,
      auto_publish_reason: result.reason,
    };
  }
}

/**
 * Check if fields should be locked from auto-import updates
 * Returns list of fields that should be locked
 */
export function getFieldsToLock(
  product: IPIMProduct,
  editedFields: string[]
): string[] {
  // Only lock fields if product was manually edited
  if (!product.manually_edited) {
    return [];
  }

  // Lock the edited fields to prevent overwrite
  const lockedFields = new Set(product.locked_fields || []);

  editedFields.forEach((field) => {
    lockedFields.add(field);
  });

  return Array.from(lockedFields);
}

/**
 * Merge new import data with existing product, respecting locked fields
 */
export function mergeWithLockedFields(
  existingProduct: IPIMProduct,
  newData: Partial<IPIMProduct>
): Partial<IPIMProduct> {
  const merged = { ...newData };

  // Don't overwrite locked fields
  existingProduct.locked_fields.forEach((field) => {
    // Handle nested fields
    if (field.includes(".")) {
      const parts = field.split(".");
      let existingValue: any = existingProduct;
      let mergedValue: any = merged;

      // Navigate to parent
      for (let i = 0; i < parts.length - 1; i++) {
        existingValue = existingValue?.[parts[i]];
        if (!mergedValue[parts[i]]) {
          mergedValue[parts[i]] = {};
        }
        mergedValue = mergedValue[parts[i]];
      }

      // Set the locked value
      const lastPart = parts[parts.length - 1];
      if (existingValue && lastPart in existingValue) {
        mergedValue[lastPart] = existingValue[lastPart];
      }
    } else {
      // Simple field
      if (field in existingProduct) {
        (merged as any)[field] = (existingProduct as any)[field];
      }
    }
  });

  return merged;
}
