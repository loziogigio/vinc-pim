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
  products_url?: string;
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

    const { type, email_html, products_url, products, url, image, open_in_new_tab } = payload;

    // Generate email content
    let emailContent: string;
    if (email_html) {
      // Use custom HTML with optional products and "Vedi tutti" link
      emailContent = generateCustomEmailHtml(email_html, products_url, products);
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
