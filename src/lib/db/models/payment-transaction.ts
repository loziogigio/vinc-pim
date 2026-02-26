/**
 * Payment Transaction Model
 *
 * Records every payment processed through the system.
 * Collection: "paymenttransactions"
 */

import mongoose, { Schema, Document } from "mongoose";
import {
  PAYMENT_PROVIDERS,
  PAYMENT_TYPES,
  TRANSACTION_STATUSES,
  PAYMENT_METHODS,
} from "@/lib/constants/payment";

// ============================================
// INTERFACES
// ============================================

export interface IPaymentEvent {
  event_type: string;
  status: string;
  timestamp: Date;
  provider_event_id?: string;
  metadata?: Record<string, unknown>;
}

export interface IPaymentTransaction extends Document {
  transaction_id: string;
  tenant_id: string;
  order_id?: string;
  provider: string;
  provider_payment_id: string;
  payment_type: string;

  // Amounts
  gross_amount: number;
  currency: string;
  commission_rate: number;
  commission_amount: number;
  net_amount: number;

  // Status
  status: string;
  method?: string;

  // Customer
  customer_id?: string;
  customer_email?: string;

  // Error handling
  failure_reason?: string;
  failure_code?: string;

  // Audit trail
  events: IPaymentEvent[];

  // Idempotency
  idempotency_key?: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}

// ============================================
// SUB-SCHEMAS
// ============================================

const PaymentEventSchema = new Schema<IPaymentEvent>(
  {
    event_type: { type: String, required: true },
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    provider_event_id: String,
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

// ============================================
// MAIN SCHEMA
// ============================================

export const PaymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    transaction_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tenant_id: { type: String, required: true, index: true },
    order_id: { type: String, index: true },
    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      required: true,
    },
    provider_payment_id: { type: String, required: true },
    payment_type: {
      type: String,
      enum: PAYMENT_TYPES,
      required: true,
    },

    // Amounts
    gross_amount: { type: Number, required: true },
    currency: { type: String, required: true, default: "EUR" },
    commission_rate: { type: Number, required: true, default: 0 },
    commission_amount: { type: Number, required: true, default: 0 },
    net_amount: { type: Number, required: true },

    // Status
    status: {
      type: String,
      enum: TRANSACTION_STATUSES,
      required: true,
      default: "pending",
      index: true,
    },
    method: {
      type: String,
      enum: PAYMENT_METHODS,
    },

    // Customer
    customer_id: String,
    customer_email: String,

    // Error
    failure_reason: String,
    failure_code: String,

    // Events
    events: { type: [PaymentEventSchema], default: [] },

    // Idempotency
    idempotency_key: { type: String, sparse: true, unique: true },

    // Completed
    completed_at: Date,
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "paymenttransactions",
  }
);

// Compound indexes for common queries
PaymentTransactionSchema.index({ tenant_id: 1, created_at: -1 });
PaymentTransactionSchema.index({ tenant_id: 1, status: 1 });
PaymentTransactionSchema.index({ tenant_id: 1, order_id: 1 });
PaymentTransactionSchema.index({ provider_payment_id: 1, provider: 1 });

// Default model (for standalone use)
export const PaymentTransactionModel =
  mongoose.models.PaymentTransaction ||
  mongoose.model<IPaymentTransaction>(
    "PaymentTransaction",
    PaymentTransactionSchema
  );
