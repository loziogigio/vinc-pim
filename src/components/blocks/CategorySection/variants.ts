import type { CategoryBlockConfig } from "@/lib/types/blocks";

export interface CategoryVariantMeta {
  id: CategoryBlockConfig["variant"];
  label: string;
  description: string;
}

export const CATEGORY_VARIANTS: CategoryVariantMeta[] = [
  {
    id: "grid",
    label: "Grid",
    description: "Responsive grid of categories with imagery support."
  },
  {
    id: "carousel",
    label: "Carousel",
    description: "Horizontal scroller ideal for quick navigation."
  }
];
