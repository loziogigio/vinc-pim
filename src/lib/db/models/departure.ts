/**
 * Departure Model
 *
 * Represents a bookable event instance (cruise sailing, hotel stay, time slot).
 * Resources are embedded for atomic capacity management via findOneAndUpdate.
 *
 * Collection: departures
 */

import mongoose, { Schema, Document } from "mongoose";
import {
  DEPARTURE_STATUSES,
  RESOURCE_TYPES,
  HOLD_TTL_MS,
} from "@/lib/constants/booking";
import type { DepartureStatus, ResourceType } from "@/lib/constants/booking";

// ============================================
// INTERFACES
// ============================================

export interface IDepartureResource {
  /** Immutable resource identifier (nanoid) */
  resource_id: string;
  resource_type: ResourceType;
  /** Child PIM product entity_code (cabin type, room type, etc.) */
  child_entity_code: string;
  /** Total capacity for this resource */
  total_capacity: number;
  /** Currently available (total - held - booked) — used for atomic $gte guard */
  available: number;
  /** Currently held (pending confirmation, TTL applies) */
  held: number;
  /** Confirmed bookings count */
  booked: number;
  /** Override PIM product's list price for this departure */
  price_override?: number;
  currency?: string;
}

export interface IDeparture extends Document {
  /** Unique departure identifier (nanoid) */
  departure_id: string;
  tenant_id: string;
  /** Parent PIM product entity_code (boat, hotel, facility) */
  product_entity_code: string;
  label: string;
  status: DepartureStatus;
  starts_at: Date;
  ends_at?: Date;
  /** Last moment to accept bookings */
  booking_cutoff_at?: Date;
  /** Hold TTL in milliseconds for bookings on this departure */
  hold_ttl_ms: number;
  /** Embedded resources with capacity counters */
  resources: IDepartureResource[];
  created_at: Date;
  updated_at: Date;
}

// ============================================
// SCHEMA
// ============================================

const DepartureResourceSchema = new Schema(
  {
    resource_id: { type: String, required: true },
    resource_type: {
      type: String,
      enum: RESOURCE_TYPES,
      required: true,
    },
    child_entity_code: { type: String, required: true },
    total_capacity: { type: Number, required: true, min: 0 },
    available: { type: Number, required: true, min: 0 },
    held: { type: Number, required: true, default: 0, min: 0 },
    booked: { type: Number, required: true, default: 0, min: 0 },
    price_override: { type: Number },
    currency: { type: String },
  },
  { _id: false }
);

export const DepartureSchema = new Schema<IDeparture>(
  {
    departure_id: { type: String, required: true, unique: true },
    tenant_id: { type: String, required: true },
    product_entity_code: { type: String, required: true },
    label: { type: String, required: true },
    status: {
      type: String,
      enum: DEPARTURE_STATUSES,
      default: "draft",
    },
    starts_at: { type: Date, required: true },
    ends_at: { type: Date },
    booking_cutoff_at: { type: Date },
    hold_ttl_ms: { type: Number, default: HOLD_TTL_MS },
    resources: [DepartureResourceSchema],
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "departures",
  }
);

// Indexes
DepartureSchema.index({ tenant_id: 1, status: 1 });
DepartureSchema.index({ tenant_id: 1, product_entity_code: 1 });
DepartureSchema.index({ tenant_id: 1, starts_at: 1 });
DepartureSchema.index({ "resources.child_entity_code": 1 });

export const DepartureModel =
  mongoose.models.Departure ||
  mongoose.model<IDeparture>("Departure", DepartureSchema);
