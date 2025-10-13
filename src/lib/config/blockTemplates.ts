import {
  BLOCK_REGISTRY,
  getAllBlockTemplates,
  getBlockTemplate,
  DEFAULT_HOME_BLOCKS
} from "@config/blocks.config";
import type { PageBlock } from "@/lib/types/blocks";

export { BLOCK_REGISTRY, getAllBlockTemplates, getBlockTemplate, DEFAULT_HOME_BLOCKS };

export const resolveDefaultBlocks = (): PageBlock[] =>
  DEFAULT_HOME_BLOCKS.map((block, index) => ({
    ...block,
    order: typeof block.order === "number" ? block.order : index
  })) as PageBlock[];
