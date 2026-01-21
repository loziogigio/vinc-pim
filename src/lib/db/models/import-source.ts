/**
 * Import Source Model
 * Configuration for product import sources
 */

import mongoose, { Schema, Document } from "mongoose";

export interface IImportSource extends Document {
  // wholesaler_id removed - database per wholesaler provides isolation
  source_id: string; // e.g., "manufacturer_acme_feed"
  source_name: string; // e.g., "ACME Manufacturing Feed"
  source_type: "api" | "csv" | "excel" | "xml" | "manual" | "manual_upload";

  // Import type: what kind of data this source imports
  import_type: "products" | "correlations";

  // Correlation-specific settings (only used when import_type: "correlations")
  correlation_settings?: {
    default_type: string; // "related", "accessory", etc.
    create_bidirectional: boolean; // Create both A→B and B→A records
    sync_mode: "replace" | "merge"; // replace: delete all first, merge: add new only
  };

  // API configuration (for source_type: "api")
  api_config?: {
    endpoint: string; // API URL
    method: "GET" | "POST";
    headers?: Record<string, string>; // Authentication, Content-Type, etc.
    params?: Record<string, string>; // Query parameters
    auth_type?: "none" | "bearer" | "api_key" | "basic";
    auth_token?: string; // Bearer token or API key
    schedule_cron?: string; // Cron schedule for auto-import
  };

  // Auto-publish configuration
  auto_publish_enabled: boolean;
  min_score_threshold: number; // 0-100
  required_fields: string[]; // ["title", "price", "images"]

  // Conflict resolution: How to handle manual vs API updates
  overwrite_level: "automatic" | "manual"; // Default: "automatic"

  // Field mapping: array of field transformations
  field_mapping: Array<{
    source_field: string;
    pim_field: string;
    transform?: string;
  }>;

  // Import limits and performance settings
  limits?: {
    max_batch_size: number; // Maximum items per batch (default: 10000)
    warn_batch_size: number; // Warning threshold (default: 5000)
    chunk_size: number; // Items per processing chunk (default: 100)
    timeout_minutes: number; // Job timeout in minutes (default: 60)
  };

  // Stats
  stats: {
    total_imports: number;
    total_products: number;
    last_import_at?: Date;
    last_import_status?: "success" | "failed" | "partial";
    avg_completeness_score: number;
  };

  // Metadata
  created_by: string;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

const ImportSourceSchema = new Schema<IImportSource>(
  {
    // wholesaler_id removed - database per wholesaler provides isolation
    source_id: { type: String, required: true, unique: true },
    source_name: { type: String, required: true },
    source_type: {
      type: String,
      enum: ["api", "csv", "excel", "xml", "manual", "manual_upload"],
      required: true,
    },

    // Import type: what kind of data this source imports
    import_type: {
      type: String,
      enum: ["products", "correlations"],
      default: "products",
    },

    // Correlation-specific settings (only used when import_type: "correlations")
    correlation_settings: {
      default_type: { type: String, default: "related" },
      create_bidirectional: { type: Boolean, default: true },
      sync_mode: { type: String, enum: ["replace", "merge"], default: "replace" },
    },

    // API configuration for API sources
    api_config: {
      endpoint: { type: String },
      method: { type: String, enum: ["GET", "POST"] },
      headers: { type: Schema.Types.Mixed },
      params: { type: Schema.Types.Mixed },
      auth_type: { type: String, enum: ["none", "bearer", "api_key", "basic"] },
      auth_token: { type: String },
      schedule_cron: { type: String },
    },

    auto_publish_enabled: { type: Boolean, default: false },
    min_score_threshold: { type: Number, default: 80, min: 0, max: 100 },
    required_fields: [{ type: String }],

    // Conflict resolution setting
    overwrite_level: {
      type: String,
      enum: ["automatic", "manual"],
      default: "automatic",
    },

    // Field mapping as array of transformations
    field_mapping: {
      type: [
        {
          source_field: { type: String, required: true },
          pim_field: { type: String, required: true },
          transform: { type: String },
        },
      ],
      default: [],
    },

    // Import limits and performance settings
    limits: {
      max_batch_size: { type: Number, default: 10000 },
      warn_batch_size: { type: Number, default: 5000 },
      chunk_size: { type: Number, default: 100 },
      timeout_minutes: { type: Number, default: 60 },
    },

    stats: {
      total_imports: { type: Number, default: 0 },
      total_products: { type: Number, default: 0 },
      last_import_at: { type: Date },
      last_import_status: {
        type: String,
        enum: ["success", "failed", "partial"],
      },
      avg_completeness_score: { type: Number, default: 0 },
    },

    created_by: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    is_active: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Export schema for model-registry
export { ImportSourceSchema };

export const ImportSourceModel =
  mongoose.models.ImportSource ||
  mongoose.model<IImportSource>("ImportSource", ImportSourceSchema);
