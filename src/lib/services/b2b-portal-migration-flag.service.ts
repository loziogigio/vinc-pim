/**
 * B2B Portal Migration Flag Service
 *
 * Per-tenant flag on the admin tenant record that indicates whether
 * this tenant has been migrated from b2bhomesettings to b2bportals.
 *
 * Consumed by:
 *  - The migration script (reads + writes)
 *  - The new API route handlers (reads, to gate writes)
 *  - The verify script (reads)
 */

import { getTenantModel } from "@/lib/db/models/admin-tenant";

export async function isTenantMigrated(tenantId: string): Promise<boolean> {
  const Tenant = await getTenantModel();
  const doc = await Tenant.findOne({ tenant_id: tenantId })
    .select("b2b_portal_migrated_at")
    .lean();
  return Boolean(doc?.b2b_portal_migrated_at);
}

export async function markTenantMigrated(tenantId: string): Promise<void> {
  const Tenant = await getTenantModel();
  await Tenant.updateOne(
    { tenant_id: tenantId },
    { $set: { b2b_portal_migrated_at: new Date() } },
  );
}

export async function clearTenantMigrationFlag(tenantId: string): Promise<void> {
  const Tenant = await getTenantModel();
  await Tenant.updateOne(
    { tenant_id: tenantId },
    { $set: { b2b_portal_migrated_at: null } },
  );
}

export async function listUnmigratedTenants(): Promise<string[]> {
  const Tenant = await getTenantModel();
  const docs = await Tenant.find({
    $or: [
      { b2b_portal_migrated_at: null },
      { b2b_portal_migrated_at: { $exists: false } },
    ],
    status: "active",
  })
    .select("tenant_id")
    .lean();
  return docs.map((d: { tenant_id: string }) => d.tenant_id);
}
