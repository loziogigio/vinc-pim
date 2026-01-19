import mongoose, { Schema, type InferSchemaType } from "mongoose";

// Block schema (YouTube, attachments, etc.)
const BlockSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    order: { type: Number, required: true, default: 0 },
    config: { type: Schema.Types.Mixed, required: true },
    metadata: { type: Schema.Types.Mixed },
    // Product detail page placement
    zone: { type: String, enum: ["zone1", "zone2", "zone3", "zone4"] },
    tabLabel: { type: String },
    tabIcon: { type: String }
  },
  { _id: false }
);

// Version schema (draft/published versions)
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

// Match rules schema (sku, parentSku, or standard)
const MatchRulesSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["sku", "parentSku", "standard"],
      required: true,
      index: true
    },
    value: {
      type: String,
      required: true,
      index: true
    },
    priority: {
      type: Number,
      required: true,
      default: 20,
      index: true
    }
  },
  { _id: false }
);

// Main product template schema
const ProductTemplateSchema = new Schema(
  {
    templateId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true
    },

    // Simplified matching rules
    matchRules: {
      type: MatchRulesSchema,
      required: true
    },

    // Template versions
    versions: {
      type: [TemplateVersionSchema],
      default: []
    },
    currentVersion: {
      type: Number,
      default: 0
    },
    currentPublishedVersion: {
      type: Number
    },

    // Active state
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for fast queries
ProductTemplateSchema.index({
  "matchRules.type": 1,
  "matchRules.value": 1,
  "isActive": 1,
  "matchRules.priority": -1
});

// Unique constraint: one template per type+value combination
ProductTemplateSchema.index({
  "matchRules.type": 1,
  "matchRules.value": 1
}, {
  unique: true
});

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

// Export schema with alias for model-registry compatibility
export { ProductTemplateSchema as ProductTemplateSimpleSchema };

export const ProductTemplateModel =
  mongoose.models.ProductTemplate ?? mongoose.model("ProductTemplate", ProductTemplateSchema);
