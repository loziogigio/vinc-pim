/**
 * VINC Office — provision the shared `office` CS tenant (task A12).
 *
 * The `office` tenant backs the vinc-office CMS storefronts (Plan B). It has
 * no domains of its own — storefronts under it are addressed via the b2c
 * storefront record, not tenant domains.
 *
 * Idempotent: safe to re-run.
 *   - If the tenant does not exist yet: creates it, then always creates and
 *     prints a fresh API key (the deployment needs one to boot).
 *   - If the tenant already exists: skips tenant creation. An API key is
 *     only created (and printed) when `--new-key` is passed.
 *
 * Usage:
 *   # requires VINC_MONGO_URL + SOLR_URL + OFFICE_TENANT_ADMIN_EMAIL/PASSWORD
 *   npx tsx scripts/provision-office-tenant.ts
 *
 *   # tenant already exists, just mint a new key (e.g. to rotate):
 *   npx tsx scripts/provision-office-tenant.ts --new-key
 *
 * The printed key_id/secret are shown ONCE — copy them into the office
 * deployment env (VINC_CMS_API_KEY_ID / VINC_CMS_API_SECRET) immediately.
 *
 * NOTE: this only provisions the tenant + API key. The sparse `channel_1`
 * index on `b2cstorefronts` is a separate step — run the A8 migration
 * against the tenant DB afterwards:
 *   npx tsx scripts/migrations/2026-07-b2c-channel-sparse-index.ts vinc-office
 */

import dotenv from "dotenv";
dotenv.config();

const NEW_KEY = process.argv.includes("--new-key");

const OFFICE_TENANT_ID = "office";
const OFFICE_TENANT_NAME = "VINC Office stores";
const OFFICE_PROJECT_CODE = "vinc-office";
const OFFICE_DB_NAME = `vinc-${OFFICE_TENANT_ID}`;

interface OfficeAdminCreds {
  email: string;
  password: string;
}

/** Fail fast if the admin credential env vars are missing. */
function requireOfficeAdminCreds(): OfficeAdminCreds {
  const email = process.env.OFFICE_TENANT_ADMIN_EMAIL;
  const password = process.env.OFFICE_TENANT_ADMIN_PASSWORD;
  const missing = [
    !email && "OFFICE_TENANT_ADMIN_EMAIL",
    !password && "OFFICE_TENANT_ADMIN_PASSWORD",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `Missing office tenant admin credential env vars: ${missing.join(", ")}. ` +
        `Set them in .env — they seed the office tenant's admin B2BUser.`
    );
  }
  return { email: email!, password: password! };
}

/**
 * Create the `office` tenant if it doesn't exist yet.
 * Returns true if this call created it, false if it already existed.
 */
async function ensureTenant(creds: OfficeAdminCreds): Promise<boolean> {
  console.log("\n▸ Tenant");
  const { createTenant } = await import("../src/lib/services/admin-tenant.service.js");
  try {
    const result = await createTenant({
      tenant_id: OFFICE_TENANT_ID,
      name: OFFICE_TENANT_NAME,
      admin_email: creds.email,
      admin_password: creds.password,
      admin_name: "Office Admin",
      created_by: "provision-office-tenant",
      project_code: OFFICE_PROJECT_CODE,
      // No domains: office storefronts are addressed via b2cstorefronts
      // records, not tenant hostnames.
    });
    console.log(`  ✓ created tenant '${OFFICE_TENANT_ID}' (db: ${result.tenant.mongo_db}, solr: ${result.tenant.solr_core})`);
    console.log(`  ✓ admin B2BUser: ${creds.email}`);
    return true;
  } catch (err: any) {
    if (/already exists/i.test(err?.message ?? "")) {
      console.log(`  • tenant '${OFFICE_TENANT_ID}' already exists — skipping creation`);
      return false;
    }
    throw err;
  }
}

/** Generate + persist a new active API key with full permissions, printed once. */
async function createApiKey(): Promise<void> {
  console.log("\n▸ API key");
  const { generateAPIKey, hashAPISecret } = await import("../src/lib/auth/api-key-auth.js");
  const { connectToTenantDb, disconnectDb } = await import("./lib/db-connect.js");

  const { keyId, secret } = generateAPIKey(OFFICE_TENANT_ID);
  const secretHash = await hashAPISecret(secret);

  await connectToTenantDb(OFFICE_TENANT_ID);
  try {
    const mongoose = (await import("mongoose")).default;
    await mongoose.connection.db?.collection("apikeys").insertOne({
      key_id: keyId,
      tenant_id: OFFICE_TENANT_ID,
      secret_hash: secretHash,
      name: "Office CMS API Key",
      permissions: ["*"],
      is_active: true,
      created_by: "provision-office-tenant",
      created_at: new Date(),
      updated_at: new Date(),
    });
  } finally {
    await disconnectDb();
  }

  console.log(`\n${"=".repeat(64)}`);
  console.log(`VINC OFFICE — API key (shown once, copy it now)`);
  console.log(`${"=".repeat(64)}`);
  console.log(`  VINC_CMS_API_KEY_ID:  ${keyId}`);
  console.log(`  VINC_CMS_API_SECRET:  ${secret}`);
  console.log(`${"=".repeat(64)}\n`);
}

async function main(): Promise<void> {
  const creds = requireOfficeAdminCreds();

  const created = await ensureTenant(creds);

  if (created || NEW_KEY) {
    await createApiKey();
  } else {
    console.log("\n• Tenant already provisioned and --new-key not passed — no key created.");
    console.log("  Pass --new-key to mint a fresh key (e.g. to rotate).");
  }

  console.log(
    `\nNext: sparse channel_1 index →  npx tsx scripts/migrations/2026-07-b2c-channel-sparse-index.ts ${OFFICE_DB_NAME}`
  );
  console.log("✅ Office tenant provisioning done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Provisioning failed:", err);
    process.exit(1);
  });
