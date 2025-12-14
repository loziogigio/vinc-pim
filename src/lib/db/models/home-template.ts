import { Schema, model, models } from "mongoose";
import type { PageVersionTags } from "@/lib/types/blocks";

// Home template version
export interface HomeTemplateVersion {
  version: number;
  blocks: any[];
  seo?: any;
  status: "draft" | "published";
  label?: string;
  createdAt: string;
  lastSavedAt: string;
  publishedAt?: string;
  createdBy?: string;
  comment?: string;
  tag?: string; // Legacy single-tag label
  tags?: PageVersionTags;
  priority?: number;
  isDefault?: boolean;
  activeFrom?: string;
  activeTo?: string;
}

// Home template document (new structure: one document per version)
export interface HomeTemplateDocument {
  _id: string;
  templateId: string;
  name: string;
  version: number;
  blocks: any[];
  seo?: any;
  status: "draft" | "published";
  label?: string;
  createdAt: string;
  lastSavedAt: string;
  publishedAt?: string;
  createdBy?: string;
  comment?: string;
  tag?: string; // Legacy single-tag label
  tags?: PageVersionTags;
  priority?: number;
  isDefault?: boolean;
  activeFrom?: string;
  activeTo?: string;
  isCurrent?: boolean; // Marks the current working version
  isCurrentPublished?: boolean; // Marks the current published version
  isActive?: boolean;
  migratedFrom?: any; // Reference to original document during migration
  migratedAt?: Date;
}

// Home template schema (flat structure: each version is a separate document)
const HomeTemplateSchema = new Schema(
  {
    templateId: {
      type: String,
      required: true,
      index: true // Not unique - multiple versions can have same templateId
    },
    name: {
      type: String,
      required: true
    },
    version: {
      type: Number,
      required: true
    },
    blocks: {
      type: Schema.Types.Mixed,
      required: true
    },
    seo: {
      type: Schema.Types.Mixed
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft"
    },
    label: {
      type: String
    },
    createdAt: {
      type: String,
      required: true
    },
    lastSavedAt: {
      type: String,
      required: true
    },
    publishedAt: {
      type: String
    },
    createdBy: {
      type: String
    },
    comment: {
      type: String
    },
    tag: {
      type: String
    },
    tags: {
      campaign: { type: String },
      segment: { type: String },
      attributes: {
        type: Map,
        of: Schema.Types.Mixed, // Supports both String and [String] for addressStates
        default: undefined
      }
    },
    priority: {
      type: Number,
      default: 0
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    activeFrom: {
      type: String
    },
    activeTo: {
      type: String
    },
    isCurrent: {
      type: Boolean,
      default: false,
      index: true // Index for fast queries
    },
    isCurrentPublished: {
      type: Boolean,
      default: false,
      index: true // Index for fast queries
    },
    isActive: {
      type: Boolean,
      default: true
    },
    migratedFrom: {
      type: Schema.Types.ObjectId
    },
    migratedAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    collection: "b2bhometemplates"
  }
);

// Compound index for efficient queries
HomeTemplateSchema.index({ templateId: 1, version: 1 }, { unique: true });
HomeTemplateSchema.index({ templateId: 1, isCurrent: 1 });
HomeTemplateSchema.index({ templateId: 1, isCurrentPublished: 1 });

export const B2BHomeTemplateModel =
  models.B2BHomeTemplate || model<HomeTemplateDocument>("B2BHomeTemplate", HomeTemplateSchema);
