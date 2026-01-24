/**
 * Template Preview API
 *
 * POST /api/b2b/notifications/templates/[id]/preview - Get rendered preview
 *
 * Request:
 * {
 *   "channel": "email",           // Channel to preview
 *   "variables": {                // Optional custom variable values
 *     "customer_name": "Mario Rossi",
 *     "company_name": "Acme S.r.l"
 *   }
 * }
 *
 * Response:
 * {
 *   "subject": "Rendered subject with values",
 *   "html": "<html>Rendered HTML</html>",
 *   "text": "Plain text version"
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { getTemplate, previewTemplate, previewTemplateInline } from "@/lib/notifications/template.service";
import { connectWithModels } from "@/lib/db/connection";

// Sample variable values for preview
const SAMPLE_VARIABLES: Record<string, string> = {
  customer_name: "Mario Rossi",
  company_name: "Azienda Demo S.r.l",
  email: "mario.rossi@example.com",
  phone: "+39 333 1234567",
  address: "Via Roma 123, 00100 Roma",
  vat_number: "IT12345678901",
  username: "mario.rossi",
  password: "********",
  login_url: "https://example.com/login",
  order_id: "ORD-2024-001234",
  order_total: "€ 1.250,00",
  order_date: new Date().toLocaleDateString("it-IT"),
  tracking_number: "1Z999AA10123456784",
  tracking_url: "https://tracking.example.com/1Z999AA10123456784",
  product_name: "Prodotto Demo",
  product_price: "€ 99,00",
  cart_url: "https://example.com/cart",
  shop_name: "Demo Shop",
  support_email: "supporto@example.com",
  support_phone: "+39 02 1234567",
  current_year: new Date().getFullYear().toString(),
  primary_color: "#009f7f",
  // Company contact info (will be replaced with actual from home settings)
  contact_info: "+39 333 1234567 | info@example.com",
  business_hours: "Lun-Ven 9:00-18:00",
};

function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    result = result.replace(regex, value);
  }
  // Replace any remaining variables with placeholder
  result = result.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, varName) => `[${varName}]`);
  return result;
}

/**
 * Get company info from home settings for preview variables.
 */
async function getCompanyInfoVariables(tenantDb: string): Promise<Record<string, string>> {
  try {
    const { HomeSettings } = await connectWithModels(tenantDb);
    const settings = await HomeSettings.findOne({}).lean();

    if (!settings) {
      return {};
    }

    const companyInfo = (settings as { company_info?: Record<string, string>; branding?: { title?: string; logo?: string; primaryColor?: string; shopUrl?: string } }).company_info || {};
    const branding = (settings as { branding?: { title?: string; logo?: string; primaryColor?: string; shopUrl?: string } }).branding || {};

    // Build contact_info from phone and email
    const contactParts = [];
    if (companyInfo.phone) contactParts.push(`📞 ${companyInfo.phone}`);
    if (companyInfo.email) contactParts.push(`✉️ ${companyInfo.email}`);

    return {
      company_name: companyInfo.legal_name || branding.title || "Your Company",
      logo: branding.logo || "",
      address: [companyInfo.address_line1, companyInfo.address_line2].filter(Boolean).join(", "),
      phone: companyInfo.phone || "",
      email: companyInfo.email || "",
      vat_number: companyInfo.vat_number || "",
      support_email: companyInfo.support_email || companyInfo.email || "",
      business_hours: companyInfo.business_hours || "",
      contact_info: contactParts.join(" | ") || "Contact us",
      primary_color: branding.primaryColor || "#009f7f",
      shop_name: branding.title || "Shop",
      login_url: branding.shopUrl ? `${branding.shopUrl}/login` : "https://example.com/login",
    };
  } catch (error) {
    console.error("Error fetching company info:", error);
    return {};
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantDb = `vinc-${session.tenantId}`;
    const body = await req.json();

    const {
      channel = "email",
      variables = {},
      // Optional inline template data for real-time preview of unsaved changes
      template_data,
    } = body;

    // Get template from DB (needed for fallback values)
    const template = await getTemplate(tenantDb, id);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Get company info from home settings
    const companyInfoVars = await getCompanyInfoVariables(tenantDb);

    // Merge: sample variables + company info + custom variables (priority)
    const mergedVariables = { ...SAMPLE_VARIABLES, ...companyInfoVars, ...variables };

    if (channel === "email") {
      const emailChannel = template.channels?.email;
      if (!emailChannel && !template_data) {
        return NextResponse.json(
          { error: "Email channel not configured" },
          { status: 400 }
        );
      }

      let preview;

      // If template_data is provided, use inline preview (for unsaved changes)
      if (template_data) {
        preview = await previewTemplateInline(tenantDb, {
          html_body: template_data.html_body || emailChannel?.html_body || "",
          subject: template_data.subject || emailChannel?.subject || "",
          use_default_header: template_data.use_default_header,
          use_default_footer: template_data.use_default_footer,
          header_id: template_data.header_id,
          footer_id: template_data.footer_id,
        }, mergedVariables);
      } else {
        // Use saved template for preview
        preview = await previewTemplate(tenantDb, id, mergedVariables);
      }

      if (!preview) {
        return NextResponse.json(
          { error: "Failed to generate preview" },
          { status: 500 }
        );
      }

      const text = replaceVariables(
        template_data?.text_body || emailChannel?.text_body || "",
        mergedVariables
      );

      return NextResponse.json({
        subject: preview.subject,
        html: preview.html,
        text,
        variables: template.variables,
        sample_values: mergedVariables,
      });
    }

    if (channel === "web_push") {
      const webPushChannel = template.channels?.web_push;
      if (!webPushChannel) {
        return NextResponse.json(
          { error: "Web push channel not configured" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        title: replaceVariables(webPushChannel.title || "", mergedVariables),
        body: replaceVariables(webPushChannel.body || "", mergedVariables),
        action_url: replaceVariables(webPushChannel.action_url || "", mergedVariables),
      });
    }

    if (channel === "mobile_push") {
      const mobilePushChannel = template.channels?.mobile_push;
      if (!mobilePushChannel) {
        return NextResponse.json(
          { error: "Mobile push channel not configured" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        title: replaceVariables(mobilePushChannel.title || "", mergedVariables),
        body: replaceVariables(mobilePushChannel.body || "", mergedVariables),
      });
    }

    if (channel === "sms") {
      const smsChannel = template.channels?.sms;
      if (!smsChannel) {
        return NextResponse.json(
          { error: "SMS channel not configured" },
          { status: 400 }
        );
      }

      const body = replaceVariables(smsChannel.body || "", mergedVariables);
      return NextResponse.json({
        body,
        character_count: body.length,
        segments: Math.ceil(body.length / 160),
      });
    }

    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  } catch (error) {
    console.error("Error generating preview:", error);
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}
