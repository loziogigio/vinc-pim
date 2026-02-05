/**
 * Seed Default Email Components API
 *
 * POST /api/b2b/notifications/components/seed - Seed default header and footer
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateTenant } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

// Default Header HTML - Uses variables for branding (responsive with MSO conditionals)
const DEFAULT_HEADER_HTML = `
<style type="text/css">
  @media only screen and (max-width: 620px) {
    .header-container { max-width: 100% !important; }
    .header-content { padding: 24px 20px !important; }
    .header-logo { max-width: 160px !important; }
  }
</style>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f6fa;">
  <tr>
    <td align="center" style="padding: 32px 12px 0 12px;">
      <!--[if mso]>
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" align="center">
      <tr><td>
      <![endif]-->
      <div class="header-container" style="max-width: 600px; width: 100%; margin: 0 auto;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: {{primary_color}}; background: linear-gradient(135deg, {{primary_color}} 0%, #1e3a5f 100%); border-radius: 16px 16px 0 0;">
          <tr>
            <td class="header-content" align="center" style="padding: 40px 32px;">
              {{#if logo}}
                <img src="{{logo}}" alt="{{company_name}}" class="header-logo" style="max-height: 56px; max-width: 220px;" />
              {{else}}
                <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">{{company_name}}</h1>
              {{/if}}
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

// Default Footer HTML - Uses variables for company info (responsive with MSO conditionals)
const DEFAULT_FOOTER_HTML = `
<style type="text/css">
  @media only screen and (max-width: 620px) {
    .footer-container { max-width: 100% !important; }
    .footer-content { padding: 24px 20px !important; }
    .footer-info-table td { display: block !important; text-align: center !important; padding: 6px 0 !important; }
  }
</style>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f6fa;">
  <tr>
    <td align="center" style="padding: 0 12px 32px 12px;">
      <!--[if mso]>
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" align="center">
      <tr><td>
      <![endif]-->
      <div class="footer-container" style="max-width: 600px; width: 100%; margin: 0 auto;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #1e293b; border-radius: 0 0 16px 16px;">
          <tr>
            <td class="footer-content" style="padding: 32px;">
              <!-- Company Name -->
              <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: #ffffff; text-align: center;">
                {{company_name}}
              </p>

              <!-- Contact Info with Icons -->
              <table role="presentation" class="footer-info-table" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
                <tr>
                  {{#if address}}
                  <td style="padding: 8px 12px; text-align: center;">
                    <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                      <span style="color: #60a5fa;">📍</span> {{address}}
                    </p>
                  </td>
                  {{/if}}
                </tr>
                <tr>
                  {{#if contact_info}}
                  <td style="padding: 8px 12px; text-align: center;">
                    <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                      <span style="color: #60a5fa;">📞</span> {{contact_info}}
                    </p>
                  </td>
                  {{/if}}
                </tr>
                <tr>
                  {{#if business_hours}}
                  <td style="padding: 8px 12px; text-align: center;">
                    <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                      <span style="color: #60a5fa;">🕐</span> {{business_hours}}
                    </p>
                  </td>
                  {{/if}}
                </tr>
              </table>

              <!-- Divider -->
              <div style="border-top: 1px solid #334155; margin: 16px 0;"></div>

              <!-- Auto-email notice (subtle) -->
              <p style="margin: 0 0 12px 0; font-size: 11px; color: #64748b; text-align: center;">
                Questa è un'email automatica. Non rispondere a questo messaggio.
              </p>

              <!-- Copyright -->
              <p style="margin: 0; font-size: 12px; color: #64748b; text-align: center;">
                &copy; {{current_year}} {{company_name}}. Tutti i diritti riservati.
              </p>
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

// Minimal Header (simple version with responsive support)
const MINIMAL_HEADER_HTML = `
<style type="text/css">
  @media only screen and (max-width: 620px) {
    .header-minimal-container { max-width: 100% !important; }
    .header-minimal-content { padding: 20px 16px !important; }
  }
</style>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f6fa;">
  <tr>
    <td align="center" style="padding: 24px 12px 0 12px;">
      <!--[if mso]>
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" align="center">
      <tr><td>
      <![endif]-->
      <div class="header-minimal-container" style="max-width: 600px; width: 100%; margin: 0 auto;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: {{primary_color}}; border-radius: 12px 12px 0 0;">
          <tr>
            <td class="header-minimal-content" align="center" style="padding: 24px 32px;">
              <span style="font-size: 22px; font-weight: 600; color: #ffffff;">{{company_name}}</span>
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

// Minimal Footer (simple version with responsive support)
const MINIMAL_FOOTER_HTML = `
<style type="text/css">
  @media only screen and (max-width: 620px) {
    .footer-minimal-container { max-width: 100% !important; }
    .footer-minimal-content { padding: 16px !important; }
  }
</style>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f6fa;">
  <tr>
    <td align="center" style="padding: 0 12px 24px 12px;">
      <!--[if mso]>
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" align="center">
      <tr><td>
      <![endif]-->
      <div class="footer-minimal-container" style="max-width: 600px; width: 100%; margin: 0 auto;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #334155; border-radius: 0 0 12px 12px;">
          <tr>
            <td class="footer-minimal-content" align="center" style="padding: 20px 32px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; {{current_year}} {{company_name}}. Tutti i diritti riservati.
              </p>
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

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateTenant(req);
    if (!auth.authenticated || !auth.tenantDb) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const tenantDb = auth.tenantDb;
    const { EmailComponent } = await connectWithModels(tenantDb);

    // Check if defaults already exist
    const existingDefaults = await EmailComponent.countDocuments({ is_default: true });

    const body = await req.json().catch(() => ({}));
    const force = body.force === true;

    if (existingDefaults > 0 && !force) {
      return NextResponse.json({
        success: false,
        message: "Default components already exist. Use force=true to recreate.",
        existing: existingDefaults,
      });
    }

    // If forcing, remove old defaults
    if (force) {
      await EmailComponent.deleteMany({ is_default: true });
    }

    // Create default components
    const components = await EmailComponent.insertMany([
      {
        component_id: "header_default",
        type: "header",
        name: "Header Standard",
        description: "Header predefinito con logo e nome azienda",
        html_content: DEFAULT_HEADER_HTML,
        variables: ["logo", "company_name", "primary_color"],
        is_default: true,
        is_active: true,
      },
      {
        component_id: "header_minimal",
        type: "header",
        name: "Header Minimale",
        description: "Header semplice solo con nome azienda",
        html_content: MINIMAL_HEADER_HTML,
        variables: ["company_name", "primary_color"],
        is_default: false,
        is_active: true,
      },
      {
        component_id: "footer_default",
        type: "footer",
        name: "Footer Standard",
        description: "Footer predefinito con info aziendali complete",
        html_content: DEFAULT_FOOTER_HTML,
        variables: ["company_name", "address", "contact_info", "business_hours", "current_year"],
        is_default: true,
        is_active: true,
      },
      {
        component_id: "footer_minimal",
        type: "footer",
        name: "Footer Minimale",
        description: "Footer semplice solo con copyright",
        html_content: MINIMAL_FOOTER_HTML,
        variables: ["company_name", "current_year"],
        is_default: false,
        is_active: true,
      },
    ]);

    return NextResponse.json({
      success: true,
      message: `Created ${components.length} default components`,
      components: components.map(c => ({
        component_id: c.component_id,
        type: c.type,
        name: c.name,
        is_default: c.is_default,
      })),
    });
  } catch (error) {
    console.error("Error seeding email components:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to seed components" },
      { status: 500 }
    );
  }
}
