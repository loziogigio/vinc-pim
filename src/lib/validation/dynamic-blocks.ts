/**
 * Shared validator for per-product dynamic blocks.
 *
 * Used by BOTH the importer (src/lib/queue/import-worker.ts) and the PIM PATCH
 * route (src/app/api/b2b/pim/products/[entity_code]/route.ts). Dependency-light
 * (no Zod) so it runs in the worker and the route identically. Never throws.
 *
 * See docs/superpowers/specs/2026-06-05-dynamic-blocks-design.md (§2 Validation).
 */
import { isValidLanguageCode } from "@/config/languages";
import type {
  BlockElement,
  DynamicBlock,
  DynamicBlockSection,
} from "@/lib/types/dynamic-blocks";
import {
  DYNAMIC_BLOCKS_MAX_COUNT,
  DYNAMIC_BLOCK_MAX_ELEMENTS,
  DYNAMIC_BLOCK_COLUMNS_MIN,
  DYNAMIC_BLOCK_COLUMNS_MAX,
  DYNAMIC_BLOCK_SECTIONS,
} from "@/lib/constants/dynamic-blocks";

export interface ValidateDynamicBlocksResult {
  valid: boolean;
  errors: string[];
}

const VALID_KINDS = new Set<BlockElement["kind"]>(["image", "video", "3d", "text"]);
const MEDIA_KINDS = new Set(["image", "video", "3d"]);

/**
 * URL safety: accept http(s) absolute and site-relative ("/...") only.
 * Reject javascript:/data:/file:/mailto: and any other protocol.
 */
function isSafeUrl(raw: unknown): boolean {
  if (typeof raw !== "string" || raw.trim() === "") return false;
  const value = raw.trim();

  // Site-relative path: single leading "/" (not protocol-relative "//").
  if (value.startsWith("/") && !value.startsWith("//")) return true;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

function validateElement(
  el: unknown,
  blockIdx: number,
  elIdx: number,
  errors: string[]
): void {
  const where = `block[${blockIdx}].elements[${elIdx}]`;
  if (typeof el !== "object" || el === null) {
    errors.push(`${where}: element must be an object`);
    return;
  }
  const e = el as Record<string, unknown>;

  if (typeof e.id !== "string" || e.id.trim() === "") {
    errors.push(`${where}: missing/invalid id`);
  }

  if (typeof e.kind !== "string" || !VALID_KINDS.has(e.kind as BlockElement["kind"])) {
    errors.push(`${where}: invalid kind "${String(e.kind)}"`);
    return; // can't discriminate shape without a valid kind
  }

  if (e.kind === "text") {
    if (typeof e.text !== "string" || e.text === "") {
      errors.push(`${where}: text element must carry a non-empty "text"`);
    }
    if ("media" in e && e.media !== undefined) {
      errors.push(`${where}: text element must not carry "media"`);
    }
  } else if (MEDIA_KINDS.has(e.kind)) {
    const media = e.media as Record<string, unknown> | undefined;
    if (typeof media !== "object" || media === null) {
      errors.push(`${where}: ${e.kind} element must carry "media"`);
    } else if (typeof media.url !== "string" || media.url.trim() === "") {
      errors.push(`${where}: ${e.kind} element must carry a non-empty "media.url"`);
    } else if (!isSafeUrl(media.url)) {
      errors.push(`${where}: unsafe media.url "${String(media.url)}"`);
    }
    if ("text" in e && e.text !== undefined) {
      errors.push(`${where}: ${e.kind} element must not carry "text"`);
    }
  }

  // Optional link safety (applies to every kind).
  if ("link" in e && e.link !== undefined) {
    const link = e.link as Record<string, unknown> | undefined;
    if (typeof link !== "object" || link === null) {
      errors.push(`${where}: link must be an object`);
    } else {
      if (typeof link.href !== "string" || !isSafeUrl(link.href)) {
        errors.push(`${where}: unsafe or missing link.href "${String(link?.href)}"`);
      }
      if (typeof link.new_tab !== "boolean") {
        errors.push(`${where}: link.new_tab must be a boolean`);
      }
    }
  }
}

function validateBlock(block: unknown, idx: number, errors: string[]): void {
  const where = `block[${idx}]`;
  if (typeof block !== "object" || block === null) {
    errors.push(`${where}: block must be an object`);
    return;
  }
  const b = block as Partial<DynamicBlock> & Record<string, unknown>;

  if (typeof b.id !== "string" || b.id.trim() === "") {
    errors.push(`${where}: missing/invalid id`);
  }

  if (typeof b.lang !== "string" || !isValidLanguageCode(b.lang)) {
    errors.push(`${where}: invalid catalog lang "${String(b.lang)}"`);
  }

  if (
    typeof b.section !== "number" ||
    !DYNAMIC_BLOCK_SECTIONS.includes(b.section as DynamicBlockSection)
  ) {
    errors.push(`${where}: section must be one of ${DYNAMIC_BLOCK_SECTIONS.join("/")}`);
  }

  if (
    typeof b.columns !== "number" ||
    !Number.isInteger(b.columns) ||
    (b.columns as number) < DYNAMIC_BLOCK_COLUMNS_MIN ||
    (b.columns as number) > DYNAMIC_BLOCK_COLUMNS_MAX
  ) {
    errors.push(
      `${where}: columns must be an integer in ${DYNAMIC_BLOCK_COLUMNS_MIN}..${DYNAMIC_BLOCK_COLUMNS_MAX}`
    );
  }

  if (typeof b.order !== "number" || !Number.isFinite(b.order)) {
    errors.push(`${where}: order must be a number`);
  }

  if (typeof b.is_active !== "boolean") {
    errors.push(`${where}: is_active must be a boolean`);
  }

  if (!Array.isArray(b.elements)) {
    errors.push(`${where}: elements must be an array`);
  } else {
    if (b.elements.length > DYNAMIC_BLOCK_MAX_ELEMENTS) {
      errors.push(
        `${where}: too many elements (${b.elements.length} > ${DYNAMIC_BLOCK_MAX_ELEMENTS})`
      );
    }
    b.elements.forEach((el, elIdx) => validateElement(el, idx, elIdx, errors));
  }
}

/**
 * Validate a `dynamic_blocks` payload. Returns `{ valid, errors }`; on success
 * `errors` is empty. Never throws.
 */
export function validateDynamicBlocks(blocks: unknown): ValidateDynamicBlocksResult {
  const errors: string[] = [];

  if (!Array.isArray(blocks)) {
    return { valid: false, errors: ["dynamic_blocks must be an array"] };
  }

  if (blocks.length > DYNAMIC_BLOCKS_MAX_COUNT) {
    errors.push(`too many blocks (${blocks.length} > ${DYNAMIC_BLOCKS_MAX_COUNT})`);
  }

  blocks.forEach((block, idx) => validateBlock(block, idx, errors));

  return { valid: errors.length === 0, errors };
}
