/**
 * Version Comparison Utility
 * Detect and display differences between product versions (git-like)
 */

import type { IPIMProduct } from "../db/models/pim-product";

export interface FieldChange {
  field: string;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
  changeType: "added" | "removed" | "modified";
}

export interface VersionComparison {
  oldVersion: number;
  newVersion: number;
  changes: FieldChange[];
  totalChanges: number;
}

/**
 * Compare two product versions and return detailed changes
 */
export function compareVersions(
  oldVersion: IPIMProduct,
  newVersion: IPIMProduct
): VersionComparison {
  const changes: FieldChange[] = [];

  // Fields to compare (excluding metadata)
  const fieldsToCompare = [
    "name",
    "sku",
    "description",
    "short_description",
    "long_description",
    "quantity",
    "unit",
    "product_status",
    "stock_status",
    "meta_title",
    "meta_description",
    "brand",
    "category",
    "tag",
    "features",
    "packaging_options",
  ];

  for (const field of fieldsToCompare) {
    const oldValue = (oldVersion as any)[field];
    const newValue = (newVersion as any)[field];

    if (!areValuesEqual(oldValue, newValue)) {
      const changeType = getChangeType(oldValue, newValue);
      changes.push({
        field,
        fieldLabel: getFieldLabel(field),
        oldValue,
        newValue,
        changeType,
      });
    }
  }

  return {
    oldVersion: oldVersion.version,
    newVersion: newVersion.version,
    changes,
    totalChanges: changes.length,
  };
}

/**
 * Get all changes in a version (compared to previous version)
 */
export function getVersionChanges(
  currentVersion: IPIMProduct,
  previousVersion: IPIMProduct | null
): FieldChange[] {
  if (!previousVersion) {
    return []; // First version, no changes to show
  }

  const comparison = compareVersions(previousVersion, currentVersion);
  return comparison.changes;
}

/**
 * Compare two values for equality (deep comparison)
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
 * Determine the type of change
 */
function getChangeType(oldValue: any, newValue: any): "added" | "removed" | "modified" {
  if (oldValue == null && newValue != null) return "added";
  if (oldValue != null && newValue == null) return "removed";
  return "modified";
}

/**
 * Get user-friendly field label
 */
function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    name: "Product Name",
    sku: "SKU",
    description: "Description",
    short_description: "Short Description",
    long_description: "Long Description",
    quantity: "Quantity",
    unit: "Unit",
    product_status: "Product Status",
    stock_status: "Stock Status",
    meta_title: "SEO Title",
    meta_description: "SEO Description",
    brand: "Brand",
    category: "Category",
    tag: "Tags",
    features: "Features",
    packaging_options: "Packaging Options",
  };

  return labels[field] || field.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Format value for display (user-friendly)
 */
export function formatValueForDisplay(value: any): string {
  if (value === null || value === undefined) {
    return "(empty)";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return value.toString();
  }

  if (typeof value === "string") {
    if (value.length > 200) {
      return value.substring(0, 200) + "...";
    }
    return value || "(empty)";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "(empty array)";
    if (value.length > 5) return `${value.length} items`;

    // Handle array of objects (like tags, features)
    if (value.length > 0 && typeof value[0] === "object") {
      return value.map((item) => item.name || item.label || JSON.stringify(item)).join(", ");
    }

    return value.join(", ");
  }

  if (typeof value === "object") {
    // Handle brand/category objects
    if (value.name) return value.name;
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

/**
 * Get change summary text for a version
 */
export function getChangeSummary(changes: FieldChange[]): string {
  if (changes.length === 0) return "No changes";

  const added = changes.filter((c) => c.changeType === "added").length;
  const removed = changes.filter((c) => c.changeType === "removed").length;
  const modified = changes.filter((c) => c.changeType === "modified").length;

  const parts = [];
  if (modified > 0) parts.push(`${modified} modified`);
  if (added > 0) parts.push(`${added} added`);
  if (removed > 0) parts.push(`${removed} removed`);

  return parts.join(", ");
}
