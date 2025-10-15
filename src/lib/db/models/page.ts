import { Schema, models, model, type InferSchemaType } from "mongoose";

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
const PageVersionSchema = new Schema(
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

const PageSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    // All versions (both draft and published)
    versions: { type: [PageVersionSchema], default: [] },
    // Current working version number
    currentVersion: { type: Number, default: 0 },
    // Latest published version number
    currentPublishedVersion: { type: Number },

    // Deprecated fields (kept for backwards compatibility)
    blocks: { type: [BlockSchema], default: [] },
    seo: { type: Schema.Types.Mixed },
    published: { type: Boolean, default: true },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    publishedVersion: { type: Number },
    draft: { type: Schema.Types.Mixed },
    publishedVersions: { type: [PageVersionSchema], default: [] }
  },
  {
    timestamps: true
  }
);

export type PageDocument = InferSchemaType<typeof PageSchema> & {
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

export const PageModel = models.Page ?? model("Page", PageSchema);
