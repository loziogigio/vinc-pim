import { Schema, model, models } from "mongoose";
import type { CompanyBranding, ProductCardStyle, HomeSettings } from "@/lib/types/home-settings";

export interface HomeSettingsDocument
  extends Omit<HomeSettings, "createdAt" | "updatedAt"> {
  createdAt: Date;
  updatedAt: Date;
}

// Product card style schema
const ProductCardStyleSchema = new Schema(
  {
    borderWidth: { type: Number, default: 1, min: 0, max: 4 },
    borderColor: { type: String, default: "#EAEEF2" },
    borderStyle: {
      type: String,
      enum: ["solid", "dashed", "dotted", "none"],
      default: "solid"
    },
    shadowSize: {
      type: String,
      enum: ["none", "sm", "md", "lg", "xl", "2xl"],
      default: "none"
    },
    shadowColor: { type: String, default: "rgba(0, 0, 0, 0.1)" },
    borderRadius: {
      type: String,
      enum: ["none", "sm", "md", "lg", "xl", "2xl", "full"],
      default: "md"
    },
    hoverEffect: {
      type: String,
      enum: ["none", "lift", "shadow", "scale", "border", "glow"],
      default: "none"
    },
    hoverScale: { type: Number, default: 1.02, min: 1.0, max: 1.1 },
    hoverShadowSize: {
      type: String,
      enum: ["sm", "md", "lg", "xl", "2xl"],
      default: "lg"
    },
    backgroundColor: { type: String, default: "#ffffff" },
    hoverBackgroundColor: { type: String }
  },
  { _id: false }
);

// Company branding schema
const CompanyBrandingSchema = new Schema(
  {
    title: { type: String, required: true },
    logo: { type: String },
    favicon: { type: String },
    primaryColor: { type: String, default: "#009f7f" },
    secondaryColor: { type: String, default: "#02b290" }
  },
  { _id: false }
);

// Home settings schema
const HomeSettingsSchema = new Schema(
  {
    customerId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    branding: {
      type: CompanyBrandingSchema,
      required: true
    },
    defaultCardVariant: {
      type: String,
      enum: ["b2b", "horizontal", "compact", "detailed"],
      default: "b2b"
    },
    cardStyle: {
      type: ProductCardStyleSchema,
      default: () => ({})
    },
    lastModifiedBy: { type: String }
  },
  {
    timestamps: true,
    collection: "b2bhomesettings"
  }
);

export const B2BHomeSettingsModel =
  models.B2BHomeSettings || model<HomeSettingsDocument>("B2BHomeSettings", HomeSettingsSchema);
