import mongoose, { Schema, Document } from "mongoose";
import { CORRELATION_TYPES } from "@/lib/constants/correlation";

/**
 * Embedded product data (used for both source and target)
 */
export interface ICorrelationProductData {
  entity_code: string;
  sku?: string;
  name: Record<string, string>; // MultiLangString
  cover_image_url?: string;
  price?: number;
}

// Alias for backwards compatibility
export type ICorrelationTargetProduct = ICorrelationProductData;

/**
 * Source import tracking
 */
export interface ICorrelationSourceImport {
  source_id: string;
  source_name: string;
  imported_at: Date;
}

/**
 * Product Correlation Document Interface
 */
export interface IProductCorrelation extends Document {
  correlation_id: string;
  source_entity_code: string;
  target_entity_code: string;
  correlation_type: string;

  // Self-contained product data for display
  source_product: ICorrelationProductData;
  target_product: ICorrelationProductData;

  // Metadata
  position: number;
  is_bidirectional: boolean;
  is_active: boolean;

  // Tracking
  created_by?: string;
  source_import?: ICorrelationSourceImport;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

const CorrelationProductDataSchema = new Schema<ICorrelationProductData>(
  {
    entity_code: {
      type: String,
      required: true,
    },
    sku: String,
    name: {
      type: Schema.Types.Mixed,
      default: {},
    },
    cover_image_url: String,
    price: Number,
  },
  { _id: false }
);

const CorrelationSourceImportSchema = new Schema<ICorrelationSourceImport>(
  {
    source_id: {
      type: String,
      required: true,
    },
    source_name: String,
    imported_at: Date,
  },
  { _id: false }
);

const ProductCorrelationSchema = new Schema<IProductCorrelation>(
  {
    correlation_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    source_entity_code: {
      type: String,
      required: true,
      index: true,
    },
    target_entity_code: {
      type: String,
      required: true,
      index: true,
    },
    correlation_type: {
      type: String,
      enum: CORRELATION_TYPES,
      default: "related",
      index: true,
    },
    source_product: {
      type: CorrelationProductDataSchema,
      required: true,
    },
    target_product: {
      type: CorrelationProductDataSchema,
      required: true,
    },
    position: {
      type: Number,
      default: 0,
    },
    is_bidirectional: {
      type: Boolean,
      default: false,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    created_by: String,
    source_import: CorrelationSourceImportSchema,
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Compound index for efficient lookups
ProductCorrelationSchema.index(
  { source_entity_code: 1, correlation_type: 1, position: 1 },
  { name: "source_type_position" }
);

// Index for finding correlations by target (for reverse lookups)
ProductCorrelationSchema.index(
  { target_entity_code: 1, correlation_type: 1 },
  { name: "target_type" }
);

// Unique constraint: prevent duplicate source-target-type combinations
ProductCorrelationSchema.index(
  { source_entity_code: 1, target_entity_code: 1, correlation_type: 1 },
  { unique: true, name: "source_target_type_unique" }
);

// Export schema for model-registry
export { ProductCorrelationSchema };

export const ProductCorrelationModel =
  mongoose.models.ProductCorrelation ||
  mongoose.model<IProductCorrelation>("ProductCorrelation", ProductCorrelationSchema);
