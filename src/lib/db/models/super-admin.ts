/**
 * SuperAdmin Model
 *
 * Super administrators who can manage tenants.
 * Stored in vinc-admin database.
 */

import { Schema, Model, Document } from "mongoose";
import { connectToAdminDatabase } from "../admin-connection";
import bcrypt from "bcryptjs";

// ============================================
// INTERFACE
// ============================================

export interface ISuperAdmin {
  email: string;
  password_hash: string;
  name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  last_login?: Date;
}

export interface ISuperAdminDocument extends ISuperAdmin, Document {
  comparePassword(password: string): Promise<boolean>;
}

export interface ISuperAdminModel extends Model<ISuperAdminDocument> {
  findByEmail(email: string): Promise<ISuperAdminDocument | null>;
}

// ============================================
// SCHEMA
// ============================================

const SuperAdminSchema = new Schema<ISuperAdminDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password_hash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    last_login: {
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

SuperAdminSchema.index({ email: 1 }, { unique: true });

// ============================================
// METHODS
// ============================================

SuperAdminSchema.methods.comparePassword = async function (
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, this.password_hash);
};

// ============================================
// STATICS
// ============================================

SuperAdminSchema.statics.findByEmail = function (
  email: string
): Promise<ISuperAdminDocument | null> {
  return this.findOne({ email: email.toLowerCase() });
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Hash a password for storage.
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

// ============================================
// MODEL GETTER
// ============================================

let SuperAdminModel: ISuperAdminModel | null = null;

/**
 * Get the SuperAdmin model.
 * Must call connectToAdminDatabase() first.
 */
export async function getSuperAdminModel(): Promise<ISuperAdminModel> {
  if (SuperAdminModel) {
    return SuperAdminModel;
  }

  const connection = await connectToAdminDatabase();

  // Check if model already exists on this connection
  if (connection.models.SuperAdmin) {
    SuperAdminModel = connection.models.SuperAdmin as ISuperAdminModel;
  } else {
    SuperAdminModel = connection.model<ISuperAdminDocument, ISuperAdminModel>(
      "SuperAdmin",
      SuperAdminSchema
    );
  }

  return SuperAdminModel;
}
