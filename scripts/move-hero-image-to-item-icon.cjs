/**
 * Move category.hero_image -> category.item_icon (and clear hero_image).
 *
 * The original menu-to-category import placed the small menu icon under
 * `hero_image`. Categories now have a dedicated `item_icon` slot for that
 * purpose (mirroring the menu's "Menu Item Icon/Image" field), and the
 * hero_image / mobile_hero_image fields are reserved for the large hero
 * banner shown on category landing pages. This script relocates the
 * existing values.
 *
 * Only touches categories that currently have a populated hero_image AND
 * no item_icon yet — safe to re-run.
 *
 * Usage:
 *   node scripts/move-hero-image-to-item-icon.cjs            # dry run
 *   node scripts/move-hero-image-to-item-icon.cjs --apply    # write updates
 *
 * Env overrides:
 *   TENANT_DB=vinc-hidros-it
 *   ROOT_CATEGORY_ID=l8uzV0JahqSA   (optional — restricts the move to the
 *                                    descendants of a specific root)
 */
require("dotenv").config();
const mongoose = require("mongoose");

const TENANT_DB = process.env.TENANT_DB || "vinc-hidros-it";
const ROOT_CATEGORY_ID = process.env.ROOT_CATEGORY_ID || null;
const APPLY = process.argv.includes("--apply");

async function main() {
  await mongoose.connect(process.env.VINC_MONGO_URL, { dbName: TENANT_DB });
  const Category = mongoose.connection.db.collection("categories");

  const filter = {
    "hero_image.url": { $exists: true, $ne: null, $ne: "" },
    $or: [
      { item_icon: { $exists: false } },
      { item_icon: null },
      { "item_icon.url": { $in: [null, ""] } },
    ],
  };
  if (ROOT_CATEGORY_ID) {
    filter.$and = [
      {
        $or: [
          { category_id: ROOT_CATEGORY_ID },
          { parent_id: ROOT_CATEGORY_ID },
          { path: ROOT_CATEGORY_ID },
        ],
      },
    ];
  }

  const total = await Category.countDocuments(filter);
  console.log(`\nTenant DB:        ${TENANT_DB}`);
  console.log(`Restrict to root: ${ROOT_CATEGORY_ID || "(none)"}`);
  console.log(`Mode:             ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Categories to move: ${total}`);

  const sample = await Category.find(filter).limit(5).toArray();
  if (sample.length) {
    console.log("\nSample (first 5):");
    for (const c of sample) {
      console.log(`  - ${c.name} (${c.category_id}) hero_image.url=${c.hero_image?.url}`);
    }
  }

  if (!APPLY) {
    console.log("\n[dry run] No changes written. Re-run with --apply.");
    await mongoose.connection.close();
    return;
  }

  if (total === 0) {
    console.log("Nothing to do.");
    await mongoose.connection.close();
    return;
  }

  // Use an aggregation-style update to copy the field server-side.
  const res = await Category.updateMany(filter, [
    {
      $set: {
        item_icon: "$hero_image",
        hero_image: null,
        updated_at: new Date(),
      },
    },
  ]);
  console.log(`\nMatched:  ${res.matchedCount}`);
  console.log(`Modified: ${res.modifiedCount}`);

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
