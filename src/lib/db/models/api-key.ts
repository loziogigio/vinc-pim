/**
 * API Key Model
 * MongoDB model for tenant API keys used for programmatic access
 */

import mongoose from "mongoose";
import { connectWithModels } from "@/lib/db/connection";

const { Schema } = mongoose;

export interface IAPIKey {
  key_id: string;           // "ak_{tenant}_{random}" - unique identifier
  secret_hash: string;      // bcrypt hash of the secret
  name: string;             // Human-friendly name
  permissions: string[];    // ["*"] = all, or specific permissions
  is_active: boolean;
  last_used_at?: Date;
  created_at: Date;
  created_by: string;       // User ID who created it
}

export interface IAPIKeyDocument extends IAPIKey, mongoose.Document {}

const APIKeySchema = new Schema<IAPIKey>(
  {
    key_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    secret_hash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    permissions: {
      type: [String],
      default: ["*"],
      validate: {
        validator: function(v: string[]) {
          const validPermissions = ["*", "pim", "orders", "customers", "import"];
          return v.every(p => validPermissions.includes(p));
        },
        message: "Invalid permission value"
      }
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    last_used_at: {
      type: Date,
    },
    created_by: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes
APIKeySchema.index({ is_active: 1 });
APIKeySchema.index({ created_by: 1 });

export { APIKeySchema };

/**
 * Get the APIKey model for a specific tenant database
 * @param tenantDb - Database name (e.g., "vinc-hidros-it")
 */
export async function getAPIKeyModel(tenantDb: string): Promise<mongoose.Model<IAPIKeyDocument>> {
  const { APIKey } = await connectWithModels(tenantDb);
  return APIKey as mongoose.Model<IAPIKeyDocument>;
}

/**
 * Available permissions for API keys
 */
export const API_KEY_PERMISSIONS = [
  { value: "*", label: "Full Access", description: "Access to all APIs" },
  { value: "pim", label: "PIM", description: "Product Information Management" },
  { value: "orders", label: "Orders", description: "Order management" },
  { value: "customers", label: "Customers", description: "Customer management" },
  { value: "import", label: "Import", description: "Import operations only" },
] as const;

export type APIKeyPermission = typeof API_KEY_PERMISSIONS[number]["value"];
