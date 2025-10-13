import { Suspense } from "react";
import type { PageBlock } from "@/lib/types/blocks";
import { BlockRenderer } from "./BlockRenderer";

interface ServerBlockRendererProps {
  block: PageBlock;
}

export const ServerBlockRenderer = ({ block }: ServerBlockRendererProps) => (
  <Suspense fallback={null}>
    <BlockRenderer block={block} />
  </Suspense>
);
