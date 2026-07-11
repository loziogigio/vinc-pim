/**
 * Read-only: print the most recent contact-form submission(s) for the eFakturuj
 * portal, so we can confirm the goal-first fields (goal / company_type / system
 * / partnership_type / account_email) are now persisted.
 *
 * Run (from vinc-commerce-suite):
 *   TENANT_ID=efakturuj-sk dotenv -e .env -o -- vite-node scripts/check-latest-contact-submission.ts
 */
import { connectWithModels } from "@/lib/db/connection";

const TENANT_ID = process.env.TENANT_ID;
const PAGE_SLUG = process.env.CONTACT_PAGE_SLUG || "contact";
const LIMIT = parseInt(process.env.LIMIT || "3", 10);

async function main() {
  if (!TENANT_ID) throw new Error("TENANT_ID env var is required");
  const tenantDb = `vinc-${TENANT_ID}`;
  const { B2BFormSubmission } = await connectWithModels(tenantDb);

  const items = await B2BFormSubmission.find({ page_slug: PAGE_SLUG })
    .sort({ createdAt: -1, created_at: -1, _id: -1 })
    .limit(LIMIT)
    .lean();

  console.log(`[check] ${tenantDb} page=${PAGE_SLUG} — latest ${items.length} submission(s):`);
  for (const it of items as Array<Record<string, unknown>>) {
    console.log("────────────────────────────────────────");
    console.log("  _id:", String(it._id));
    console.log("  portal_slug:", it.portal_slug, " seen:", it.seen);
    console.log("  data:", JSON.stringify(it.data));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[check] FAILED:", err);
    process.exit(1);
  });
