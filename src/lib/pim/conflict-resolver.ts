/**
 * Conflict Resolution Logic
 * Handles conflicts between manual edits and API updates
 */

import type { IPIMProduct } from "../db/models/pim-product";
import type { IImportSource } from "../db/models/import-source";

interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflictData: Array<{
    field: string;
    manual_value: any;
    api_value: any;
    detected_at: Date;
  }>;
  mergedData: any;
  shouldSkipFields: string[];
}

/**
 * Detect conflicts between manual edits and incoming API data
 */
export function detectConflicts(
  latestProduct: IPIMProduct | null,
  incomingData: any,
  source: IImportSource
): ConflictDetectionResult {
  const result: ConflictDetectionResult = {
    hasConflicts: false,
    conflictData: [],
    mergedData: { ...incomingData },
    shouldSkipFields: [],
  };

  // If no existing product or no manual edits, no conflicts possible
  if (!latestProduct || !latestProduct.manually_edited || !latestProduct.manually_edited_fields || latestProduct.manually_edited_fields.length === 0) {
    return result;
  }

  // If overwrite level is automatic, just overwrite everything
  if (source.overwrite_level === "automatic") {
    console.log(`[conflict-resolver] Overwrite level is automatic, skipping conflict detection`);
    return result;
  }

  // Manual mode: detect conflicts
  const manuallyEditedFields = latestProduct.manually_edited_fields;
  const now = new Date();

  for (const field of manuallyEditedFields) {
    // Skip if field is not in incoming data
    if (!(field in incomingData)) {
      continue;
    }

    const manualValue = (latestProduct as any)[field];
    const apiValue = incomingData[field];

    // Check if values are different
    if (!areValuesEqual(manualValue, apiValue)) {
      result.hasConflicts = true;
      result.conflictData.push({
        field,
        manual_value: manualValue,
        api_value: apiValue,
        detected_at: now,
      });

      // In manual mode, keep the manual value (don't overwrite)
      result.mergedData[field] = manualValue;
      result.shouldSkipFields.push(field);
    }
  }

  if (result.hasConflicts) {
    console.log(
      `[conflict-resolver] Detected ${result.conflictData.length} conflicts for product ${latestProduct.entity_code}`
    );
    console.log(`[conflict-resolver] Conflicting fields: ${result.conflictData.map((c) => c.field).join(", ")}`);
  }

  return result;
}

/**
 * Compare two values for equality (handles objects, arrays, primitives)
 */
function areValuesEqual(value1: any, value2: any): boolean {
  // Handle null/undefined
  if (value1 === value2) return true;
  if (value1 == null || value2 == null) return false;

  // Handle primitives
  if (typeof value1 !== "object" || typeof value2 !== "object") {
    return value1 === value2;
  }

  // Handle arrays
  if (Array.isArray(value1) && Array.isArray(value2)) {
    if (value1.length !== value2.length) return false;
    return value1.every((item, index) => areValuesEqual(item, value2[index]));
  }

  // Handle objects
  const keys1 = Object.keys(value1);
  const keys2 = Object.keys(value2);

  if (keys1.length !== keys2.length) return false;

  return keys1.every((key) => areValuesEqual(value1[key], value2[key]));
}

/**
 * Resolve a conflict by choosing manual or API value
 */
export function resolveConflict(
  field: string,
  choice: "manual" | "api",
  manualValue: any,
  apiValue: any
): any {
  return choice === "manual" ? manualValue : apiValue;
}

/**
 * Get user-friendly field names for display
 */
export function getFieldDisplayName(field: string): string {
  const fieldNames: Record<string, string> = {
    name: "Product Name",
    description: "Description",
    price: "Price",
    sale_price: "Sale Price",
    sku: "SKU",
    stock: "Stock Quantity",
    brand: "Brand",
    categories: "Categories",
    tags: "Tags",
    attributes: "Attributes",
    weight: "Weight",
    dimensions: "Dimensions",
  };

  return fieldNames[field] || field.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}
