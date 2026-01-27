/**
 * Email Builder Utilities
 *
 * Shared functions for building campaign emails with header/footer.
 */

import { connectWithModels } from "@/lib/db/connection";
import { getDefaultHeader, getDefaultFooter } from "./template.service";
import type { ITemplateProduct } from "@/lib/constants/notification";

/**
 * Replace template variables in HTML content.
 * Handles both simple variables {{var}} and conditionals {{#if var}}...{{else}}...{{/if}}
 */
export function replaceTemplateVariables(
  html: string,
  data: Record<string, string>
): string {
  let result = html;

  // Replace simple variables
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    result = result.replace(regex, value);
  }

  // Handle conditional blocks with else - {{#if variable}}...{{else}}...{{/if}}
  result = result.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, varName, ifContent, elseContent) => {
      const hasValue = data[varName] && data[varName].trim() !== "";
      return hasValue ? ifContent : elseContent;
    }
  );

  // Handle conditional blocks without else - {{#if variable}}...{{/if}}
  result = result.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, varName, content) => {
      const hasValue = data[varName] && data[varName].trim() !== "";
      return hasValue ? content : "";
    }
  );

  return result;
}

/**
 * Wrap email content in a proper table-based container.
 */
export function wrapEmailContent(content: string): string {
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f6fa;">
  <tr>
    <td align="center" style="padding: 0 20px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff;">
        <tr>
          <td style="padding: 40px;">
            ${content}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();
}

/**
 * Get company info from home settings.
 */
export async function getCompanyInfo(tenantDb: string): Promise<Record<string, string>> {
  const { HomeSettings } = await connectWithModels(tenantDb);

  try {
    const settings = await HomeSettings.findOne({}).lean();
    if (!settings) return getDefaultCompanyInfo();

    const ci = (settings as { company_info?: Record<string, string>; branding?: { title?: string; logo?: string; primaryColor?: string } }).company_info || {};
    const br = (settings as { branding?: { title?: string; logo?: string; primaryColor?: string } }).branding || {};

    const contactParts = [];
    if (ci.phone) contactParts.push(`📞 ${ci.phone}`);
    if (ci.email) contactParts.push(`✉️ ${ci.email}`);

    return {
      company_name: ci.legal_name || br.title || "Your Company",
      logo: br.logo || "",
      address: [ci.address_line1, ci.address_line2].filter(Boolean).join(", "),
      phone: ci.phone || "",
      email: ci.email || "",
      contact_info: contactParts.join(" | ") || "",
      business_hours: ci.business_hours || "",
      primary_color: br.primaryColor || "#009f7f",
      shop_name: br.title || "Shop",
      current_year: new Date().getFullYear().toString(),
    };
  } catch (error) {
    console.error("Error fetching company info:", error);
    return getDefaultCompanyInfo();
  }
}

function getDefaultCompanyInfo(): Record<string, string> {
  return {
    company_name: "Your Company",
    logo: "",
    address: "",
    phone: "",
    email: "",
    contact_info: "",
    business_hours: "",
    primary_color: "#009f7f",
    shop_name: "Shop",
    current_year: new Date().getFullYear().toString(),
  };
}

/**
 * Truncate text to a maximum length.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Generate product grid HTML for email.
 * Uses table layout for email compatibility with fixed height boxes.
 */
function generateProductGridHtml(products: ITemplateProduct[]): string {
  if (!products || products.length === 0) return "";

  // Build product rows (2 per row)
  const productRows: string[] = [];
  for (let i = 0; i < products.length; i += 2) {
    const p1 = products[i];
    const p2 = products[i + 1];

    productRows.push(`
    <tr>
      <td style="width: 50%; padding: 8px; vertical-align: top;">
        <div style="border: 1px solid #eee; border-radius: 8px; padding: 12px; height: 240px; box-sizing: border-box;">
          <img src="${p1.image || "/placeholder-product.png"}" alt="${truncateText(p1.name, 50)}" style="width: 100%; height: 140px; object-fit: contain; margin-bottom: 8px;" />
          <p style="font-size: 11px; color: #999; margin: 0; text-transform: uppercase;">${p1.sku}</p>
          <p style="font-size: 13px; font-weight: 600; color: #333; margin: 4px 0 0 0; line-height: 1.3; overflow: hidden; max-height: 34px;">${truncateText(p1.name, 60)}</p>
        </div>
      </td>
      ${p2 ? `
      <td style="width: 50%; padding: 8px; vertical-align: top;">
        <div style="border: 1px solid #eee; border-radius: 8px; padding: 12px; height: 240px; box-sizing: border-box;">
          <img src="${p2.image || "/placeholder-product.png"}" alt="${truncateText(p2.name, 50)}" style="width: 100%; height: 140px; object-fit: contain; margin-bottom: 8px;" />
          <p style="font-size: 11px; color: #999; margin: 0; text-transform: uppercase;">${p2.sku}</p>
          <p style="font-size: 13px; font-weight: 600; color: #333; margin: 4px 0 0 0; line-height: 1.3; overflow: hidden; max-height: 34px;">${truncateText(p2.name, 60)}</p>
        </div>
      </td>
      ` : '<td style="width: 50%; padding: 8px;"></td>'}
    </tr>
    `);
  }

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 24px;">
  ${productRows.join("")}
</table>
`;
}

/**
 * Generate email HTML from custom HTML content with optional products and "Vedi tutti" link.
 * Used when user provides their own HTML content.
 */
export function generateCustomEmailHtml(
  htmlContent: string,
  ctaUrl?: string,
  products?: ITemplateProduct[]
): string {
  const productGridHtml = generateProductGridHtml(products || []);

  return `
${htmlContent}

${productGridHtml}

${
  ctaUrl
    ? `
<div style="margin-top: 24px; text-align: center;">
  <a href="${ctaUrl}" style="display: inline-block; background: #007bff; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600;" target="_blank">
    Vedi tutti
  </a>
</div>
`
    : ""
}
`.trim();
}

/**
 * Generate email HTML for generic campaign.
 */
export function generateGenericEmailHtml(
  title: string,
  body: string,
  url?: string,
  image?: string,
  openInNewTab = true
): string {
  return `
<h1 style="color: #333; margin: 0 0 16px 0; font-size: 24px;">${title}</h1>

${
  image
    ? `
<div style="margin-bottom: 20px;">
  <img src="${image}" alt="${title}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px;" />
</div>
`
    : ""
}

<p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">${body}</p>

${
  url
    ? `
<div style="margin-top: 24px; text-align: center;">
  <a href="${url}" style="display: inline-block; background: #007bff; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600;" ${openInNewTab ? 'target="_blank"' : ""}>
    Scopri di più
  </a>
</div>
`
    : ""
}
`.trim();
}

/**
 * Build complete campaign email with header, content wrapper, and footer.
 */
export async function buildCampaignEmail(
  tenantDb: string,
  content: string
): Promise<string> {
  // Get company info
  const companyInfo = await getCompanyInfo(tenantDb);

  // Fetch header and footer
  const [defaultHeader, defaultFooter] = await Promise.all([
    getDefaultHeader(tenantDb),
    getDefaultFooter(tenantDb),
  ]);

  // Process header and footer with variable replacement
  let headerHtml = defaultHeader?.html_content || "";
  let footerHtml = defaultFooter?.html_content || "";

  headerHtml = replaceTemplateVariables(headerHtml, companyInfo);
  footerHtml = replaceTemplateVariables(footerHtml, companyInfo);

  // Wrap content in container
  const wrappedContent = wrapEmailContent(content);

  // Combine header + wrapped content + footer
  return `${headerHtml}${wrappedContent}${footerHtml}`;
}
