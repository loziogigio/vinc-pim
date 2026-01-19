import mongoose, { Schema, Document } from "mongoose";

/**
 * Unit of Measurement Model
 * Centralized UOM management to prevent duplicates
 */

export interface IUOM extends Document {
  uom_id: string;
  // wholesaler_id removed - database per wholesaler provides isolation
  symbol: string; // e.g., "kg", "mm", "bar", "°C"
  name: string; // e.g., "Kilogram", "Millimeter", "Bar", "Celsius"
  category: "weight" | "length" | "pressure" | "temperature" | "volume" | "time" | "other";
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export const UOMSchema = new Schema<IUOM>(
  {
    uom_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // wholesaler_id removed - database per wholesaler provides isolation
    symbol: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["weight", "length", "pressure", "temperature", "volume", "time", "other"],
      default: "other",
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

// Index for symbol uniqueness (no wholesaler_id - database provides isolation)
UOMSchema.index({ symbol: 1 }, { unique: true });

// Index for category filtering
UOMSchema.index({ category: 1, display_order: 1 });

export const UOMModel =
  mongoose.models.UOMs || mongoose.model<IUOM>("UOMs", UOMSchema);
