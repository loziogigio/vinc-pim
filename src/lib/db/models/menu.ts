import mongoose, { Schema, Document } from "mongoose";

export type MenuItemType =
  | "collection"
  | "category"
  | "brand"
  | "tag"
  | "product_type"
  | "product"
  | "page"
  | "url"
  | "search" // Search product link
  | "divider"; // Visual separator

export type MenuLocation = "header" | "footer" | "mobile" | "mega_menu";

export interface IMenuItem extends Document {
  menu_item_id: string;
  // wholesaler_id removed - database per wholesaler provides isolation

  // Menu location
  location: MenuLocation;

  // Item type and reference
  type: MenuItemType;
  reference_id?: string; // ID of the entity (collection_id, category_id, etc.)

  // Display settings
  label?: string; // Custom label (overrides entity name if provided)
  url?: string; // Custom URL (for type="url") or external link
  icon?: string; // Optional icon class or SVG
  rich_text?: string; // Rich text description (for search, promotions, etc.)
  image_url?: string; // Desktop image URL
  mobile_image_url?: string; // Mobile image URL

  // Hierarchy
  parent_id?: string; // Parent menu item
  level: number; // 0 = root, 1 = child, etc.
  path: string[]; // Array of parent IDs

  // Hierarchy configuration
  include_children: boolean; // Show entity's children (e.g., subcategories)
  max_depth?: number; // Max levels to show (null = all levels)

  // Positioning (for drag-drop)
  position: number; // Order within same parent

  // Visibility
  is_active: boolean;
  start_date?: Date; // Show from this date (for promotions)
  end_date?: Date; // Hide after this date

  // Display settings
  open_in_new_tab: boolean;
  css_class?: string; // Custom CSS class

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

const MenuItemSchema = new Schema<IMenuItem>(
  {
    menu_item_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // wholesaler_id removed - database per wholesaler provides isolation
    location: {
      type: String,
      enum: ["header", "footer", "mobile", "mega_menu"],
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "collection",
        "category",
        "brand",
        "tag",
        "product_type",
        "product",
        "page",
        "url",
        "search",
        "divider",
      ],
      required: true,
    },
    reference_id: {
      type: String,
      index: true,
    },
    label: {
      type: String,
      trim: true,
    },
    url: {
      type: String,
      trim: true,
    },
    icon: {
      type: String,
      trim: true,
    },
    rich_text: {
      type: String,
      trim: true,
    },
    image_url: {
      type: String,
      trim: true,
    },
    mobile_image_url: {
      type: String,
      trim: true,
    },
    parent_id: {
      type: String,
      index: true,
    },
    level: {
      type: Number,
      default: 0,
      index: true,
    },
    path: {
      type: [String],
      default: [],
    },
    include_children: {
      type: Boolean,
      default: false,
    },
    max_depth: {
      type: Number,
      min: 0,
    },
    position: {
      type: Number,
      default: 0,
      index: true,
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    start_date: {
      type: Date,
    },
    end_date: {
      type: Date,
    },
    open_in_new_tab: {
      type: Boolean,
      default: false,
    },
    css_class: {
      type: String,
      trim: true,
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

// Compound indexes - wholesaler_id removed, database provides isolation
MenuItemSchema.index({ location: 1, parent_id: 1, position: 1 });
MenuItemSchema.index({ is_active: 1, start_date: 1, end_date: 1 });
MenuItemSchema.index({ type: 1, reference_id: 1 });

export const MenuItemModel =
  mongoose.models.MenuItem || mongoose.model<IMenuItem>("MenuItem", MenuItemSchema);
