/**
 * Auth-aware, leak-proof strip of per-element public visibility.
 *
 * Anonymous/public search & product responses must never contain content
 * flagged is_public:false. This removes those media items and dynamic-block
 * elements (and any block left empty) when the request is NOT authenticated.
 * Authenticated requests pass through untouched.
 *
 * Missing is_public is treated as public (the schema default is true), so
 * legacy products with no flag keep showing everything.
 *
 * See docs/superpowers/specs/2026-06-30-catalog-exclusion-facet-flag-media-visibility-design.md (Feature 3).
 */

function isHidden(item: any): boolean {
  return !!item && item.is_public === false;
}

function stripProduct(product: any): any {
  if (!product || typeof product !== "object") return product;

  let next = product;

  if (Array.isArray(product.media)) {
    const media = product.media.filter((m: any) => !isHidden(m));
    if (media.length !== product.media.length) {
      next = { ...next, media };
    }
  }

  if (Array.isArray(product.dynamic_blocks)) {
    const blocks = product.dynamic_blocks
      .map((block: any) => {
        if (!block || !Array.isArray(block.elements)) return block;
        const elements = block.elements.filter((el: any) => !isHidden(el));
        return elements.length === block.elements.length ? block : { ...block, elements };
      })
      .filter((block: any) => !Array.isArray(block?.elements) || block.elements.length > 0);
    next = { ...next, dynamic_blocks: blocks };
  }

  if (Array.isArray(product.variants) && product.variants.length) {
    next = { ...next, variants: product.variants.map((v: any) => stripProduct(v)) };
  }

  return next;
}

export function stripNonPublicForGuests(results: any[], isAuthenticated: boolean): any[] {
  if (isAuthenticated) return results;
  if (!Array.isArray(results) || results.length === 0) return results;
  return results.map((product) => stripProduct(product));
}
