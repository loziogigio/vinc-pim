import type { ContentBlockConfig } from "@/lib/types/blocks";

export interface ContentVariantMeta {
  id: ContentBlockConfig["variant"];
  label: string;
  description: string;
}

export const CONTENT_VARIANTS: ContentVariantMeta[] = [
  {
    id: "richText",
    label: "Rich Text",
    description: "HTML content block with configurable width and padding."
  },
  {
    id: "features",
    label: "Feature Grid",
    description: "Icon-based grid for value propositions."
  },
  {
    id: "testimonials",
    label: "Testimonials",
    description: "Customer quotes with rating support."
  }
];
