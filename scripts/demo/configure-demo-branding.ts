/**
 * Configure Velia Ferramenta branding on the demo-it b2bhomesettings doc.
 * Idempotent upsert keyed by customerId (the tenant home_settings_customer_id).
 * Usage: npx tsx scripts/demo/configure-demo-branding.ts [--dry-run]
 */
import { connectToTenantDb, disconnectDb } from "../lib/db-connect.js";
import { DEMO_TENANT_ID } from "./demo-config.js";

const DRY = process.argv.includes("--dry-run");

const BRANDING = {
  title: "Velia Ferramenta",
  logo: "https://cdn.vendereincloud.it/vinc-demo-it/demo/brand/velia-logo.svg",
  favicon: "https://cdn.vendereincloud.it/vinc-demo-it/demo/brand/velia-favicon.png",
  primaryColor: "#1f2937",   // industrial graphite
  secondaryColor: "#f59e0b", // safety amber
  accentColor: "#2563eb",
  headerBackgroundColor: "#111827",
  footerBackgroundColor: "#0b1220",
  footerTextColor: "#cbd5e1",
};
const FOOTER_HTML =
  `<div style="padding:24px;color:#cbd5e1">© 2026 Velia Ferramenta — Demo VINC · ` +
  `Forniture industriali per professionisti · info@velia-demo.it</div>`;

/** Resolve the home-settings customerId for the demo tenant from vinc-admin. */
async function resolveCustomerId(): Promise<string> {
  const mongoose = (await import("mongoose")).default;
  const admin = mongoose.connection.useDb("vinc-admin");
  const tdoc: any = await admin.collection("tenants").findOne({ tenant_id: DEMO_TENANT_ID });
  return tdoc?.home_settings_customer_id || DEMO_TENANT_ID;
}

export async function applyDemoBranding(): Promise<void> {
  const mongoose = (await import("mongoose")).default;
  const customerId = await resolveCustomerId();
  const coll = mongoose.connection.collection("b2bhomesettings");
  await coll.updateOne(
    { customerId },
    { $set: { customerId, branding: BRANDING, footerHtml: FOOTER_HTML,
              "cardStyle.priceDecimals": 2, defaultCardVariant: "b2b", updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  console.log(`✓ branding applied to b2bhomesettings (customerId=${customerId})`);
}

async function main() {
  if (DRY) { console.log("DRY RUN — would upsert Velia branding:\n", JSON.stringify(BRANDING, null, 2)); return; }
  await connectToTenantDb(DEMO_TENANT_ID);
  try { await applyDemoBranding(); } finally { await disconnectDb(); }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
