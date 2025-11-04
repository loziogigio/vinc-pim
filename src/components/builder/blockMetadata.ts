import type { LucideIcon } from "lucide-react";
import {
  Code,
  Columns,
  Grid3x3,
  Images,
  LayoutDashboard,
  LayoutTemplate,
  MessageSquareQuote,
  PanelsTopBottom,
  PanelsTopLeft,
  ShoppingBag,
  Sparkles,
  Table,
  Type
} from "lucide-react";

const BLOCK_DESCRIPTIONS: Record<string, string> = {
  "hero-full-width": "Large banner with image and CTA",
  "hero-split": "Balanced hero with imagery and copy",
  "hero-carousel": "Rotating hero slides for promotions",
  "product-slider": "Scrollable product showcase",
  "product-grid": "Grid layout of featured products",
  "category-grid": "Shop-by-category grid",
  "category-carousel": "Scrollable category highlights",
  "content-rich-text": "Formatted editorial content",
  "content-features": "Highlight core value propositions",
  "content-testimonials": "Customer reviews and ratings",
  "content-custom-html": "Render custom HTML exactly as provided",
  "product-data-table": "Structured specification table with text, images, and links"
};

const BLOCK_PREVIEW_STYLES: Record<string, string> = {
  "hero-full-width": "bg-gradient-to-r from-orange-500 to-purple-600 text-white",
  "hero-split": "bg-gradient-to-r from-emerald-400 to-sky-500 text-white",
  "hero-carousel": "bg-gradient-to-r from-rose-400 via-orange-500 to-amber-400 text-white",
  "product-slider": "bg-white border border-orange-100 shadow-sm",
  "product-grid": "bg-white border border-slate-200",
  "category-grid": "bg-slate-50",
  "category-carousel": "bg-orange-50",
  "content-rich-text": "bg-white border border-dashed border-slate-300",
  "content-features": "bg-blue-50",
  "content-testimonials": "bg-amber-50",
  "content-custom-html": "bg-white border border-dashed border-slate-300",
  "product-data-table": "bg-white border border-emerald-100"
};

const BLOCK_ICON_MAP: Record<string, LucideIcon> = {
  "hero-full-width": LayoutDashboard,
  "hero-split": Columns,
  "hero-carousel": Images,
  "product-slider": ShoppingBag,
  "product-grid": Grid3x3,
  "category-grid": PanelsTopLeft,
  "category-carousel": PanelsTopBottom,
  "content-rich-text": Type,
  "content-features": Sparkles,
  "content-testimonials": MessageSquareQuote,
  "content-custom-html": Code,
  "product-data-table": Table
};

export const getBlockDescription = (variantId: string): string =>
  BLOCK_DESCRIPTIONS[variantId] ?? "Configure this block";

export const getBlockPreviewClasses = (variantId: string): string =>
  BLOCK_PREVIEW_STYLES[variantId] ?? "bg-slate-100";

export const getBlockIcon = (variantId: string): LucideIcon =>
  BLOCK_ICON_MAP[variantId] ?? LayoutTemplate;
