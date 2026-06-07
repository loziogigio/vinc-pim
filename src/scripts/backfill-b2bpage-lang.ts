/**
 * Backfill `lang` on existing b2bpages (one-time, idempotent).
 * Sets lang = default catalog language for any page missing it.
 *
 * Usage:
 *   dotenv -e .env -o -- vite-node src/scripts/backfill-b2bpage-lang.ts <tenantDb>
 *
 * Example:
 *   dotenv -e .env -o -- vite-node src/scripts/backfill-b2bpage-lang.ts vinc-baseprotection-com
 */

import "dotenv/config";
import { connectWithModels } from "@/lib/db/connection";
import { getDefaultLanguage } from "@/config/languages";

async function main() {
  const tenantDb = process.argv[2];
  if (!tenantDb) {
    console.error(
      "usage: dotenv -e .env -o -- vite-node src/scripts/backfill-b2bpage-lang.ts <tenantDb e.g. vinc-baseprotection-com>",
    );
    process.exit(1);
  }

  const { B2BPage } = await connectWithModels(tenantDb);
  const defaultLang = getDefaultLanguage().code;

  const res = await B2BPage.updateMany(
    { $or: [{ lang: { $exists: false } }, { lang: null }, { lang: "" }] },
    { $set: { lang: defaultLang } },
  );

  console.log(
    `[backfill-b2bpage-lang] ${tenantDb}: set lang=${defaultLang} on ${res.modifiedCount} page(s)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
