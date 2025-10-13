"use client";

import { useMemo } from "react";
import { HeroSection } from "@/components/blocks/HeroSection";
import { ProductSection } from "@/components/blocks/ProductSection";
import { CategorySection } from "@/components/blocks/CategorySection";
import { ContentSection } from "@/components/blocks/ContentSection";
import { blockConfigSchema } from "@/lib/validation/blockSchemas";
import type {
  CategoryBlockConfig,
  ContentBlockConfig,
  HeroBlockConfig,
  PageBlock,
  ProductBlockConfig
} from "@/lib/types/blocks";

export interface BlockRendererProps {
  block: PageBlock;
}

export const BlockRenderer = ({ block }: BlockRendererProps) => {
  const parsedConfig = useMemo(() => {
    const result = blockConfigSchema.safeParse(block.config);
    return result.success ? result.data : null;
  }, [block.config]);

  if (!parsedConfig) {
    console.warn("Invalid block config", block);
    return null;
  }

  if (block.type.startsWith("hero")) {
    return <HeroSection config={parsedConfig as HeroBlockConfig} />;
  }

  if (block.type.startsWith("product")) {
    return <ProductSection config={parsedConfig as ProductBlockConfig} />;
  }

  if (block.type.startsWith("category")) {
    return <CategorySection config={parsedConfig as CategoryBlockConfig} />;
  }

  if (block.type.startsWith("content")) {
    return <ContentSection config={parsedConfig as ContentBlockConfig} />;
  }

  console.warn(`Unsupported block type: ${block.type}`);
  return null;
};
