/**
 * Role Model (tenant DB)
 * A named permission set + data-scope declaration assigned to B2BUsers.
 */
import mongoose from "mongoose";
import { nanoid } from "nanoid";
import type { PermissionKey } from "@/lib/auth/permissions/catalog";
import type { RoleScope } from "@/lib/auth/permissions/scope";
import { PRICE_ACCESS_LEVELS, type PriceAccess } from "@/lib/auth/permissions/price-access";

const { Schema } = mongoose;

export interface IRole {
  role_id: string;
  name: string;
  description?: string;
  is_system: boolean;
  permissions: PermissionKey[];
  scope: RoleScope;
  /** Tri-state price-access default for this role; users may override. */
  price_access: PriceAccess;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const ScopeSchema = new Schema(
  {
    channels:    { type: String, enum: ["all", "per_user"], default: "all", required: true },
    customers:   { type: String, enum: ["all", "per_user"], default: "all", required: true },
    price_lists: { type: String, enum: ["all", "per_user"], default: "all", required: true },
  },
  { _id: false }
);

const RoleSchema = new Schema<IRole>(
  {
    role_id: { type: String, unique: true, default: () => `role_${nanoid(8)}` },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    is_system: { type: Boolean, default: false },
    permissions: { type: [String], default: [] },
    scope: { type: ScopeSchema, default: () => ({}) },
    price_access: {
      type: String,
      enum: PRICE_ACCESS_LEVELS,
      default: "none",
      required: true,
    },
    is_active: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "roles",
  }
);

RoleSchema.index({ is_active: 1 });

export { RoleSchema };

export const RoleModel =
  mongoose.models.Role ?? mongoose.model<IRole>("Role", RoleSchema);
