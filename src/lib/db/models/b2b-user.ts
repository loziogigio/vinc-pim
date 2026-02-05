/**
 * B2B User Model
 * MongoDB model for B2B user accounts
 */

import mongoose from "mongoose";
import type { B2BUser } from "@/lib/types/b2b";

const { Schema, models, model } = mongoose;

const B2BUserSchema = new Schema<B2BUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    /** VINC API user_id from SSO token (sub field). Used for notification targeting. */
    user_id: {
      type: String,
      sparse: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "manager", "viewer"],
      default: "viewer",
      required: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Additional index for faster queries (email and username already indexed via unique: true)
B2BUserSchema.index({ isActive: 1 });

export { B2BUserSchema };

export const B2BUserModel = models.B2BUser ?? model("B2BUser", B2BUserSchema);
