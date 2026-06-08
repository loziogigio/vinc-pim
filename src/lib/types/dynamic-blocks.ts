/**
 * Dynamic Blocks — per-product rich content attached to a PIM product.
 *
 * Single source of truth for the dynamic-blocks data model. Stored on the
 * product in Mongo, excluded from Solr, attached to the storefront response by
 * the gated Mongo enrichment step. One block belongs to exactly one catalog
 * language (`lang`); the flat array holds blocks for every language mixed.
 *
 * See docs/superpowers/specs/2026-06-05-dynamic-blocks-design.md (§2).
 */

/** Page zone a block renders into on the B2B detail page. */
export type DynamicBlockSection = 1 | 2 | 3 | 4;

/** Elements-per-row for a block; the element list auto-wraps into rows. */
export type DynamicBlockColumns = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type BlockElementKind = "image" | "video" | "3d" | "text";

export interface BlockLink {
  /** http(s) absolute OR site-relative ("/..."); validated (see validation). */
  href: string;
  /** open in a new tab → target=_blank rel="noopener noreferrer". */
  new_tab: boolean;
}

export interface BlockElementBase {
  /** stable uuid (dnd ordering, React keys). */
  id: string;
  /** optional; wraps the element. */
  link?: BlockLink;
  /** optional caption, plain string in the block's lang. */
  description?: string;
}

export interface MediaElement extends BlockElementBase {
  kind: Exclude<BlockElementKind, "text">;
  media: {
    /** S3/CDN url OR external (YouTube/Vimeo) OR .glb url. */
    url: string;
    /** present when uploaded to our storage. */
    cdn_key?: string;
    is_external_link?: boolean;
    /** image alt / a11y label, plain string in block lang. */
    alt?: string;
  };
}

export interface TextElement extends BlockElementBase {
  kind: "text";
  /** plain string in the block's lang. */
  text: string;
}

export type BlockElement = MediaElement | TextElement;

export interface DynamicBlock {
  /** stable uuid. */
  id: string;
  /** THIS block's language — one of the tenant's enabled language codes. */
  lang: string;
  /** optional, plain string in `lang`. */
  title?: string;
  section: DynamicBlockSection;
  /** order within (section, lang). */
  order: number;
  columns: DynamicBlockColumns;
  /** toggle visibility without deleting (default true). */
  is_active: boolean;
  /** ordered; wraps into rows of `columns`. */
  elements: BlockElement[];
}

export type DynamicBlocks = DynamicBlock[];
