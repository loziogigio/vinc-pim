import mongoose, { Schema, Document } from "mongoose";
import type { MultiLangString } from "@/lib/types/pim";

export interface IProductTypeTechnicalSpecification {
  technical_specification_id: string; // Reference to TechnicalSpecification
  required: boolean; // Override per product type
  display_order: number; // Override per product type
}

export interface IProductType extends Document {
  product_type_id: string;
  code?: string; // Customer's ERP code (e.g., "001", "010")
  // wholesaler_id removed - database per wholesaler provides isolation
  name: MultiLangString; // e.g., { it: "Contatore Acqua", en: "Water Meter" }
  slug: string;
  description?: MultiLangString;

  // Technical Specifications (references to TechnicalSpecification model)
  technical_specifications: IProductTypeTechnicalSpecification[];

  // Display Order
  display_order: number;

  // Status
  is_active: boolean;

  // Product Count (cached)
  product_count: number;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

const ProductTypeTechnicalSpecificationSchema = new Schema<IProductTypeTechnicalSpecification>(
  {
    technical_specification_id: {
      type: String,
      required: true,
    },
    required: {
      type: Boolean,
      default: false,
    },
    display_order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const ProductTypeSchema = new Schema<IProductType>(
  {
    product_type_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    code: {
      type: String,
      sparse: true, // Allow null/undefined, but enforce uniqueness when set
      index: true,
    },
    // wholesaler_id removed - database per wholesaler provides isolation
    name: {
      type: Schema.Types.Mixed, // Multilingual: { it: "...", en: "..." }
      required: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: Schema.Types.Mixed, // Multilingual: { it: "...", en: "..." }
    },
    technical_specifications: {
      type: [ProductTypeTechnicalSpecificationSchema],
      default: [],
    },
    display_order: {
      type: Number,
      default: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    product_count: {
      type: Number,
      default: 0,
    },
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

// Index for slug uniqueness (no wholesaler_id - database provides isolation)
ProductTypeSchema.index({ slug: 1 }, { unique: true });

// Index for sorting
ProductTypeSchema.index({ display_order: 1 });

// Export schema for model-registry
export { ProductTypeSchema };

export const ProductTypeModel =
  mongoose.models.ProductType || mongoose.model<IProductType>("ProductType", ProductTypeSchema);
