/**
 * Product Reminder Model
 *
 * Tracks back-in-stock reminder subscriptions per user/product.
 * Status lifecycle: active → notified | expired | cancelled
 *
 * Collection: productreminders
 */

import mongoose, { Schema, Document } from "mongoose";
import { REMINDER_STATUSES } from "@/lib/constants/reminder";
import type { ReminderStatus } from "@/lib/constants/reminder";

// ============================================
// INTERFACE
// ============================================

export interface IProductReminder extends Document {
  tenant_id: string;
  user_id: string;
  sku: string;
  status: ReminderStatus;
  email?: string;
  push_token?: string;
  is_active: boolean;
  notified_at?: Date;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// SCHEMA
// ============================================

export const ProductReminderSchema = new Schema<IProductReminder>(
  {
    tenant_id: { type: String, required: true },
    user_id: { type: String, required: true },
    sku: { type: String, required: true },
    status: {
      type: String,
      enum: REMINDER_STATUSES,
      default: "active",
    },
    email: { type: String },
    push_token: { type: String },
    is_active: { type: Boolean, default: true },
    notified_at: { type: Date },
    expires_at: { type: Date },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "productreminders",
  }
);

// Only one active reminder per user+sku per tenant
ProductReminderSchema.index(
  { tenant_id: 1, user_id: 1, sku: 1 },
  { unique: true, partialFilterExpression: { is_active: true } }
);
// User reminders list
ProductReminderSchema.index({ tenant_id: 1, user_id: 1, created_at: -1 });
// Product stats
ProductReminderSchema.index({ tenant_id: 1, sku: 1, status: 1 });
// Expiration cleanup
ProductReminderSchema.index({ tenant_id: 1, expires_at: 1, status: 1 });
