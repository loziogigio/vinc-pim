import mongoose, { Schema, Document } from "mongoose";

export interface IFeature extends Document {
  feature_id: string;
  // wholesaler_id removed - database per wholesaler provides isolation
  key: string; // e.g., "diameter", "pressure_rating", "material"
  label: string; // e.g., "Diameter", "Pressure Rating", "Material"
  type: "text" | "number" | "select" | "multiselect" | "boolean";
  unit?: string; // DEPRECATED: Legacy field for backwards compatibility
  uom_id?: string; // Reference to UOM model (preferred)
  uom?: {
    // Populated UOM data for display
    uom_id: string;
    symbol: string;
    name: string;
    category: string;
  };
  options?: string[]; // For select/multiselect types
  default_required: boolean; // Default required state when added to product types
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const FeatureSchema = new Schema<IFeature>(
  {
    feature_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // wholesaler_id removed - database per wholesaler provides isolation
    key: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["text", "number", "select", "multiselect", "boolean"],
      required: true,
    },
    unit: {
      type: String,
      // DEPRECATED: Keep for backwards compatibility
    },
    uom_id: {
      type: String,
      // Reference to UOM model (preferred over legacy 'unit' field)
    },
    options: {
      type: [String],
    },
    default_required: {
      type: Boolean,
      default: false,
    },
    display_order: {
      type: Number,
      default: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
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

// Index for key uniqueness (no wholesaler_id - database provides isolation)
FeatureSchema.index({ key: 1 }, { unique: true });

// Index for sorting (no wholesaler_id - database provides isolation)
FeatureSchema.index({ display_order: 1 });

export const FeatureModel =
  mongoose.models.Features || mongoose.model<IFeature>("Features", FeatureSchema);
