/**
 * Read-modify: delete the QA test contact-form submissions created during the
 * eFakturuj contact-form work. Targets ONLY the specific test emails below.
 *
 * Dry-run by default — prints what would be deleted, deletes NOTHING.
 * Set APPLY=1 to actually delete.
 *
 * Run (from vinc-commerce-suite):
 *   TENANT_ID=efakturuj-sk dotenv -e .env -o -- vite-node scripts/delete-test-contact-submissions.ts
 *   TENANT_ID=efakturuj-sk APPLY=1 dotenv -e .env -o -- vite-node scripts/delete-test-contact-submissions.ts
 */
import { connectWithModels } from "@/lib/db/connection";

const TENANT_ID = process.env.TENANT_ID;
const PAGE_SLUG = process.env.CONTACT_PAGE_SLUG || "contact";
const APPLY = process.env.APPLY === "1";

const TEST_EMAILS = [
  "test+claude@efakturuj.sk",
  "test2+claude@efakturuj.sk",
  "test3+claude@efakturuj.sk",
];

async function main() {
  if (!TENANT_ID) throw new Error("TENANT_ID env var is required");
  const tenantDb = `vinc-${TENANT_ID}`;
  const { B2BFormSubmission } = await connectWithModels(tenantDb);

  const filter = { page_slug: PAGE_SLUG, "data.email": { $in: TEST_EMAILS } };

  const matches = await B2BFormSubmission.find(filter).lean();
  console.log(`[delete] ${tenantDb} page=${PAGE_SLUG} — matched ${matches.length} test submission(s):`);
  for (const m of matches as Array<Record<string, unknown>>) {
    const data = (m.data || {}) as Record<string, unknown>;
    console.log(`  - ${String(m._id)}  ${data.email}  (${data.name})`);
  }

  if (matches.length === 0) {
    console.log("[delete] nothing to delete. Done.");
    return;
  }

  if (!APPLY) {
    console.log("[delete] DRY RUN — no delete performed. Re-run with APPLY=1 to delete.");
    return;
  }

  const res = await B2BFormSubmission.deleteMany(filter);
  console.log(`[delete] DELETED ${res.deletedCount} submission(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[delete] FAILED:", err);
    process.exit(1);
  });
