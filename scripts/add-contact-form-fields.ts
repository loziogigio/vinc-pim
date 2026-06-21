/**
 * One-off migration: add the eFakturuj "goal-first" contact-form fields to the
 * published `contact` page's form-contact block, so the public submit handler
 * (which persists ONLY CMS-defined field ids) stores them.
 *
 * The field ids MUST match exactly what the efakturuj frontend submits:
 *   goal, company_type, system, partnership_type, account_email
 *
 * Idempotent: fields already present (by id) are skipped.
 * Dry-run by default — prints current + planned changes and writes NOTHING.
 * Set APPLY=1 to actually write.
 *
 * Run (from vinc-commerce-suite):
 *   TENANT_ID=<tenant> dotenv -e .env -o -- vite-node scripts/add-contact-form-fields.ts
 *   TENANT_ID=<tenant> APPLY=1 dotenv -e .env -o -- vite-node scripts/add-contact-form-fields.ts
 */
import { connectWithModels } from "@/lib/db/connection";
import { getPortalByDomain } from "@/lib/services/b2b-portal.service";

const TENANT_ID = process.env.TENANT_ID;
const DOMAIN = process.env.CONTACT_DOMAIN || "efakturuj.sk";
const PAGE_SLUG = process.env.CONTACT_PAGE_SLUG || "contact";
const APPLY = process.env.APPLY === "1";

type FieldOption = { label: string; value: string };
type FieldDef = {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  options?: FieldOption[];
};

// All optional so a submission is never rejected when a conditional field is empty.
const NEW_FIELDS: FieldDef[] = [
  {
    id: "goal",
    type: "select",
    label: "Cieľ kontaktu",
    required: false,
    options: [
      { label: "Demo prístup", value: "demo" },
      { label: "Partnerstvo", value: "partnership" },
      { label: "Technická podpora", value: "support" },
    ],
  },
  {
    id: "company_type",
    type: "select",
    label: "Typ spoločnosti",
    required: false,
    options: [
      { label: "Dodávateľ ERP / účtovného softvéru", value: "erp" },
      { label: "E-shop / e-commerce", value: "eshop" },
      { label: "Účtovník / účtovná firma", value: "accountant" },
      { label: "Iné", value: "other" },
    ],
  },
  { id: "system", type: "text", label: "Systém / ERP (demo)", required: false },
  {
    id: "partnership_type",
    type: "select",
    label: "Typ partnerstva",
    required: false,
    options: [
      { label: "Integrácia ERP / softvéru", value: "integration" },
      { label: "Reseller", value: "reseller" },
      { label: "Odporúčanie", value: "referral" },
      { label: "White-label", value: "whitelabel" },
    ],
  },
  {
    id: "account_email",
    type: "email",
    label: "E-mail účtu / organizácie (podpora)",
    required: false,
  },
];

async function main() {
  if (!TENANT_ID) throw new Error("TENANT_ID env var is required");
  const tenantDb = `vinc-${TENANT_ID}`;
  console.log(`[migrate] tenantDb=${tenantDb} domain=${DOMAIN} pageSlug=${PAGE_SLUG} APPLY=${APPLY}`);

  const portal = await getPortalByDomain(tenantDb, DOMAIN);
  if (!portal) throw new Error(`No active portal found for domain "${DOMAIN}" in ${tenantDb}`);
  const portalSlug = (portal as { slug: string }).slug;
  const templateId = `b2b-${portalSlug}-page-${PAGE_SLUG}`;
  console.log(`[migrate] portalSlug=${portalSlug} templateId=${templateId}`);

  const { HomeTemplate } = await connectWithModels(tenantDb);
  const doc = await HomeTemplate.findOne({ templateId });
  if (!doc) throw new Error(`No page template found: ${templateId}`);
  console.log(`[migrate] template status=${(doc as { status?: string }).status}`);

  const blocks = (doc.blocks || []) as Array<{ type: string; config?: { fields?: FieldDef[] } }>;
  const formBlock = blocks.find((b) => b.type === "form-contact");
  if (!formBlock || !formBlock.config) throw new Error("No form-contact block on this page");

  const fields = formBlock.config.fields || [];
  const existingIds = new Set(fields.map((f) => f.id));
  console.log(`[migrate] existing field ids: ${[...existingIds].join(", ") || "(none)"}`);

  const toAdd = NEW_FIELDS.filter((f) => !existingIds.has(f.id));
  console.log(`[migrate] fields to add: ${toAdd.map((f) => f.id).join(", ") || "(none — already present)"}`);

  if (toAdd.length === 0) {
    console.log("[migrate] nothing to do (idempotent). Done.");
    return;
  }

  if (!APPLY) {
    console.log("[migrate] DRY RUN — no write performed. Re-run with APPLY=1 to apply.");
    return;
  }

  formBlock.config.fields = [...fields, ...toAdd];
  doc.markModified("blocks");
  (doc as { lastSavedAt?: string }).lastSavedAt = new Date().toISOString();
  await doc.save();
  console.log(
    `[migrate] APPLIED. form-contact fields now: ${(formBlock.config.fields || [])
      .map((f) => f.id)
      .join(", ")}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[migrate] FAILED:", err);
    process.exit(1);
  });
