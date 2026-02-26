/**
 * Shipping Configuration Model
 *
 * Per-tenant shipping zones and methods with tiered pricing.
 * Singleton document per tenant — use findOne() / upsert.
 *
 * Collection: b2bshippingconfig (lowercase, no underscores, per CLAUDE.md)
 * Database: vinc-{tenant-id} (tenant database)
 */

import { Schema } from "mongoose";
import { nanoid } from "nanoid";
import type {
  IShippingConfig,
  IShippingZone,
  IShippingMethod,
  IShippingTier,
} from "@/lib/types/shipping";

// ============================================
// SUB-SCHEMAS
// ============================================

const ShippingTierSchema = new Schema<IShippingTier>(
  {
    min_subtotal: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ShippingMethodSchema = new Schema<IShippingMethod>(
  {
    method_id: {
      type: String,
      required: true,
      default: () => nanoid(8),
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    carrier: { type: String, trim: true, maxlength: 50 },
    tiers: {
      type: [ShippingTierSchema],
      required: true,
      validate: {
        validator: (tiers: IShippingTier[]) =>
          tiers.length > 0 && tiers.some((t) => t.min_subtotal === 0),
        message: "Each method must have at least one tier with min_subtotal: 0",
      },
    },
    estimated_days_min: { type: Number, min: 0 },
    estimated_days_max: { type: Number, min: 0 },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const ShippingZoneSchema = new Schema<IShippingZone>(
  {
    zone_id: {
      type: String,
      required: true,
      default: () => nanoid(8),
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    countries: {
      type: [String],
      required: true,
      validate: {
        validator: (c: string[]) => c.length > 0,
        message: "Zone must have at least one country code",
      },
    },
    methods: { type: [ShippingMethodSchema], default: [] },
  },
  { _id: false }
);

// ============================================
// MAIN SCHEMA
// ============================================

const ShippingConfigSchema = new Schema<IShippingConfig>(
  {
    zones: { type: [ShippingZoneSchema], default: [] },
  },
  {
    timestamps: { createdAt: false, updatedAt: "updated_at" },
    collection: "b2bshippingconfig",
  }
);

// ============================================
// HOOKS
// ============================================

/**
 * Ensure zone_id and method_id are populated for any new entries
 * that arrive without an ID (e.g. from PUT body with new zones).
 *
 * Uses pre('validate') so IDs are generated BEFORE Mongoose validates
 * the required constraints on zone_id and method_id.
 */
ShippingConfigSchema.pre("validate", function (next) {
  for (const zone of this.zones) {
    if (!zone.zone_id) zone.zone_id = nanoid(8);
    for (const method of zone.methods) {
      if (!method.method_id) method.method_id = nanoid(8);
    }
  }
  next();
});

export { ShippingConfigSchema };
