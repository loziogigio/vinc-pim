/**
 * Campaign Test API
 *
 * POST /api/b2b/notifications/campaigns/test - Send test email
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { getTemplate, previewTemplateInline } from "@/lib/notifications/template.service";
import { sendEmail } from "@/lib/email";
import { connectWithModels } from "@/lib/db/connection";

export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const body = await req.json();

    const { template_id, channels, test_email } = body;

    if (!template_id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }

    if (!test_email) {
      return NextResponse.json({ error: "Test email address is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(test_email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Get template
    const template = await getTemplate(tenantDb, template_id);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Check if email channel is enabled and selected
    if (!channels?.includes("email") || !template.channels?.email?.enabled) {
      return NextResponse.json(
        { error: "Email channel is not available for this template" },
        { status: 400 }
      );
    }

    // Variables that should always use real values from Home Settings (not placeholders)
    const COMPANY_VARIABLES = [
      "company_name", "shop_name", "logo", "primary_color",
      "address", "address_line1", "address_line2",
      "phone", "email", "contact_info", "business_hours",
      "vat_number", "support_email", "current_year"
    ];

    // Prepare test data with placeholder values for template variables
    // BUT exclude company-related variables that should use real values
    const testData: Record<string, string> = {};
    template.variables.forEach((variable) => {
      if (!COMPANY_VARIABLES.includes(variable)) {
        testData[variable] = `[${variable}]`;
      }
    });

    // Get company info from home settings for email variables
    const { HomeSettings } = await connectWithModels(tenantDb);
    let companyInfo: Record<string, string> = {};
    try {
      const settings = await HomeSettings.findOne({}).lean();
      if (settings) {
        const ci = (settings as { company_info?: Record<string, string>; branding?: { title?: string; logo?: string; primaryColor?: string } }).company_info || {};
        const br = (settings as { branding?: { title?: string; logo?: string; primaryColor?: string } }).branding || {};

        const contactParts = [];
        if (ci.phone) contactParts.push(`📞 ${ci.phone}`);
        if (ci.email) contactParts.push(`✉️ ${ci.email}`);

        companyInfo = {
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
      }
    } catch (error) {
      console.error("Error fetching company info for test email:", error);
    }

    // Merge company info with test data (test data has higher priority)
    const mergedData = { ...companyInfo, ...testData };

    // Use previewTemplateInline to combine header + content + footer
    const preview = await previewTemplateInline(tenantDb, {
      html_body: template.channels.email.html_body,
      subject: template.channels.email.subject,
      use_default_header: template.use_default_header,
      use_default_footer: template.use_default_footer,
      header_id: template.header_id,
      footer_id: template.footer_id,
    }, mergedData);

    // Replace variables in plain text
    let textBody = template.channels.email.text_body || "";
    for (const [key, value] of Object.entries(mergedData)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      textBody = textBody.replace(regex, value);
    }

    // Send test email immediately (bypass queue for test emails)
    const result = await sendEmail({
      to: test_email,
      subject: `[TEST] ${preview.subject}`,
      html: preview.html,
      text: textBody,
      immediate: true,
      tags: ["test"],
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
      template_id,
    });
  } catch (error) {
    console.error("Error sending test email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send test email" },
      { status: 500 }
    );
  }
}
