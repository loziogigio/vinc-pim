/**
 * Shared validator for per-product dynamic blocks.
 *
 * Used by BOTH the importer (src/lib/queue/import-worker.ts) and the PIM PATCH
 * route (src/app/api/b2b/pim/products/[entity_code]/route.ts). Dependency-light
 * (no Zod) so it runs in the worker and the route identically. Never throws.
 *
 * See docs/superpowers/specs/2026-06-05-dynamic-blocks-design.md (§2 Validation).
 */
import type {
  BlockElement,
  DynamicBlock,
  DynamicBlockSection,
  MediaElement,
  TextElement,
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

function validateBlock(
  block: unknown,
  idx: number,
  errors: string[],
  allowedLangCodes: string[]
): void {
  const where = `block[${idx}]`;
  if (typeof block !== "object" || block === null) {
    errors.push(`${where}: block must be an object`);
    return;
  }
  const b = block as Partial<DynamicBlock> & Record<string, unknown>;

  if (typeof b.id !== "string" || b.id.trim() === "") {
    errors.push(`${where}: missing/invalid id`);
  }

  if (typeof b.lang !== "string" || !allowedLangCodes.includes(b.lang)) {
    errors.push(`${where}: lang "${String(b.lang)}" is not an enabled language for this tenant`);
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
export function validateDynamicBlocks(
  blocks: unknown,
  allowedLangCodes: string[]
): ValidateDynamicBlocksResult {
  const errors: string[] = [];

  if (!Array.isArray(blocks)) {
    return { valid: false, errors: ["dynamic_blocks must be an array"] };
  }

  if (blocks.length > DYNAMIC_BLOCKS_MAX_COUNT) {
    errors.push(`too many blocks (${blocks.length} > ${DYNAMIC_BLOCKS_MAX_COUNT})`);
  }

  blocks.forEach((block, idx) => validateBlock(block, idx, errors, allowedLangCodes));

  return { valid: errors.length === 0, errors };
}

/**
 * Normalize a user-entered URL so people can type without the scheme:
 *  - blank stays blank;
 *  - site-relative ("/...") and already-schemed values are left as-is;
 *  - a bare domain/path ("example.com/x") gets "https://" prepended.
 * Pairs with `isSafeUrl` (which still rejects javascript:/data:/etc.). Exported so
 * the editor inputs can normalize on blur too.
 */
export function normalizeUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const v = raw.trim();
  if (v === "" || v.startsWith("/")) return v;
  // Already has a scheme (http:, https:, mailto:, javascript:, ...) — leave it;
  // isSafeUrl decides whether the scheme is allowed.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return v;
  return `https://${v}`;
}

/**
 * Drop in-progress / incomplete content so a half-built element can't wedge a
 * product save. Removes media elements (image/video/3d) with a blank `media.url`
 * and text elements with blank `text`, strips a `link` whose `href` is blank, and
 * normalizes scheme-less URLs (media + link) to https. Blocks are kept even if
 * they end up with no elements (the renderer skips empty blocks). Never throws.
 *
 * Used by the PIM editor save path so the result reliably passes
 * `validateDynamicBlocks()`.
 */
export function sanitizeDynamicBlocks(blocks: unknown): DynamicBlock[] {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((b): b is DynamicBlock => typeof b === "object" && b !== null)
    .map((block) => {
      const rawElements = Array.isArray(block.elements) ? block.elements : [];
      const elements = rawElements
        .filter((el): el is BlockElement => {
          if (!el || typeof el !== "object") return false;
          if ((el as BlockElement).kind === "text") {
            const text = (el as TextElement).text;
            return typeof text === "string" && text.trim() !== "";
          }
          if (MEDIA_KINDS.has((el as BlockElement).kind)) {
            const url = (el as MediaElement).media?.url;
            return typeof url === "string" && url.trim() !== "";
          }
          return false; // unknown/blank kind dropped
        })
        .map((el) => {
          let next: BlockElement = el;
          // Normalize a scheme-less media URL (image/video/3d) to https.
          if (next.kind !== "text") {
            const media = (next as MediaElement).media;
            next = { ...next, media: { ...media, url: normalizeUrl(media?.url) } } as BlockElement;
          }
          // Normalize the link href; strip the link entirely if it's blank.
          if (next.link) {
            const href = normalizeUrl(next.link.href);
            if (!href) {
              const { link: _drop, ...rest } = next as BlockElement & { link?: unknown };
              next = rest as BlockElement;
            } else {
              next = { ...next, link: { ...next.link, href } };
            }
          }
          return next;
        });
      return { ...block, elements };
    });
}
