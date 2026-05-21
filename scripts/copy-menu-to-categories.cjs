/**
 * Copy hidros-it menu items (channel=b2b, location=header) into Categories
 * under the existing root category.
 *
 * Usage:
 *   node scripts/copy-menu-to-categories.cjs                # dry run
 *   node scripts/copy-menu-to-categories.cjs --apply        # write to DB
 *   node scripts/copy-menu-to-categories.cjs --apply --wipe # delete existing
 *                                                            descendants of
 *                                                            the root first
 *
 * Optional env overrides:
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
const WIPE = process.argv.includes("--wipe");

function slugify(input) {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 120);
}

function nano(len = 12) {
  const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

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
  console.log(`Mode:             ${APPLY ? "APPLY" : "DRY RUN"}${WIPE ? " + WIPE" : ""}\n`);

  const root = await Category.findOne({ category_id: ROOT_CATEGORY_ID }).lean();
  if (!root) {
    throw new Error(`Root category ${ROOT_CATEGORY_ID} not found in ${TENANT_DB}`);
  }
  console.log(`Root: "${root.name}" (slug=${root.slug}, channel=${root.channel_code})`);

  // Load every menu item for this location/channel, ordered top-down.
  const menus = await MenuItem.find({
    channel: MENU_CHANNEL,
    location: MENU_LOCATION,
  })
    .sort({ level: 1, parent_id: 1, position: 1 })
    .lean();

  console.log(`Menu items found: ${menus.length}`);
  if (menus.length === 0) {
    await mongoose.connection.close();
    return;
  }

  // Pre-compute existing category slugs to avoid uniqueness collisions
  // (slug index is global per tenant DB).
  const existingSlugs = new Set(
    (await Category.find({}, { slug: 1 }).lean()).map((c) => c.slug),
  );

  const menuIdToCategoryId = new Map();
  const docsToInsert = [];
  const slugCollisions = [];

  for (const m of menus) {
    // Resolve parent category id
    let parentCategoryId;
    if (!m.parent_id) {
      parentCategoryId = ROOT_CATEGORY_ID;
    } else {
      parentCategoryId = menuIdToCategoryId.get(m.parent_id);
      if (!parentCategoryId) {
        console.warn(
          `  ! skipping ${m.menu_item_id} "${m.label}" — parent ${m.parent_id} not yet mapped`,
        );
        continue;
      }
    }

    const newCategoryId = nano(12);
    menuIdToCategoryId.set(m.menu_item_id, newCategoryId);

    // Build path: root path + root + ... up through immediate parent
    let parentPath = [];
    let parentLevel = 0;
    if (parentCategoryId === ROOT_CATEGORY_ID) {
      parentPath = [...(root.path || [])];
      parentLevel = root.level || 0;
    } else {
      // Look up from already-staged docs
      const parentDoc = docsToInsert.find(
        (d) => d.category_id === parentCategoryId,
      );
      if (!parentDoc) {
        console.warn(`  ! parent doc missing for ${m.menu_item_id}`);
        continue;
      }
      parentPath = parentDoc.path;
      parentLevel = parentDoc.level;
    }
    const path = [...parentPath, parentCategoryId];
    const level = parentLevel + 1;

    // Slug — ensure uniqueness against existing categories + same-batch additions.
    const base = slugify(m.label || m.reference_id || m.menu_item_id);
    let slug = base || `menu-${m.menu_item_id}`.toLowerCase();
    if (existingSlugs.has(slug)) {
      let i = 2;
      let candidate;
      do {
        candidate = `${slug}-${i++}`;
      } while (existingSlugs.has(candidate));
      slugCollisions.push({ original: slug, resolved: candidate, label: m.label });
      slug = candidate;
    }
    existingSlugs.add(slug);

    const itemIconUrl = m.icon || m.image_url || null;
    const mobileHeroUrl = m.mobile_image_url || null;
    const erpGroup = extractErpGroup(m.url);

    const doc = {
      category_id: newCategoryId,
      external_code: erpGroup || undefined,
      name: m.label || m.reference_id || "(unnamed)",
      slug,
      description:
        typeof m.rich_text === "string" && m.rich_text.replace(/<[^>]*>/g, "").trim()
          ? m.rich_text
          : "",
      parent_id: parentCategoryId,
      level,
      path,
      hero_image: null,
      mobile_hero_image: mobileHeroUrl ? { url: mobileHeroUrl } : null,
      item_icon: itemIconUrl ? { url: itemIconUrl } : null,
      seo: {
        title: "",
        description: "",
        keywords: [],
      },
      display_order: typeof m.position === "number" ? m.position : 0,
      is_active: m.is_active !== false,
      product_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };
    docsToInsert.push(doc);
  }

  // Summary
  const byLevel = docsToInsert.reduce((acc, d) => {
    acc[d.level] = (acc[d.level] || 0) + 1;
    return acc;
  }, {});
  console.log("\nPrepared documents:");
  for (const lvl of Object.keys(byLevel).sort()) {
    console.log(`  level ${lvl}: ${byLevel[lvl]}`);
  }
  console.log(`  total:   ${docsToInsert.length}`);
  console.log(`Slug collisions resolved: ${slugCollisions.length}`);
  if (slugCollisions.length) {
    console.log(JSON.stringify(slugCollisions.slice(0, 10), null, 2));
    if (slugCollisions.length > 10) console.log(`  ... +${slugCollisions.length - 10} more`);
  }

  if (!APPLY) {
    console.log("\n[dry run] No changes written. Re-run with --apply to insert.");
    await mongoose.connection.close();
    return;
  }

  if (WIPE) {
    const filter = {
      category_id: { $ne: ROOT_CATEGORY_ID },
      $or: [{ parent_id: ROOT_CATEGORY_ID }, { path: ROOT_CATEGORY_ID }],
    };
    const before = await Category.countDocuments(filter);
    console.log(`\nWiping ${before} existing descendants of root...`);
    const del = await Category.deleteMany(filter);
    console.log(`Deleted: ${del.deletedCount}`);
  }

  // Insert in batches to keep mongo happy.
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < docsToInsert.length; i += BATCH) {
    const slice = docsToInsert.slice(i, i + BATCH);
    await Category.insertMany(slice, { ordered: false });
    inserted += slice.length;
    console.log(`  inserted ${inserted}/${docsToInsert.length}`);
  }
  console.log(`\nDone. Inserted ${inserted} categories under "${root.name}".`);

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
