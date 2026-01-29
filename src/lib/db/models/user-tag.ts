/**
 * UserTag Model
 *
 * MongoDB model for tagging portal users to enable grouped targeting
 * in notification campaigns.
 *
 * Collection: usertags (lowercase, no underscores per CLAUDE.md)
 */

import mongoose, { Schema, Document } from "mongoose";
import { nanoid } from "nanoid";

// ============================================
// INTERFACES
// ============================================

export interface IUserTag {
  tag_id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  is_active: boolean;
  user_count: number;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface IUserTagDocument extends IUserTag, Document {}

// Embedded tag reference for PortalUser
export interface IUserTagRef {
  tag_id: string;
  name: string;
  slug: string;
  color?: string;
}

// ============================================
// HELPERS
// ============================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Italian characters
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    // Remove non-alphanumeric (except spaces and hyphens)
    .replace(/[^\w\s-]/g, "")
    // Replace spaces/underscores with hyphens
    .replace(/[\s_]+/g, "-")
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, "");
}

// ============================================
// SCHEMA
// ============================================

const UserTagSchema = new Schema<IUserTagDocument>(
  {
    tag_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `utag_${nanoid(8)}`,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    color: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    user_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    created_by: {
      type: String,
    },
    updated_by: {
      type: String,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// ============================================
// INDEXES
// ============================================

UserTagSchema.index({ slug: 1 }, { unique: true });
UserTagSchema.index({ name: 1 });
UserTagSchema.index({ is_active: 1 });

// ============================================
// HOOKS
// ============================================

UserTagSchema.pre("save", function (next) {
  if (this.isModified("name") || !this.slug) {
    this.slug = generateSlug(this.name);
  }
  next();
});

// ============================================
// STATICS
// ============================================

UserTagSchema.statics.findBySlug = function (slug: string) {
  return this.findOne({ slug, is_active: true });
};

UserTagSchema.statics.findAllActive = function () {
  return this.find({ is_active: true }).sort({ name: 1 });
};

// ============================================
// EXPORT
// ============================================

export { UserTagSchema };

export const UserTagModel =
  mongoose.models.UserTag ||
  mongoose.model<IUserTagDocument>("UserTag", UserTagSchema);
