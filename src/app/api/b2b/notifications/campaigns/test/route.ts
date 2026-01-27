/**
 * Campaign Test API
 *
 * POST /api/b2b/notifications/campaigns/test - Send test notification
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { sendEmail } from "@/lib/email";
import {
  buildCampaignEmail,
  generateCustomEmailHtml,
  generateGenericEmailHtml,
} from "@/lib/notifications/email-builder";
import type { ITemplateProduct, TemplateType } from "@/lib/constants/notification";

interface CampaignTestPayload {
  type: TemplateType;
  // Push notification fields
  title?: string;
  body?: string;
  // Email fields
  email_subject?: string;
  email_html?: string;
  products_url?: string;
  // Products (for product campaigns)
  products?: ITemplateProduct[];
  // Test
  channels: ("email" | "mobile" | "web_in_app")[];
  test_email: string;
  // Generic type (for backwards compatibility)
  url?: string;
  image?: string;
  open_in_new_tab?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const body: CampaignTestPayload = await req.json();

    const { type, title, body: messageBody, email_subject, email_html, products_url, products, channels, test_email, url, image, open_in_new_tab } = body;

    // Validate required fields
    if (!type || !["product", "generic"].includes(type)) {
      return NextResponse.json({ error: "Invalid campaign type" }, { status: 400 });
    }

    if (!test_email) {
      return NextResponse.json({ error: "Test email address is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(test_email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Check if email channel is selected
    if (!channels?.includes("email")) {
      return NextResponse.json(
        { error: "Email channel must be selected for test" },
        { status: 400 }
      );
    }

    // Generate email content
    let emailContent: string;
    if (email_html) {
      emailContent = generateCustomEmailHtml(email_html, products_url, products);
    } else if (type === "generic") {
      emailContent = generateGenericEmailHtml(title || "Test", messageBody || "", url, image, open_in_new_tab);
    } else {
      emailContent = "<p>Nessun contenuto email configurato.</p>";
    }

    // Build complete email with header, wrapper, and footer
    const fullHtml = await buildCampaignEmail(tenantDb, emailContent);

    // Send test email - use email_subject if provided, otherwise fall back to title
    const subject = email_subject || title || "Campagna";
    const result = await sendEmail({
      to: test_email,
      subject: `[TEST] ${subject}`,
      html: fullHtml,
      text: messageBody || "Test email",
      immediate: true,
      tags: ["test", "campaign", type],
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send test email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${test_email}`,
      channels_sent: ["email"],
    });
  } catch (error) {
    console.error("Error sending test email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send test email" },
      { status: 500 }
    );
  }
}
