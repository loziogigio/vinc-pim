/**
 * Backfill Category.external_code from the source menu URL (no wipes).
 *
 * Walks every MenuItem in the given (channel, location), maps each one to
 * the Category that was created from it (matched by mapped-parent +
 * display_order + name), and writes the ERP group code parsed from
 * MenuItem.url into Category.external_code.
 *
 * Usage:
 *   node scripts/backfill-category-external-code.cjs            # dry run
 *   node scripts/backfill-category-external-code.cjs --apply    # write updates
 *
 * Env overrides:
 *   TENANT_DB=vinc-hidros-it
 *   MENU_CHANNEL=b2b
 *   MENU_LOCATION=header
 *   ROOT_CATEGORY_ID=l8uzV0JahqSA
 */
require("dotenv").config();
const mongoose = require("mongoose");

const TENANT_DB = process.env.TENANT_DB || "vinc-hidros-it";
const MENU_CHANNEL = process.env.MENU_CHANNEL || "b2b";
const MENU_LOCATION = process.env.MENU_LOCATION || "header";
const ROOT_CATEGORY_ID = process.env.ROOT_CATEGORY_ID || "l8uzV0JahqSA";
const APPLY = process.argv.includes("--apply");

function extractErpGroup(url) {
  if (!url) return null;
  const m = String(url).match(/erp_groups_ss=([^&]+)/);
  return m ? m[1] : null;
}

async function main() {
  await mongoose.connect(process.env.VINC_MONGO_URL, { dbName: TENANT_DB });
  const MenuItem = mongoose.model(
    "MenuItem",
    new mongoose.Schema({}, { strict: false }),
    "menuitems",
  );
  const Category = mongoose.model(
    "Category",
    new mongoose.Schema({}, { strict: false }),
    "categories",
  );

  console.log(`\nTenant DB:        ${TENANT_DB}`);
  console.log(`Menu source:      channel=${MENU_CHANNEL}, location=${MENU_LOCATION}`);
  console.log(`Root category id: ${ROOT_CATEGORY_ID}`);
  console.log(`Mode:             ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  const root = await Category.findOne({ category_id: ROOT_CATEGORY_ID }).lean();
  if (!root) throw new Error(`Root category ${ROOT_CATEGORY_ID} not found`);

  const menus = await MenuItem.find({ channel: MENU_CHANNEL, location: MENU_LOCATION })
    .sort({ level: 1, parent_id: 1, position: 1 })
    .lean();

  // Group menu items by parent_id (null parent → '__root__')
  const menusByParent = new Map();
  for (const m of menus) {
    const key = m.parent_id || "__root__";
    if (!menusByParent.has(key)) menusByParent.set(key, []);
    menusByParent.get(key).push(m);
  }
  // Sort each bucket by position
  for (const arr of menusByParent.values()) {
    arr.sort((a, b) => (a.position || 0) - (b.position || 0));
  }

  // BFS: menu_item_id → category_id
  const menuIdToCategoryId = new Map();
  const updates = [];
  const unmatched = [];

  async function processBucket(menuParentId, categoryParentId) {
    const bucket = menusByParent.get(menuParentId) || [];
    if (bucket.length === 0) return;

    const cats = await Category.find({ parent_id: categoryParentId })
      .sort({ display_order: 1, name: 1 })
      .lean();

    // Build (display_order|name) → category lookup, allowing for collisions
    const byKey = new Map();
    for (const c of cats) {
      const k = `${c.display_order || 0}|${(c.name || "").trim()}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(c);
    }

    for (const m of bucket) {
      const k = `${m.position || 0}|${(m.label || m.reference_id || "").trim()}`;
      const candidates = byKey.get(k) || [];
      const matched = candidates.shift(); // consume first
      if (!matched) {
        unmatched.push({
          menu_item_id: m.menu_item_id,
          label: m.label,
          position: m.position,
          category_parent: categoryParentId,
        });
        continue;
      }
      menuIdToCategoryId.set(m.menu_item_id, matched.category_id);

      const erp = extractErpGroup(m.url);
      if (erp && matched.external_code !== erp) {
        updates.push({
          category_id: matched.category_id,
          previous: matched.external_code || null,
          next: erp,
          name: matched.name,
        });
      }
    }

    // Recurse for each menu item that has children in the menu tree
    for (const m of bucket) {
      const childCategoryId = menuIdToCategoryId.get(m.menu_item_id);
      if (!childCategoryId) continue;
      await processBucket(m.menu_item_id, childCategoryId);
    }
  }

  await processBucket("__root__", ROOT_CATEGORY_ID);

  console.log(`Menu items:        ${menus.length}`);
  console.log(`Matched to cats:   ${menuIdToCategoryId.size}`);
  console.log(`Updates queued:    ${updates.length}`);
  console.log(`Unmatched:         ${unmatched.length}`);
  if (unmatched.length) {
    console.log("First 10 unmatched:", JSON.stringify(unmatched.slice(0, 10), null, 2));
  }
  if (updates.length) {
    console.log("First 10 updates:", JSON.stringify(updates.slice(0, 10), null, 2));
  }

  if (!APPLY) {
    console.log("\n[dry run] No changes written. Re-run with --apply.");
    await mongoose.connection.close();
    return;
  }

  let written = 0;
  // Bulk-write in batches
  const BATCH = 500;
  for (let i = 0; i < updates.length; i += BATCH) {
    const slice = updates.slice(i, i + BATCH);
    const ops = slice.map((u) => ({
      updateOne: {
        filter: { category_id: u.category_id },
        update: { $set: { external_code: u.next, updated_at: new Date() } },
      },
    }));
    const res = await Category.bulkWrite(ops, { ordered: false });
    written += res.modifiedCount || 0;
    console.log(`  wrote ${written}/${updates.length}`);
  }
  console.log(`\nDone. Updated ${written} categories.`);

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
