/**
 * Tenant branding lookup for the public auth pages (SSO login, forgot password).
 *
 * Pulls the storefront branding from the tenant's home settings, falling back to
 * the admin-tenant name and finally the raw tenant id. Used to theme the auth
 * shell with the tenant's logo, accent color and "back to shop"/website links.
 */

import { getHomeSettings } from "@/lib/db/home-settings";
import { getTenantModel } from "@/lib/db/models/admin-tenant";

export interface TenantBranding {
  title: string;
  logo: string | null;
  favicon: string | null;
  primaryColor: string;
  shopUrl: string | null;
  websiteUrl: string | null;
  description: string | null;
  legalName: string | null;
  addressLines: string[];
  phone: string | null;
  email: string | null;
  vatNumber: string | null;
  b2bTheme: string | null;
}

/** Default accent color used when a tenant has no branding (or no tenant given). */
export const DEFAULT_ACCENT_COLOR = "#6366f1";

export async function getTenantBranding(tenantId: string): Promise<TenantBranding | null> {
  try {
    // Fetch home settings branding and admin tenant name in parallel.
    const tenantDb = `vinc-${tenantId}`;
    const [settings, adminTenant] = await Promise.all([
      getHomeSettings(tenantDb).catch(() => null),
      getTenantModel().then((m) => m.findByTenantId(tenantId)).catch(() => null),
    ]);

    const branding = settings?.branding;
    const companyInfo = settings?.company_info;
    const adminName = adminTenant?.name;

    // Use branding title, fall back to admin tenant name, then tenant_id.
    const title = branding?.title || adminName || tenantId;

    return {
      title,
      logo: branding?.logo || null,
      favicon: branding?.favicon || null,
      primaryColor: branding?.primaryColor || DEFAULT_ACCENT_COLOR,
      shopUrl: branding?.shopUrl || null,
      websiteUrl: branding?.websiteUrl || null,
      description:
        settings?.meta_tags?.description ||
        settings?.meta_tags?.ogDescription ||
        null,
      legalName: companyInfo?.legal_name || null,
      addressLines: [
        companyInfo?.address_line1?.trim(),
        companyInfo?.address_line2?.trim(),
      ].filter((line): line is string => Boolean(line)),
      phone: companyInfo?.phone || null,
      email: companyInfo?.email || companyInfo?.support_email || null,
      vatNumber: companyInfo?.vat_number || null,
      b2bTheme: adminTenant?.b2b_theme || null,
    };
  } catch (error) {
    console.error("Error fetching tenant branding:", error);
    return null;
  }
}
