/**
 * Recurring Contract Model
 *
 * Tracks recurring payment contracts and stored tokens per customer.
 * Supports both scheduled (fixed interval) and unscheduled (on-demand) contracts.
 * Collection: "recurringcontracts"
 */

import mongoose, { Schema, Document } from "mongoose";
import { PAYMENT_PROVIDERS, CONTRACT_TYPES } from "@/lib/constants/payment";

// ============================================
// INTERFACES
// ============================================

export interface IRecurringContract extends Document {
  contract_id: string;
  tenant_id: string;
  customer_id: string;
  provider: string;
  provider_contract_id: string;
  contract_type: string;

  // Token/card info (masked)
  token_id?: string;
  card_last_four?: string;
  card_brand?: string;
  card_expiry?: string;

  // Schedule (for scheduled contracts)
  frequency_days?: number;
  max_amount?: number;
  next_charge_date?: Date;

  // Status
  status: "active" | "paused" | "cancelled" | "expired";
  expiry_date?: Date;

  // Usage tracking
  total_charges: number;
  total_amount_charged: number;
  last_charge_date?: Date;
  last_charge_amount?: number;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  cancelled_at?: Date;
}

// ============================================
// MAIN SCHEMA
// ============================================

export const RecurringContractSchema = new Schema<IRecurringContract>(
  {
    contract_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tenant_id: { type: String, required: true, index: true },
    customer_id: { type: String, required: true, index: true },
    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      required: true,
    },
    provider_contract_id: { type: String, required: true },
    contract_type: {
      type: String,
      enum: CONTRACT_TYPES,
      required: true,
    },

    // Token/card (masked)
    token_id: String,
    card_last_four: String,
    card_brand: String,
    card_expiry: String,

    // Schedule
    frequency_days: Number,
    max_amount: Number,
    next_charge_date: Date,

    // Status
    status: {
      type: String,
      enum: ["active", "paused", "cancelled", "expired"],
      default: "active",
      index: true,
    },
    expiry_date: Date,

    // Usage tracking
    total_charges: { type: Number, default: 0 },
    total_amount_charged: { type: Number, default: 0 },
    last_charge_date: Date,
    last_charge_amount: Number,

    // Cancelled
    cancelled_at: Date,
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "recurringcontracts",
  }
);

// Compound indexes
RecurringContractSchema.index({ tenant_id: 1, customer_id: 1 });
RecurringContractSchema.index({ tenant_id: 1, status: 1 });
RecurringContractSchema.index({ provider_contract_id: 1, provider: 1 });

// Default model (for standalone use)
export const RecurringContractModel =
  mongoose.models.RecurringContract ||
  mongoose.model<IRecurringContract>(
    "RecurringContract",
    RecurringContractSchema
  );
