/**
 * READ-ONLY investigation of PIM SCD-2 version history.
 * Lists every version of a given entity_code with price/quantity/source/timestamps,
 * so we can see when a bad import wiped price/qty and which earlier version was good.
 *
 * Usage:
 *   npx tsx /tmp/investigate-pim-versions.ts <entity_code> [tenantDb]
 * Example:
 *   npx tsx /tmp/investigate-pim-versions.ts 109347 vinc-hidros-it
 */
import { MongoClient } from "mongodb";

const entityCode = process.argv[2] || "109347";
const tenantDb = process.argv[3] || "vinc-hidros-it";
const url = process.env.VINC_MONGO_URL;

if (!url) {
  console.error("VINC_MONGO_URL not set (load CS .env)");
  process.exit(1);
}

function priceSummary(doc: any) {
  const p = doc.pricing || {};
  const pkgs = Array.isArray(doc.packaging_options) ? doc.packaging_options : [];
  const pkgPrices = pkgs.map((pk: any) => {
    const pr = pk.pricing || {};
    return `${pk.code}:list=${pr.list ?? "-"}/retail=${pr.retail ?? "-"}/sale=${pr.sale ?? "-"}`;
  });
  return {
    pricing: `list=${p.list ?? "-"} retail=${p.retail ?? "-"} sale=${p.sale ?? "-"} cur=${p.currency ?? "-"}`,
    pkgCount: pkgs.length,
    pkgPrices,
  };
}

function hasRealPrice(doc: any): boolean {
  const p = doc.pricing || {};
  const top = [p.list, p.retail, p.sale].some((v) => typeof v === "number" && v > 0);
  const pkgs = Array.isArray(doc.packaging_options) ? doc.packaging_options : [];
  const pkg = pkgs.some((pk: any) => {
    const pr = pk.pricing || {};
    return [pr.list, pr.retail, pr.sale, pr.list_unit, pr.retail_unit].some(
      (v) => typeof v === "number" && v > 0
    );
  });
  return top || pkg;
}

async function main() {
  const client = new MongoClient(url!);
  await client.connect();
  try {
    const col = client.db(tenantDb).collection("pimproducts");

    const versions = await col
      .find({ entity_code: entityCode })
      .sort({ version: 1 })
      .toArray();

    console.log(`\n=== entity_code ${entityCode} in ${tenantDb} ===`);
    console.log(`total versions stored: ${versions.length}`);
    if (versions.length === 0) {
      console.log("NO DOCUMENTS — entity_code not found");
      return;
    }

    for (const v of versions) {
      const ps = priceSummary(v);
      console.log(
        [
          ``,
          `v${v.version}${v.isCurrent ? " [CURRENT]" : ""}${v.isCurrentPublished ? " [PUBLISHED]" : ""}`,
          `  status=${v.status} manually_edited=${v.manually_edited} hasRealPrice=${hasRealPrice(v)}`,
          `  quantity=${v.quantity} sold=${v.sold} stock_status=${v.stock_status ?? "-"}`,
          `  ${ps.pricing}`,
          `  packaging_options=${ps.pkgCount}${ps.pkgPrices.length ? " -> " + ps.pkgPrices.join(" | ") : ""}`,
          `  source.job_id=${v.source?.job_id ?? "-"} source.source_id=${v.source?.source_id ?? "-"}`,
          `  imported_at=${v.source?.imported_at?.toISOString?.() ?? v.source?.imported_at ?? "-"}`,
          `  created_at=${v.created_at?.toISOString?.() ?? v.created_at}  updated_at=${v.updated_at?.toISOString?.() ?? v.updated_at}`,
          `  content_hash=${v.content_hash ?? "-"}`,
        ].join("\n")
      );
    }

    // Suggest the latest version that still had a real price, before the current one.
    const current = versions.find((v) => v.isCurrent);
    const goodBeforeCurrent = [...versions]
      .filter((v) => v.version < (current?.version ?? Infinity) && hasRealPrice(v))
      .sort((a, b) => b.version - a.version)[0];
    const firstGood = versions.find((v) => hasRealPrice(v));

    console.log(`\n--- analysis ---`);
    console.log(`current version: v${current?.version} hasRealPrice=${current ? hasRealPrice(current) : "n/a"}`);
    console.log(`first version with real price: ${firstGood ? "v" + firstGood.version : "NONE"}`);
    console.log(
      `latest GOOD version before current: ${goodBeforeCurrent ? "v" + goodBeforeCurrent.version : "NONE"}`
    );
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
