/**
 * Dynamic Blocks — caps & enum bounds (single source of truth).
 *
 * Used by the shared validator (src/lib/validation/dynamic-blocks.ts), the PIM
 * editor (cap messages / disabled "Add" buttons), and the importer.
 * See docs/superpowers/specs/2026-06-05-dynamic-blocks-design.md (§2).
 */
import type {
  DynamicBlockSection,
  DynamicBlockColumns,
} from "@/lib/types/dynamic-blocks";

/** Max number of blocks per product. */
export const DYNAMIC_BLOCKS_MAX_COUNT = 20;

/** Max number of elements per block. */
export const DYNAMIC_BLOCK_MAX_ELEMENTS = 24;

/** Inclusive columns bounds (elements-per-row). */
export const DYNAMIC_BLOCK_COLUMNS_MIN: DynamicBlockColumns = 1;
export const DYNAMIC_BLOCK_COLUMNS_MAX: DynamicBlockColumns = 8;

/** Valid page zones / sections, in order. */
export const DYNAMIC_BLOCK_SECTIONS = [1, 2, 3, 4] as const satisfies readonly DynamicBlockSection[];
