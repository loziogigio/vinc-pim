/**
 * Portal User Model
 *
 * MongoDB model for portal user accounts. Portal users can login via username/password
 * and access specific customers with address-level permissions.
 *
 * Collection: portalusers (lowercase, no underscores per CLAUDE.md)
 */

import mongoose, { Schema, Document } from "mongoose";
import type { IPortalUser, ICustomerAccess, IUserTagRef } from "@/lib/types/portal-user";
import { DEFAULT_CHANNEL } from "@/lib/constants/channel";

// ============================================
// INTERFACES
// ============================================

export interface IPortalUserDocument extends Omit<IPortalUser, "customer_access">, Document {
  customer_access: ICustomerAccess[];
}

// ============================================
// SCHEMAS
// ============================================

const CustomerAccessSchema = new Schema<ICustomerAccess>(
  {
    customer_id: { type: String, required: true },
    address_access: { type: Schema.Types.Mixed, required: true }, // "all" or string[]
  },
  { _id: false }
);

const UserTagRefSchema = new Schema<IUserTagRef>(
  {
    tag_id: { type: String, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    color: { type: String },
  },
  { _id: false }
);

const PortalUserSchema = new Schema<IPortalUserDocument>(
  {
    // Identity
    portal_user_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tenant_id: {
      type: String,
      required: true,
      index: true,
    },

    // Credentials
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    password_hash: {
      type: String,
      required: true,
    },

    // Customer access
    customer_access: {
      type: [CustomerAccessSchema],
      default: [],
    },

    // User tags for campaign targeting
    tags: {
      type: [UserTagRefSchema],
      default: [],
    },

    // Sales channel
    channel: {
      type: String,
      default: DEFAULT_CHANNEL,
    },

    // Status
    is_active: {
      type: Boolean,
      default: true,
    },
    last_login_at: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// ============================================
// INDEXES
// ============================================

// Unique username per tenant + channel (used for login)
PortalUserSchema.index(
  { tenant_id: 1, username: 1, channel: 1 },
  { unique: true }
);

// Unique email per tenant + channel
PortalUserSchema.index(
  { tenant_id: 1, email: 1, channel: 1 },
  { unique: true }
);

// Find users by customer access (for listing users who can access a customer)
PortalUserSchema.index(
  { tenant_id: 1, "customer_access.customer_id": 1 }
);

// Filter by active status
PortalUserSchema.index(
  { tenant_id: 1, is_active: 1 }
);

// Find users by tags (for campaign targeting)
PortalUserSchema.index(
  { tenant_id: 1, "tags.tag_id": 1 }
);

// ============================================
// EXPORT
// ============================================

export { PortalUserSchema };

export const PortalUserModel =
  mongoose.models.PortalUser ||
  mongoose.model<IPortalUserDocument>("PortalUser", PortalUserSchema);
