/**
 * Upload curated demo product photos to the demo-it CDN under demo/DEMO-<code>.jpg.
 *
 * Source: scripts/demo/assets/<CODE>.jpg (one per TEMPLATES code, e.g. UEL-01.jpg).
 * Reads CDN credentials from the demo-it b2bhomesettings doc (same fields the
 * app uses). Prints DEMO_IMAGE_MANIFEST entries to stdout for demo-images.ts.
 *
 * Usage: npx tsx scripts/demo/upload-demo-images.ts [--dry-run]
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CdnConfig } from "vinc-cdn";
import { connectToTenantDb, disconnectDb } from "../lib/db-connect.js";
import { DEMO_TENANT_ID } from "./demo-config.js";

const DRY = process.argv.includes("--dry-run");
const ASSET_DIR = join(dirname(fileURLToPath(import.meta.url)), "assets");

async function main() {
  await connectToTenantDb(DEMO_TENANT_ID);
  const mongoose = (await import("mongoose")).default;
  const settings: any = await mongoose.connection.collection("b2bhomesettings").findOne({});
  const c = settings?.cdn_credentials;
  if (!c?.cdn_url) throw new Error("demo-it b2bhomesettings.cdn_credentials missing — configure CDN first");

  const { uploadToCdn, getCdnBaseUrl } = await import("vinc-cdn");
  const config: CdnConfig = {
    endpoint: c.cdn_url, region: c.bucket_region, bucket: c.bucket_name,
    accessKeyId: c.cdn_key, secretAccessKey: c.cdn_secret, folder: c.folder_name,
  };
  const files = (await readdir(ASSET_DIR)).filter((f) => f.toLowerCase().endsWith(".jpg"));
  console.log(`Found ${files.length} assets in ${ASSET_DIR}\n`);
  const manifest: Record<string, string> = {};
  for (const file of files) {
    const code = file.replace(/\.jpg$/i, "");
    if (DRY) { console.log(`  would upload ${file} → demo/DEMO-${code}.jpg`); continue; }
    const buffer = await readFile(join(ASSET_DIR, file));
    const res = await uploadToCdn(config, {
      buffer, contentType: "image/jpeg", fileName: `DEMO-${code}.jpg`, customFolder: "demo",
    });
    manifest[code] = res.url;
    console.log(`  ✓ ${code} → ${res.url}`);
  }
  console.log(`\nBASE: ${getCdnBaseUrl(config)}`);
  console.log("\nPaste into scripts/demo/demo-images.ts DEMO_IMAGE_MANIFEST:");
  console.log(JSON.stringify(manifest, null, 2));
  await disconnectDb();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
