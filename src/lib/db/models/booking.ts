/**
 * Booking Model
 *
 * Represents a customer reservation against a departure resource.
 * Supports hold→confirm flow with TTL-based expiration.
 *
 * Collection: bookings
 */

import mongoose, { Schema, Document } from "mongoose";
import { BOOKING_STATUSES } from "@/lib/constants/booking";
import type { BookingStatus } from "@/lib/constants/booking";

// ============================================
// INTERFACE
// ============================================

export interface IBooking extends Document {
  /** Unique booking identifier (nanoid) */
  booking_id: string;
  tenant_id: string;

  // What was booked
  departure_id: string;
  /** Resource ID within the departure */
  resource_id: string;
  /** Denormalized for display — child PIM product entity_code */
  child_entity_code: string;
  /** Denormalized for display — departure label */
  departure_label: string;
  /** Denormalized for display — departure start date */
  starts_at: Date;

  // Who booked
  customer_id: string;

  // How many
  quantity: number;

  // Pricing snapshot at time of booking
  unit_price: number;
  currency: string;
  total_price: number;

  // Status
  status: BookingStatus;

  // Hold TTL (for BullMQ job scheduling)
  /** When the hold expires (set when status = "held") */
  hold_expires_at?: Date;
  /** BullMQ job ID — used to cancel the expiry job on confirm/cancel */
  hold_job_id?: string;

  // Order link (set when payment is created)
  order_id?: string;

  // Audit
  notes?: string;
  confirmed_at?: Date;
  cancelled_at?: Date;
  cancelled_by?: string;
  cancellation_reason?: string;

  created_at: Date;
  updated_at: Date;
}

// ============================================
// SCHEMA
// ============================================

export const BookingSchema = new Schema<IBooking>(
  {
    booking_id: { type: String, required: true, unique: true },
    tenant_id: { type: String, required: true },

    // What was booked
    departure_id: { type: String, required: true },
    resource_id: { type: String, required: true },
    child_entity_code: { type: String, required: true },
    departure_label: { type: String, required: true },
    starts_at: { type: Date, required: true },

    // Who booked
    customer_id: { type: String, required: true },

    // How many
    quantity: { type: Number, required: true, min: 1 },

    // Pricing snapshot
    unit_price: { type: Number, required: true },
    currency: { type: String, required: true },
    total_price: { type: Number, required: true },

    // Status
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: "held",
    },

    // Hold TTL
    hold_expires_at: { type: Date },
    hold_job_id: { type: String },

    // Order link
    order_id: { type: String },

    // Audit
    notes: { type: String },
    confirmed_at: { type: Date },
    cancelled_at: { type: Date },
    cancelled_by: { type: String },
    cancellation_reason: { type: String },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "bookings",
  }
);

// Indexes
BookingSchema.index({ tenant_id: 1, customer_id: 1 });
BookingSchema.index({ tenant_id: 1, departure_id: 1 });
BookingSchema.index({ tenant_id: 1, status: 1 });
BookingSchema.index({ hold_expires_at: 1 });
BookingSchema.index({ order_id: 1 }, { sparse: true });
BookingSchema.index({ departure_id: 1, resource_id: 1, status: 1 });

export const BookingModel =
  mongoose.models.Booking ||
  mongoose.model<IBooking>("Booking", BookingSchema);
