/**
 * READ-ONLY scope scan of the PIM bad-sync incident.
 * Looks only at the CURRENT version of each product (isCurrent: true).
 * Single-pass: one indexed $match on isCurrent, slim $project, then $facet.
 *
 * Usage: npx tsx _scan-pim-scope.ts [tenantDb]
 */
import { MongoClient } from "mongodb";

const tenantDb = process.argv[2] || "vinc-hidros-it";
const url = process.env.VINC_MONGO_URL;
if (!url) { console.error("VINC_MONGO_URL not set"); process.exit(1); }

const n = (x: any[]) => (x?.[0]?.n ?? 0);

async function main() {
  const client = new MongoClient(url!);
  await client.connect();
  try {
    const col = client.db(tenantDb).collection("pimproducts");

    const totalDocs = await col.estimatedDocumentCount(); // all versions (cheap metadata)

    const [agg] = await col.aggregate([
      { $match: { isCurrent: true } },
      // Slim each doc to just the fields we need before faceting (docs are large).
      { $project: {
          status: 1, isCurrentPublished: 1, quantity: 1, stock_status: 1,
          listP: "$pricing.list", retailP: "$pricing.retail",
          imported_at: "$source.imported_at", entity_code: 1, sku: 1, version: 1,
      } },
      { $facet: {
          total: [{ $count: "n" }],
          byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }, { $sort: { n: -1 } }],
          publishedPtr: [{ $match: { isCurrentPublished: true } }, { $count: "n" }],
          qtyZero: [{ $match: { quantity: 0 } }, { $count: "n" }],
          outOfStock: [{ $match: { stock_status: "out_of_stock" } }, { $count: "n" }],
          draft: [{ $match: { status: "draft" } }, { $count: "n" }],
          draftQtyZero: [{ $match: { status: "draft", quantity: 0 } }, { $count: "n" }],
          // genuinely lost price (both list & retail null/0/missing) — tests "lost price" theory
          noPrice: [
            { $match: { $and: [
              { $or: [{ listP: null }, { listP: 0 }] },
              { $or: [{ retailP: null }, { retailP: 0 }] },
            ] } },
            { $count: "n" },
          ],
          timeline: [
            { $match: { imported_at: { $exists: true } } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$imported_at" } },
                n: { $sum: 1 },
                qtyZero: { $sum: { $cond: [{ $eq: ["$quantity", 0] }, 1, 0] } },
                draft: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
            } },
            { $sort: { _id: 1 } },
          ],
          // still broken now: current version is draft AND qty 0
          sampleStillBroken: [
            { $match: { status: "draft", quantity: 0 } },
            { $limit: 5 },
            { $project: { _id: 0, entity_code: 1, sku: 1, version: 1, quantity: 1, listP: 1 } },
          ],
          // recovered data but unpublished (like 109347): draft AND qty>0
          sampleRecoveredUnpublished: [
            { $match: { status: "draft", quantity: { $gt: 0 } } },
            { $limit: 5 },
            { $project: { _id: 0, entity_code: 1, sku: 1, version: 1, quantity: 1, listP: 1 } },
          ],
      } },
    ]).toArray();

    console.log(`\n=== SCOPE SCAN: ${tenantDb} ===`);
    console.log(`total docs (all versions): ${totalDocs}`);
    console.log(`current products (isCurrent=true): ${n(agg.total)}`);
    console.log(`\ncurrent by status:`, agg.byStatus.map((s: any) => `${s._id}=${s.n}`).join("  "));
    console.log(`isCurrentPublished=true: ${n(agg.publishedPtr)}`);
    console.log(`current quantity=0: ${n(agg.qtyZero)}`);
    console.log(`current out_of_stock: ${n(agg.outOfStock)}`);
    console.log(`current status=draft: ${n(agg.draft)}`);
    console.log(`current draft AND qty=0: ${n(agg.draftQtyZero)}`);
    console.log(`current with NO price (list&retail null/0): ${n(agg.noPrice)}  <-- tests "lost price" theory`);

    console.log(`\ncurrent-version import-day timeline (day = source.imported_at of current version):`);
    for (const t of agg.timeline) {
      console.log(`  ${t._id}: current=${t.n}  qty0=${t.qtyZero}  draft=${t.draft}`);
    }

    console.log(`\nsample STILL-BROKEN (draft + qty0):`);
    for (const s of agg.sampleStillBroken) console.log(`  ${s.entity_code} (${s.sku}) v${s.version} qty=${s.quantity} list=${s.listP ?? "-"}`);
    console.log(`sample RECOVERED-but-UNPUBLISHED (draft + qty>0):`);
    for (const s of agg.sampleRecoveredUnpublished) console.log(`  ${s.entity_code} (${s.sku}) v${s.version} qty=${s.quantity} list=${s.listP ?? "-"}`);
  } finally {
    await client.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
