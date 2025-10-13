import type { HeroBlockConfig } from "@/lib/types/blocks";

export interface HeroVariantMeta {
  id: HeroBlockConfig["variant"];
  label: string;
  description: string;
}

export const HERO_VARIANTS: HeroVariantMeta[] = [
  {
    id: "fullWidth",
    label: "Full Width",
    description: "Large background imagery with centered messaging."
  },
  {
    id: "split",
    label: "Split Layout",
    description: "Copy on one side, lifestyle photography on the other."
  },
  {
    id: "carousel",
    label: "Carousel",
    description: "Multiple hero slides rotating with CTA focus."
  }
];
