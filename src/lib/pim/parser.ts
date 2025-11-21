/**
 * File Parser for Product Imports
 * Supports CSV and Excel file formats
 */

import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { IImportSource } from "../db/models/import-source";
import { IPIMProduct } from "../db/models/pim-product";
import { projectConfig } from "../../config/project.config";

export interface ParsedRow {
  entity_code: string;
  data: Partial<IPIMProduct>;
  raw: Record<string, any>;
}

/**
 * Multilingual fields that should have language suffixes
 * If these fields are provided without a language suffix (e.g., "name" instead of "name.it"),
 * they will be automatically mapped to the default language
 */
const MULTILINGUAL_FIELDS = [
  "name",
  "description",
  "short_description",
  "features",
  "specifications",
  "meta_title",
  "meta_description",
  "keywords",
];

/**
 * Parse CSV file
 */
export async function parseCSV(
  fileBuffer: Buffer,
  source: IImportSource
): Promise<ParsedRow[]> {
  try {
    const records = parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relaxColumnCount: true,
    });

    return records.map((row: any) => mapRowToProduct(row, source));
  } catch (error: any) {
    throw new Error(`CSV parse error: ${error.message}`);
  }
}

/**
 * Parse Excel file
 */
export async function parseExcel(
  fileBuffer: Buffer,
  source: IImportSource,
  sheetName?: string
): Promise<ParsedRow[]> {
  try {
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });

    // Use specified sheet or first sheet
    const sheet = sheetName
      ? workbook.Sheets[sheetName]
      : workbook.Sheets[workbook.SheetNames[0]];

    if (!sheet) {
      throw new Error(`Sheet ${sheetName || "first"} not found`);
    }

    const jsonData = XLSX.utils.sheet_to_json(sheet);

    return jsonData.map((row: any) => mapRowToProduct(row, source));
  } catch (error: any) {
    throw new Error(`Excel parse error: ${error.message}`);
  }
}

/**
 * Map raw row to PIM product structure using source field mapping
 */
function mapRowToProduct(
  row: Record<string, any>,
  source: IImportSource
): ParsedRow {
  const data: Partial<IPIMProduct> = {};

  // Apply field mappings
  for (const mapping of source.field_mapping) {
    const sourceValue = row[mapping.source_field];

    if (
      sourceValue !== undefined &&
      sourceValue !== null &&
      sourceValue !== ""
    ) {
      // Apply transform if specified
      let value = sourceValue;
      if (mapping.transform) {
        try {
          // Execute transform function
          const transformFn = new Function("value", `return ${mapping.transform}`);
          value = transformFn(sourceValue);
        } catch (error) {
          console.warn(
            `Transform failed for ${mapping.source_field}:`,
            error
          );
        }
      }

      // Set nested values (e.g., "brand.cprec_darti")
      setNestedValue(data, mapping.pim_field, value);
    }
  }

  // Get entity_code from mapping or default to 'sku' or 'entity_code'
  const entityCodeMapping = source.field_mapping.find(
    (m) => m.pim_field === "entity_code"
  );
  const entity_code =
    entityCodeMapping
      ? row[entityCodeMapping.source_field]
      : row["entity_code"] || row["sku"] || "";

  // Clean up incomplete array entries (gallery, features, etc.)
  cleanupIncompleteArrays(data);

  // Apply default language to multilingual fields
  applyDefaultLanguage(data);

  return {
    entity_code,
    data,
    raw: row,
  };
}

/**
 * Apply default language to multilingual fields
 * If a multilingual field is provided without a language suffix,
 * move its value to the default language key
 */
function applyDefaultLanguage(data: any): void {
  const defaultLang = projectConfig.defaultLanguage;

  for (const field of MULTILINGUAL_FIELDS) {
    // Check if the field exists without language suffix
    if (data[field] !== undefined && data[field] !== null && data[field] !== "") {
      // Check if it's already a language object (e.g., { it: "...", en: "..." })
      const isLanguageObject = typeof data[field] === "object" &&
                                !Array.isArray(data[field]) &&
                                data[field] !== null;

      if (!isLanguageObject) {
        // Move the plain value to the default language
        const plainValue = data[field];
        data[field] = {
          [defaultLang]: plainValue
        };

        console.log(`📝 Applied default language '${defaultLang}' to field '${field}'`);
      }
    }
  }
}

/**
 * Remove incomplete entries from arrays
 * (e.g., gallery items missing required fields, features with empty values)
 */
function cleanupIncompleteArrays(data: any): void {
  // Clean up gallery - remove entries missing required fields
  if (data.gallery && Array.isArray(data.gallery)) {
    data.gallery = data.gallery.filter((item: any) =>
      item && item.id && item.thumbnail && item.original
    );
    // Remove gallery array if empty
    if (data.gallery.length === 0) {
      delete data.gallery;
    }
  }

  // Clean up features - remove entries with empty label or value
  if (data.features && Array.isArray(data.features)) {
    data.features = data.features.filter((item: any) =>
      item && item.label && item.value
    );
    // Remove features array if empty
    if (data.features.length === 0) {
      delete data.features;
    }
  }

  // Clean up tags - remove entries with empty required fields
  if (data.tag && Array.isArray(data.tag)) {
    data.tag = data.tag.filter((item: any) =>
      item && item.id && item.name && item.slug
    );
    if (data.tag.length === 0) {
      delete data.tag;
    }
  }

  // Clean up docs - remove entries with empty required fields
  if (data.docs && Array.isArray(data.docs)) {
    data.docs = data.docs.filter((item: any) =>
      item && item.id && item.url
    );
    if (data.docs.length === 0) {
      delete data.docs;
    }
  }

  // Clean up meta - remove entries with empty key or value
  if (data.meta && Array.isArray(data.meta)) {
    data.meta = data.meta.filter((item: any) =>
      item && item.key && item.value
    );
    if (data.meta.length === 0) {
      delete data.meta;
    }
  }
}

/**
 * Set nested object value by path (e.g., "brand.name", "gallery.0.original")
 * Handles both nested objects and array indices
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split(".");
  const lastKey = keys.pop()!;

  let current = obj;
  for (const key of keys) {
    // Check if this is an array index (e.g., "0", "1", "2")
    const isArrayIndex = /^\d+$/.test(key);

    if (isArrayIndex) {
      const index = parseInt(key);
      // Initialize array if it doesn't exist
      if (!Array.isArray(current)) {
        throw new Error(`Expected array but found ${typeof current} at path ${keys.join('.')}`);
      }
      // Ensure array has enough slots
      while (current.length <= index) {
        current.push({});
      }
      current = current[index];
    } else {
      // Regular object key
      if (!current[key]) {
        // Check if next key is an array index to determine if we need an array or object
        const nextKeyIndex = keys.indexOf(key) + 1;
        const nextKey = nextKeyIndex < keys.length ? keys[nextKeyIndex] : lastKey;
        const nextIsArrayIndex = /^\d+$/.test(nextKey);

        current[key] = nextIsArrayIndex ? [] : {};
      }
      current = current[key];
    }
  }

  // Set the final value
  const isArrayIndex = /^\d+$/.test(lastKey);
  if (isArrayIndex) {
    const index = parseInt(lastKey);
    if (!Array.isArray(current)) {
      throw new Error(`Expected array but found ${typeof current}`);
    }
    while (current.length <= index) {
      current.push(undefined);
    }
    current[index] = value;
  } else {
    current[lastKey] = value;
  }
}

/**
 * Get nested value by path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

/**
 * Detect file type from buffer
 */
export function detectFileType(
  fileBuffer: Buffer,
  fileName?: string
): "csv" | "excel" | "unknown" {
  // Try filename extension first
  if (fileName) {
    const ext = fileName.toLowerCase().split(".").pop();
    if (ext === "csv") return "csv";
    if (ext === "xlsx" || ext === "xls") return "excel";
  }

  // Try to detect from buffer signature
  const signature = fileBuffer.slice(0, 4).toString("hex");

  // Excel files start with PK (ZIP signature: 504b0304)
  if (signature.startsWith("504b")) return "excel";

  // CSV is plain text, check if it's valid UTF-8
  try {
    const text = fileBuffer.toString("utf8", 0, Math.min(1000, fileBuffer.length));
    if (text.includes(",") || text.includes(";")) {
      return "csv";
    }
  } catch {
    // Not UTF-8
  }

  return "unknown";
}

/**
 * Validate parsed data before import
 */
export function validateParsedData(
  rows: ParsedRow[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (rows.length === 0) {
    errors.push("No data rows found");
    return { valid: false, errors };
  }

  // Check for missing entity_codes
  const missingCodes = rows.filter((r) => !r.entity_code);
  if (missingCodes.length > 0) {
    errors.push(
      `${missingCodes.length} rows missing entity_code (first row: ${JSON.stringify(missingCodes[0].raw).substring(0, 100)})`
    );
  }

  // Check for duplicate entity_codes
  const codes = rows.map((r) => r.entity_code).filter(Boolean);
  const duplicates = codes.filter(
    (code, index) => codes.indexOf(code) !== index
  );
  if (duplicates.length > 0) {
    errors.push(
      `Duplicate entity_codes found: ${[...new Set(duplicates)].slice(0, 5).join(", ")}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create sample field mapping for common fields
 * Helps users get started with mapping configuration
 */
export function createSampleMapping(): IImportSource["field_mapping"] {
  return [
    { source_field: "SKU", pim_field: "sku" },
    { source_field: "Code", pim_field: "entity_code" },
    { source_field: "Title", pim_field: "title" },
    { source_field: "Description", pim_field: "description" },
    { source_field: "ShortDescription", pim_field: "short_description" },
    { source_field: "Price", pim_field: "price", transform: "parseFloat(value)" },
    { source_field: "SalePrice", pim_field: "sale_price", transform: "parseFloat(value)" },
    { source_field: "Quantity", pim_field: "stock_quantity", transform: "parseInt(value)" },
    { source_field: "Brand", pim_field: "brand.tprec_darti" },
    { source_field: "BrandCode", pim_field: "brand.cprec_darti" },
    { source_field: "Category", pim_field: "category.name" },
    { source_field: "CategoryCode", pim_field: "category.code" },
    { source_field: "Image1", pim_field: "images[0].url" },
    { source_field: "Model", pim_field: "model" },
  ];
}
