/**
 * B2B Product Model
 * MongoDB model for B2B product catalog management
 */

import mongoose from "mongoose";
import type { B2BProduct } from "@/lib/types/b2b";

const { Schema, models, model } = mongoose;

const B2BProductSchema = new Schema<B2BProduct>(
  {
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["enhanced", "not_enhanced", "needs_attention", "missing_data"],
      default: "not_enhanced",
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    marketingContent: {
      type: String,
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },
    price: {
      type: Number,
      min: 0,
    },
    stock: {
      type: Number,
      min: 0,
      default: 0,
    },
    erpData: {
      type: Schema.Types.Mixed,
    },
    lastSyncedAt: {
      type: Date,
    },
    enhancedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Additional indexes for faster queries (sku already indexed via unique: true)
B2BProductSchema.index({ status: 1 });
B2BProductSchema.index({ category: 1 });
B2BProductSchema.index({ lastSyncedAt: -1 });
B2BProductSchema.index({ title: "text" }); // Text search index

export const B2BProductModel = models.B2BProduct ?? model("B2BProduct", B2BProductSchema);
