/**
 * Company Info Utilities
 *
 * Centralized extraction of company information from home settings.
 * Used across email templates, notifications, and campaigns.
 */

import { connectWithModels } from "@/lib/db/connection";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/constants/notification";
import type { HomeSettings } from "@/lib/types/home-settings";

// ============================================
// TYPES
// ============================================

/**
 * Company info extracted from home settings.
 * Used for template variable replacement.
 */
export interface CompanyInfo {
  company_name: string;
  logo: string;
  address: string;
  phone: string;
  email: string;
  contact_info: string;
  business_hours: string;
  primary_color: string;
  shop_name: string;
  shop_url: string;
  current_year: string;
  vat_number: string;
  footer_text: string;
}

// ============================================
// DEFAULT VALUES
// ============================================

/**
 * Get default company info when settings are not available.
 */
export function getDefaultCompanyInfo(): CompanyInfo {
  return {
    company_name: "Your Company",
    logo: "",
    address: "",
    phone: "",
    email: "",
    contact_info: "",
    business_hours: "",
    primary_color: DEFAULT_PRIMARY_COLOR,
    shop_name: "Shop",
    shop_url: "",
    current_year: new Date().getFullYear().toString(),
    vat_number: "",
    footer_text: "",
  };
}

// ============================================
// EXTRACTION FUNCTIONS
// ============================================

/**
 * Extract company info from home settings object.
 * Pure function - no DB access.
 */
export function extractCompanyInfo(settings: HomeSettings | null): CompanyInfo {
  if (!settings) return getDefaultCompanyInfo();

  const ci = settings.company_info || {};
  const br = settings.branding || {};

  // Build contact info string
  const contactParts: string[] = [];
  if (ci.phone) contactParts.push(`📞 ${ci.phone}`);
  if (ci.email) contactParts.push(`✉️ ${ci.email}`);

  // Build address string
  const addressParts = [ci.address_line1, ci.address_line2].filter(Boolean);

  // Build footer text
  const footerParts: string[] = [];
  if (ci.legal_name) footerParts.push(`© ${new Date().getFullYear()} ${ci.legal_name}`);
  if (ci.vat_number) footerParts.push(`P.IVA: ${ci.vat_number}`);

  return {
    company_name: ci.legal_name || br.title || "Your Company",
    logo: br.logo || "",
    address: addressParts.join(", "),
    phone: ci.phone || "",
    email: ci.email || "",
    contact_info: contactParts.join(" | "),
    business_hours: ci.business_hours || "",
    primary_color: br.primaryColor || DEFAULT_PRIMARY_COLOR,
    shop_name: br.title || "Shop",
    shop_url: br.shopUrl || "",
    current_year: new Date().getFullYear().toString(),
    vat_number: ci.vat_number || "",
    footer_text: footerParts.join(" - "),
  };
}

/**
 * Fetch and extract company info from database.
 * Handles DB connection and error cases.
 */
export async function getCompanyInfo(tenantDb: string): Promise<CompanyInfo> {
  try {
    const { HomeSettings } = await connectWithModels(tenantDb);
    const settings = await HomeSettings.findOne({}).lean() as HomeSettings | null;
    return extractCompanyInfo(settings);
  } catch (error) {
    console.error("Error fetching company info:", error);
    return getDefaultCompanyInfo();
  }
}

/**
 * Convert CompanyInfo to Record<string, string> for template variable replacement.
 */
export function companyInfoToRecord(info: CompanyInfo): Record<string, string> {
  return {
    company_name: info.company_name,
    logo: info.logo,
    address: info.address,
    phone: info.phone,
    email: info.email,
    contact_info: info.contact_info,
    business_hours: info.business_hours,
    primary_color: info.primary_color,
    shop_name: info.shop_name,
    shop_url: info.shop_url,
    current_year: info.current_year,
    vat_number: info.vat_number,
    footer_text: info.footer_text,
  };
}
