import mongoose, { Schema, Document } from "mongoose";

export interface IFeature extends Document {
  feature_id: string;
  wholesaler_id: string;
  key: string; // e.g., "diameter", "pressure_rating", "material"
  label: string; // e.g., "Diameter", "Pressure Rating", "Material"
  type: "text" | "number" | "select" | "multiselect" | "boolean";
  unit?: string; // e.g., "mm", "bar", "kg"
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
    wholesaler_id: {
      type: String,
      required: true,
      index: true,
    },
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

// Compound index for wholesaler + key uniqueness
FeatureSchema.index({ wholesaler_id: 1, key: 1 }, { unique: true });

// Index for sorting
FeatureSchema.index({ wholesaler_id: 1, display_order: 1 });

export const FeatureModel =
  mongoose.models.Features || mongoose.model<IFeature>("Features", FeatureSchema);
