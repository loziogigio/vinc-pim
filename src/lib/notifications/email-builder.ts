/**
 * Email Builder Utilities
 *
 * Shared functions for building campaign emails with header/footer.
 */

import { getDefaultHeader, getDefaultFooter } from "./template.service";
import { getCompanyInfo, companyInfoToRecord } from "./company-info";
import type { ITemplateProduct } from "@/lib/constants/notification";

// Re-export company info utilities for convenience
export { getCompanyInfo, companyInfoToRecord, extractCompanyInfo, getDefaultCompanyInfo } from "./company-info";
export type { CompanyInfo } from "./company-info";

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
 * Uses max-width for responsive behavior on mobile.
 * No border-radius as this sits between header (rounded top) and footer (rounded bottom).
 */
export function wrapEmailContent(content: string): string {
  return `
<style type="text/css">
  @media only screen and (max-width: 620px) {
    .email-container {
      width: 100% !important;
      max-width: 100% !important;
    }
    .email-content {
      padding: 28px 20px !important;
    }
  }
</style>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f6fa;">
  <tr>
    <td align="center" style="padding: 0 12px;">
      <!--[if mso]>
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" align="center">
      <tr><td>
      <![endif]-->
      <div class="email-container" style="max-width: 600px; width: 100%; margin: 0 auto;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff;">
          <tr>
            <td class="email-content" style="padding: 36px 32px;">
              ${content}
            </td>
          </tr>
        </table>
      </div>
      <!--[if mso]>
      </td></tr></table>
      <![endif]-->
    </td>
  </tr>
</table>
`.trim();
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
 * Uses mobile-first responsive design that stacks on small screens.
 *
 * Technique: Uses inline-block divs that wrap naturally on narrow screens.
 * Each product card has max-width for desktop, but becomes full-width on mobile.
 */
function generateProductGridHtml(products: ITemplateProduct[]): string {
  if (!products || products.length === 0) return "";

  const productCards = products.map((p) => `
    <!--[if mso]>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="280" align="left">
    <tr><td style="padding: 8px;">
    <![endif]-->
    <div style="display: inline-block; width: 100%; max-width: 280px; vertical-align: top; box-sizing: border-box; padding: 8px;">
      <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; background: #fff;">
        <div style="text-align: center; margin-bottom: 12px;">
          <img src="${p.image || "/placeholder-product.png"}" alt="${truncateText(p.name, 50)}" width="200" height="160" style="max-width: 100%; height: auto; object-fit: contain;" />
        </div>
        <p style="font-size: 12px; color: #6b7280; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">${p.sku}</p>
        <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0; line-height: 1.4;">${truncateText(p.name, 80)}</p>
      </div>
    </div>
    <!--[if mso]>
    </td></tr></table>
    <![endif]-->
  `).join("");

  return `
<style type="text/css">
  @media only screen and (max-width: 600px) {
    .product-grid-container {
      text-align: center !important;
    }
    .product-grid-container > div {
      max-width: 100% !important;
      display: block !important;
      margin: 0 auto 16px auto !important;
    }
  }
</style>
<div class="product-grid-container" style="margin-top: 24px; text-align: center; font-size: 0;">
  ${productCards}
</div>
`;
}

/**
 * Generate email HTML from custom HTML content with optional products and CTA link.
 * Used when user provides their own HTML content.
 *
 * @param campaignType - "product" uses "Vedi tutti", "generic" uses "Apri"
 */
export function generateCustomEmailHtml(
  htmlContent: string,
  ctaUrl?: string,
  products?: ITemplateProduct[],
  campaignType: "product" | "generic" = "product"
): string {
  const productGridHtml = generateProductGridHtml(products || []);
  const ctaLabel = campaignType === "generic" ? "Apri" : "Vedi tutti";

  return `
${htmlContent}

${productGridHtml}

${
  ctaUrl
    ? `
<div style="margin-top: 24px; text-align: center;">
  <a href="${ctaUrl}" style="display: inline-block; background: #007bff; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600;" target="_blank">
    ${ctaLabel}
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
  // Get company info and convert to record for template variables
  const companyInfo = await getCompanyInfo(tenantDb);
  const templateVars = companyInfoToRecord(companyInfo);

  // Fetch header and footer
  const [defaultHeader, defaultFooter] = await Promise.all([
    getDefaultHeader(tenantDb),
    getDefaultFooter(tenantDb),
  ]);

  // Process header and footer with variable replacement
  let headerHtml = defaultHeader?.html_content || "";
  let footerHtml = defaultFooter?.html_content || "";

  headerHtml = replaceTemplateVariables(headerHtml, templateVars);
  footerHtml = replaceTemplateVariables(footerHtml, templateVars);

  // Wrap content in container
  const wrappedContent = wrapEmailContent(content);

  // Combine header + wrapped content + footer
  return `${headerHtml}${wrappedContent}${footerHtml}`;
}
