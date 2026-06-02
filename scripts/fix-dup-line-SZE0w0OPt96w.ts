/**
 * One-off fix — remove the duplicate RPC line on order SZE0w0OPt96w (hidros-it).
 *
 * Context (Plane hidros #10): VINC double-submitted the RPC line, writing two
 * identical items with the SAME line_number=120 (sku=RPC, qty=20, unit_price=0.333)
 * 4 ms apart (added_at 08:24:23.703Z and .707Z). The ERP import keys on
 * (oelen_dbmsx, nprog_ielen_b, nriga_ddocu) → the second INSERT hits a PK
 * collision, the whole order transaction rolls back, export_status=error, and
 * the every-minute cron retries forever. The order is stuck status=pending.
 *
 * This removes EXACTLY ONE of the two identical lines — the later .707Z one —
 * keeping a single RPC line (qty 20), then recalculates the order totals via
 * saveOrder() (recalculateOrderTotals + promo progress + gift enforcement).
 *
 * Dry-run by default. Pass --commit to actually write.
 *
 *   dotenv -e .env -o -- npx tsx scripts/fix-dup-line-SZE0w0OPt96w.ts
 *   dotenv -e .env -o -- npx tsx scripts/fix-dup-line-SZE0w0OPt96w.ts --commit
 */

import "dotenv/config";
import { connectWithModels } from "../src/lib/db/model-registry";
import { saveOrder } from "../src/lib/services/order.service";
import { recalculateOrderTotals } from "../src/lib/db/models/order";
import { disconnectAll } from "../src/lib/db/connection";

const ORDER_ID = process.env.FIX_ORDER_ID || "SZE0w0OPt96w";
const TENANT_ID = process.env.VINC_TENANT_ID || "hidros-it";
const TENANT_DB = process.env.FIX_TENANT_DB || `vinc-${TENANT_ID}`;
const COMMIT = process.argv.includes("--commit");

const money = (n: unknown) => (typeof n === "number" ? n.toFixed(2) : String(n));

function snapshotTotals(o: any) {
  return {
    item_count: o.items.length,
    order_total: money(o.order_total),
    subtotal_net: money(o.subtotal_net),
    subtotal_gross: money(o.subtotal_gross),
    total_vat: money(o.total_vat),
    total_discount: money(o.total_discount),
  };
}

async function main() {
  console.log(`\n${COMMIT ? "🔴 COMMIT" : "🟡 DRY-RUN"} — order ${ORDER_ID} @ ${TENANT_DB}\n`);

  const { Order } = await connectWithModels(TENANT_DB);
  const order: any = await Order.findOne({ order_id: ORDER_ID, tenant_id: TENANT_ID });
  if (!order) throw new Error(`Order ${ORDER_ID} not found in ${TENANT_DB}`);

  // Locate the duplicate group: same line_number + sku, identical qty/price/packaging.
  const dupes = order.items.filter(
    (i: any) =>
      i.line_number === 120 &&
      String(i.sku) === "RPC" &&
      Number(i.quantity) === 20 &&
      Number(i.unit_price) === 0.333,
  );

  console.log(`Found ${dupes.length} line(s) matching line_number=120 / sku=RPC / qty=20 / unit_price=0.333:`);
  for (const d of dupes) {
    console.log(`  • added_at=${new Date(d.added_at).toISOString()}  pkg=${d.packaging_label ?? d.packaging_code ?? "-"}  promo=${d.promo_code ?? "-"}`);
  }

  if (dupes.length !== 2) {
    console.log(`\n⚠️  Expected exactly 2 identical lines, found ${dupes.length}. Aborting — no change made.`);
    return;
  }

  // Pick the LATER (.707Z) one to remove; keep the earlier (.703Z) line.
  const toRemove = dupes.reduce((later: any, cur: any) =>
    new Date(cur.added_at).getTime() > new Date(later.added_at).getTime() ? cur : later,
  );
  const removeAt = new Date(toRemove.added_at).getTime();
  const idx = order.items.findIndex(
    (i: any) => i.line_number === 120 && String(i.sku) === "RPC" && new Date(i.added_at).getTime() === removeAt,
  );

  console.log(`\nBefore:`, snapshotTotals(order));
  console.log(`Removing items[${idx}] (added_at=${new Date(toRemove.added_at).toISOString()}, the later duplicate)`);

  order.items.splice(idx, 1);

  if (!COMMIT) {
    // Recalc in-memory only so the dry-run shows the projected totals.
    recalculateOrderTotals(order);
    console.log(`After (projected):`, snapshotTotals(order));
    console.log(`\n🟡 DRY-RUN — nothing written. Re-run with --commit to apply.`);
    return;
  }

  await saveOrder(order);
  console.log(`After (saved):`, snapshotTotals(order));
  console.log(`\n✅ Committed. Order ${ORDER_ID} now has ${order.items.length} lines; totals recalculated.`);
  console.log(`   The every-minute importer should now export it cleanly (31 ERP lines).`);
}

main()
  .catch((e) => {
    console.error("\n❌ Failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectAll().catch(() => {});
  });
