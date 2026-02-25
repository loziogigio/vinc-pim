/**
 * Vetrina Service
 *
 * Handles cross-database aggregation for the public tenant listing.
 * Fetches home-settings (branding + company_info) from each listed tenant's database.
 */

import { getTenantModel, ITenant } from "../db/models/admin-tenant";
import { getHomeSettings } from "../db/home-settings";

// ============================================
// TYPES
// ============================================

export interface VetrinaTenantProfile {
  tenant_id: string;
  name: string;
  branding: {
    title: string;
    logo?: string;
    primaryColor?: string;
    shopUrl?: string;
    websiteUrl?: string;
  };
  company_info: {
    legal_name?: string;
    address_line1?: string;
    address_line2?: string;
    phone?: string;
    email?: string;
  };
  meta: {
    description?: string;
    ogImage?: string;
  };
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * List all tenants that have opted-in to the public vetrina listing.
 * For each, reads their home-settings to build a public profile card.
 *
 * Uses Promise.allSettled so one failing tenant DB does not break the listing.
 * Uses the connection pool (connectWithModels) for efficient cross-DB reads.
 */
export async function listVetrinaTenants(): Promise<VetrinaTenantProfile[]> {
  const TenantModel = await getTenantModel();

  const tenants = await TenantModel.find({
    status: "active",
    "vetrina.is_listed": true,
  })
    .select("tenant_id name mongo_db")
    .lean<ITenant[]>();

  if (tenants.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(
    tenants.map(async (tenant): Promise<VetrinaTenantProfile> => {
      const tenantDb = tenant.mongo_db || `vinc-${tenant.tenant_id}`;
      const settings = await getHomeSettings(tenantDb);

      return {
        tenant_id: tenant.tenant_id,
        name: tenant.name,
        branding: {
          title: settings?.branding?.title || tenant.name,
          logo: settings?.branding?.logo,
          primaryColor: settings?.branding?.primaryColor,
          shopUrl: settings?.branding?.shopUrl,
          websiteUrl: settings?.branding?.websiteUrl,
        },
        company_info: {
          legal_name: settings?.company_info?.legal_name,
          address_line1: settings?.company_info?.address_line1,
          address_line2: settings?.company_info?.address_line2,
          phone: settings?.company_info?.phone,
          email: settings?.company_info?.email,
        },
        meta: {
          description: settings?.meta_tags?.description,
          ogImage: settings?.meta_tags?.ogImage,
        },
      };
    })
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<VetrinaTenantProfile> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value);
}
