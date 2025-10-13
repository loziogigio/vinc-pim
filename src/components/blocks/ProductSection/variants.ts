import type { ProductBlockConfig } from "@/lib/types/blocks";

export interface ProductVariantMeta {
  id: ProductBlockConfig["variant"];
  label: string;
  description: string;
}

export const PRODUCT_VARIANTS: ProductVariantMeta[] = [
  {
    id: "slider",
    label: "Slider",
    description: "Horizontal carousel ideal for featured products."
  },
  {
    id: "grid",
    label: "Grid",
    description: "Responsive product grid with optional filters."
  }
];
