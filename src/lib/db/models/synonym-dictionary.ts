import mongoose, { Schema, Document } from "mongoose";

export interface ISynonymDictionary extends Document {
  dictionary_id: string;
  key: string;
  description?: string;
  terms: string[];
  locale: string;
  is_active: boolean;
  product_count: number;
  display_order: number;
  created_at: Date;
  updated_at: Date;
}

const SynonymDictionarySchema = new Schema<ISynonymDictionary>(
  {
    dictionary_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    terms: {
      type: [String],
      default: [],
    },
    locale: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    product_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    display_order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// Unique constraint: key + locale combination must be unique
SynonymDictionarySchema.index({ key: 1, locale: 1 }, { unique: true });

// Indexes for efficient querying
SynonymDictionarySchema.index({ locale: 1 });
SynonymDictionarySchema.index({ is_active: 1 });
SynonymDictionarySchema.index({ display_order: 1 });
SynonymDictionarySchema.index({ terms: 1 }); // For autocomplete search

// Pre-save hook to ensure key is properly formatted
SynonymDictionarySchema.pre("save", function (next) {
  if (this.key) {
    this.key = this.key
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  // Normalize terms (trim whitespace, remove empty)
  if (this.terms) {
    this.terms = this.terms
      .map((term) => term.trim().toLowerCase())
      .filter((term) => term.length > 0);
  }
  next();
});

export { SynonymDictionarySchema };

export const SynonymDictionaryModel =
  mongoose.models.SynonymDictionary ||
  mongoose.model<ISynonymDictionary>("SynonymDictionary", SynonymDictionarySchema);
