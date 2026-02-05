/**
 * Campaign Preview API
 *
 * POST /api/b2b/notifications/campaigns/preview - Generate email preview with header/footer
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateTenant } from "@/lib/auth/tenant-auth";
import {
  buildCampaignEmail,
  generateCustomEmailHtml,
  generateGenericEmailHtml,
} from "@/lib/notifications/email-builder";
import type { ITemplateProduct, TemplateType } from "@/lib/constants/notification";

interface CampaignPreviewPayload {
  type: TemplateType;
  // Push notification fields (for reference)
  title?: string;
  body?: string;
  // Email fields
  email_html?: string;
  email_link?: string; // Separate link for email "Vedi tutti" button
  products_url?: string; // Push notification action URL (not used in email preview)
  // Products (for product campaigns)
  products?: ITemplateProduct[];
  // Generic type (for backwards compatibility)
  url?: string;
  image?: string;
  open_in_new_tab?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateTenant(req);
    if (!auth.authenticated || !auth.tenantDb) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const tenantDb = auth.tenantDb;
    const payload: CampaignPreviewPayload = await req.json();

    const { type, email_html, email_link, products, url, image, open_in_new_tab } = payload;

    // Generate email content
    let emailContent: string;
    if (email_html) {
      // Use custom HTML with optional products and CTA link
      // email_link is used for email (separate from products_url which is for push notifications)
      emailContent = generateCustomEmailHtml(email_html, email_link, products, type);
    } else if (type === "generic") {
      emailContent = generateGenericEmailHtml(
        "Titolo campagna",
        "",
        url,
        image,
        open_in_new_tab
      );
    } else {
      emailContent = "<p>Nessun contenuto email configurato.</p>";
    }

    // Build complete email with header, wrapper, and footer
    const fullHtml = await buildCampaignEmail(tenantDb, emailContent);

    return NextResponse.json({
      success: true,
      html: fullHtml,
    });
  } catch (error) {
    console.error("Error generating preview:", error);
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}
