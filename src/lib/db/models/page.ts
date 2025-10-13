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

const PageSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    blocks: { type: [BlockSchema], default: [] },
    seo: { type: Schema.Types.Mixed },
    published: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

export type PageDocument = InferSchemaType<typeof PageSchema> & {
  _id: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const PageModel = models.Page ?? model("Page", PageSchema);
