/**
 * Language Configuration Model
 * Stores supported languages in MongoDB for true dynamic configuration
 */

import mongoose, { Schema, Document } from "mongoose";

export interface ILanguage extends Document {
  code: string;              // ISO 639-1 code (e.g., "it", "de", "en")
  name: string;              // Display name in English (e.g., "Italian", "German")
  nativeName: string;        // Native name (e.g., "Italiano", "Deutsch")
  flag?: string;             // Flag emoji (e.g., "🇮🇹", "🇩🇪", "🇬🇧")
  isDefault: boolean;        // Is this the default/fallback language?
  isEnabled: boolean;        // Is this language currently active for data entry?
  searchEnabled: boolean;    // Is search indexing enabled for this language?
  solrAnalyzer: string;      // Solr field type (e.g., "text_it", "text_de")
  direction: "ltr" | "rtl";  // Text direction
  dateFormat?: string;       // Date format for this language (e.g., "DD/MM/YYYY")
  numberFormat?: string;     // Number format (e.g., "it-IT", "de-DE")

  // Admin/Metadata
  order: number;             // Display order in language selector
  createdBy?: string;        // User who added this language
  updatedBy?: string;        // User who last updated

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

const LanguageSchema = new Schema<ILanguage>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 2,
      maxlength: 3,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nativeName: {
      type: String,
      required: true,
      trim: true,
    },
    flag: {
      type: String,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    isEnabled: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    searchEnabled: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    solrAnalyzer: {
      type: String,
      required: true,
      default: "text_general",
    },
    direction: {
      type: String,
      enum: ["ltr", "rtl"],
      required: true,
      default: "ltr",
    },
    dateFormat: {
      type: String,
    },
    numberFormat: {
      type: String,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
    createdBy: {
      type: String,
    },
    updatedBy: {
      type: String,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes
LanguageSchema.index({ code: 1, isEnabled: 1 });
LanguageSchema.index({ isDefault: 1, isEnabled: 1 });
LanguageSchema.index({ isEnabled: 1, searchEnabled: 1 });
LanguageSchema.index({ order: 1 });

// Validation: Only one default language allowed
LanguageSchema.pre("save", async function (next) {
  if (this.isDefault && this.isModified("isDefault")) {
    // Remove default flag from other languages
    await LanguageModel.updateMany(
      { _id: { $ne: this._id }, isDefault: true },
      { $set: { isDefault: false } }
    );
  }
  next();
});

export const LanguageModel =
  mongoose.models.Language || mongoose.model<ILanguage>("Language", LanguageSchema);
