import mongoose, { Schema, type InferSchemaType } from "mongoose";

const BlockSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    order: { type: Number, required: true, default: 0 },
    config: { type: Schema.Types.Mixed, required: true },
    metadata: { type: Schema.Types.Mixed }
  },
  { _id: false }
);

// Version schema (can be draft or published)
const TemplateVersionSchema = new Schema(
  {
    version: { type: Number, required: true },
    blocks: { type: [BlockSchema], required: true },
    seo: { type: Schema.Types.Mixed },
    status: { type: String, enum: ["draft", "published"], required: true },
    createdAt: { type: String, required: true },
    lastSavedAt: { type: String, required: true },
    publishedAt: { type: String },
    createdBy: { type: String },
    comment: { type: String }
  },
  { _id: false }
);

const ProductTemplateSchema = new Schema(
  {
    // Template identification
    templateId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },

    // Template type and matching rules
    type: {
      type: String,
      enum: ["default", "category", "product"],
      required: true,
      index: true
    },

    // Matching criteria (only used if not default)
    matchCriteria: {
      categoryIds: { type: [String], index: true }, // Array of category IDs
      productIds: { type: [String], index: true },  // Array of specific product IDs
      tags: { type: [String] }  // Optional: match by product tags
    },

    // Priority (higher priority templates override lower ones)
    // default: 0, category: 10, product: 20
    priority: { type: Number, required: true, default: 0, index: true },

    // Template versions
    versions: { type: [TemplateVersionSchema], default: [] },
    currentVersion: { type: Number, default: 0 },
    currentPublishedVersion: { type: Number },

    // Active state
    isActive: { type: Boolean, default: true, index: true }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient template matching
ProductTemplateSchema.index({ type: 1, priority: -1, isActive: 1 });
ProductTemplateSchema.index({ 'matchCriteria.categoryIds': 1, isActive: 1 });
ProductTemplateSchema.index({ 'matchCriteria.productIds': 1, isActive: 1 });

export type ProductTemplateDocument = InferSchemaType<typeof ProductTemplateSchema> & {
  _id: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  versions?: Array<{
    version: number;
    blocks: unknown[];
    seo?: Record<string, unknown>;
    status: "draft" | "published";
    createdAt: string;
    lastSavedAt: string;
    publishedAt?: string;
    createdBy?: string;
    comment?: string;
  }>;
};

export { ProductTemplateSchema };

export const ProductTemplateModel = mongoose.models.ProductTemplate ?? mongoose.model("ProductTemplate", ProductTemplateSchema);
