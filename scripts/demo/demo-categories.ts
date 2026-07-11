/**
 * VINC Demo — category-collection records for the public nav tree.
 * The catalog embeds category refs as cat_<code>/slug<code>; this materializes
 * matching Category docs so GET /api/public/categories returns a tree.
 */
import { DEMO_CATEGORIES } from "./demo-catalog.js";

export function buildDemoCategories() {
  return DEMO_CATEGORIES.map((c, i) => ({
    category_id: `cat_${c.code}`,
    name: c.name.it,
    slug: c.code,
    level: 0,
    path: [] as string[],
    display_order: i,
    channel_code: "b2b",
    is_active: true,
    product_count: 0,
  }));
}
