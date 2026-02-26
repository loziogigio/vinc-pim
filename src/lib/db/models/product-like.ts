/**
 * Product Like Model
 *
 * Tracks user likes (wishlist/favorites) per product.
 * Uses a denormalized LikeStats collection for O(1) like counts.
 *
 * Collections: productlikes, likestats
 */

import mongoose, { Schema, Document } from "mongoose";

// ============================================
// PRODUCT LIKE INTERFACE & SCHEMA
// ============================================

export interface IProductLike extends Document {
  tenant_id: string;
  user_id: string;
  sku: string;
  is_active: boolean;
  liked_at: Date;
  created_at: Date;
  updated_at: Date;
}

export const ProductLikeSchema = new Schema<IProductLike>(
  {
    tenant_id: { type: String, required: true },
    user_id: { type: String, required: true },
    sku: { type: String, required: true },
    is_active: { type: Boolean, default: true },
    liked_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "productlikes",
  }
);

// Unique: one like per user+sku per tenant
ProductLikeSchema.index({ tenant_id: 1, user_id: 1, sku: 1 }, { unique: true });
// User wishlist sorted by date
ProductLikeSchema.index({ tenant_id: 1, user_id: 1, is_active: 1, liked_at: -1 });
// Product likes + trending
ProductLikeSchema.index({ tenant_id: 1, sku: 1, is_active: 1, liked_at: -1 });
// Recent likes across all products
ProductLikeSchema.index({ tenant_id: 1, is_active: 1, liked_at: -1 });

// ============================================
// LIKE STATS INTERFACE & SCHEMA (denormalized)
// ============================================

export interface ILikeStats extends Document {
  tenant_id: string;
  sku: string;
  total_likes: number;
  last_updated: Date;
}

export const LikeStatsSchema = new Schema<ILikeStats>(
  {
    tenant_id: { type: String, required: true },
    sku: { type: String, required: true },
    total_likes: { type: Number, default: 0 },
    last_updated: { type: Date, default: Date.now },
  },
  {
    collection: "likestats",
  }
);

// Unique: one stats doc per sku per tenant
LikeStatsSchema.index({ tenant_id: 1, sku: 1 }, { unique: true });
// Popular products sort
LikeStatsSchema.index({ tenant_id: 1, total_likes: -1 });
