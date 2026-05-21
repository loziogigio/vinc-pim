/**
 * Data Model Definition
 *
 * Stores admin-defined dynamic data models attached to portal_users or customers.
 * Each definition materializes a physical collection `dyn_<slug>` in the tenant DB,
 * resolved at runtime by `getDataModelRecordModel` in model-registry.ts.
 *
 * Collection: datamodeldefinitions
 */

import { Schema } from "mongoose";

// ============================================
// TYPES
// ============================================

export type DataModelRelation = "portal_user" | "customer";
export type DataModelCardinality = "single" | "multiple";

export type DataModelFieldType =
  | "text"
  | "email"
  | "textarea"
  | "select"
  | "checkbox"
  | "number"
  | "date"
  | "object"
  | "array_of_objects";

export interface DataModelFieldOption {
  label: string;
  value: string;
  /** Optional badge color (tailwind token or hex), used for status-enum select fields */
  color?: string;
  /** Optional per-locale label overrides */
  i18n_labels?: Record<string, string>;
}

export interface DataModelField {
  /** Stable identifier — locked after first save. Used as the key in record `data`. */
  slug: string;
  label: string;
  type: DataModelFieldType;
  required?: boolean;
  /** select only */
  options?: DataModelFieldOption[];
  /** object / array_of_objects only */
  fields?: DataModelField[];
  /** Field is queryable as a filter on list endpoints (server adds a Mongo index) */
  filterable?: boolean;
  /** At most one field per model: its value becomes the upsert idempotency key */
  is_external_ref?: boolean;
}

export interface IDataModelDefinition {
  _id?: string;
  name: string;
  /** URL slug — locked after creation. Drives collection name `dyn_<slug>`. */
  slug: string;
  relation: DataModelRelation;
  cardinality: DataModelCardinality;
  /** SalesChannel code, or "*" for any */
  channel: string;
  fields: DataModelField[];
  /** Computed on save: slug of the field with is_external_ref=true */
  external_ref_field?: string;
  /** When true, the b2b storefront `/me` read endpoints expose this model */
  readable_by_end_user: boolean;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// CONSTANTS
// ============================================

export const SLUG_REGEX = /^[a-z][a-z0-9_]*$/;
export const SLUG_MAX_LENGTH = 40;

/**
 * Slugs that would clash with built-in tenant collections.
 * The `dyn_` prefix makes physical collision impossible, but reserving these
 * keeps the URL space clean and protects against future built-in additions.
 */
export const RESERVED_SLUGS = new Set([
  "customer",
  "customers",
  "order",
  "orders",
  "product",
  "products",
  "portal_user",
  "portal_users",
  "portalusers",
  "form_definition",
  "form_definitions",
  "formdefinitions",
  "form_submission",
  "form_submissions",
  "formsubmissions",
  "api_key",
  "apikey",
  "apikeys",
  "user",
  "users",
  "tenant",
  "tenants",
  "sales_channel",
  "saleschannel",
  "saleschannels",
]);

// ============================================
// SCHEMA
// ============================================

const DataModelDefinitionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: SLUG_MAX_LENGTH,
      match: [
        SLUG_REGEX,
        "Slug must start with a letter and contain only lowercase letters, digits, and underscores",
      ],
    },
    relation: {
      type: String,
      required: true,
      enum: ["portal_user", "customer"],
    },
    cardinality: {
      type: String,
      required: true,
      enum: ["single", "multiple"],
    },
    channel: { type: String, required: true, trim: true, default: "*" },
    fields: { type: Schema.Types.Mixed, default: () => [] },
    external_ref_field: { type: String },
    readable_by_end_user: { type: Boolean, default: true },
    enabled: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "datamodeldefinitions",
  }
);

DataModelDefinitionSchema.index({ slug: 1 }, { unique: true });
DataModelDefinitionSchema.index({ relation: 1, channel: 1, enabled: 1 });

export { DataModelDefinitionSchema };

// ============================================
// HELPERS
// ============================================

/** Collect all field slugs at every nesting level (deduped) */
export function collectFieldSlugs(fields: DataModelField[] | undefined, prefix = ""): string[] {
  const out: string[] = [];
  for (const f of fields ?? []) {
    const path = prefix ? `${prefix}.${f.slug}` : f.slug;
    out.push(path);
    if (f.fields?.length) {
      out.push(...collectFieldSlugs(f.fields, path));
    }
  }
  return out;
}

/** Find the field slug marked is_external_ref (top-level only). Throws if more than one. */
export function findExternalRefField(fields: DataModelField[] | undefined): string | undefined {
  const marked = (fields ?? []).filter((f) => f.is_external_ref);
  if (marked.length === 0) return undefined;
  if (marked.length > 1) {
    throw new Error(
      `Only one field may be marked is_external_ref (found ${marked.length}: ${marked.map((f) => f.slug).join(", ")})`
    );
  }
  const f = marked[0];
  // Allowed idempotency-key types — anything coerced to a scalar string/number
  // in storage. Dates are stored as ISO strings so they index/compare cleanly.
  const allowed: DataModelFieldType[] = ["text", "email", "number", "date"];
  if (!allowed.includes(f.type)) {
    throw new Error(
      `is_external_ref field "${f.slug}" must be of type ${allowed.join(", ")} (got ${f.type})`
    );
  }
  return f.slug;
}

/**
 * Validate a fields[] tree for structural rules:
 * - slug regex + uniqueness within the same parent
 * - nested-only types (object, array_of_objects) must have fields[]
 * - select must have options[]
 */
export function validateFieldsTree(fields: DataModelField[] | undefined): void {
  if (!fields) return;
  const seen = new Set<string>();
  for (const f of fields) {
    if (!SLUG_REGEX.test(f.slug)) {
      throw new Error(`Invalid field slug "${f.slug}": must match ${SLUG_REGEX.source}`);
    }
    if (seen.has(f.slug)) {
      throw new Error(`Duplicate field slug "${f.slug}" within the same parent`);
    }
    seen.add(f.slug);
    if (f.type === "select") {
      if (!Array.isArray(f.options) || f.options.length === 0) {
        throw new Error(`Field "${f.slug}" of type select must have non-empty options[]`);
      }
    }
    if (f.type === "object" || f.type === "array_of_objects") {
      if (!Array.isArray(f.fields) || f.fields.length === 0) {
        throw new Error(
          `Field "${f.slug}" of type ${f.type} must have non-empty fields[]`
        );
      }
      validateFieldsTree(f.fields);
    }
  }
}
