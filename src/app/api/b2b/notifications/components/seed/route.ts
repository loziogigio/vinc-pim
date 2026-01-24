/**
 * Seed Default Email Components API
 *
 * POST /api/b2b/notifications/components/seed - Seed default header and footer
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

// Default Header HTML - Uses variables for branding
const DEFAULT_HEADER_HTML = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f6fa;">
  <tr>
    <td align="center" style="padding: 40px 20px 0 20px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px 12px 0 0; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td align="center" style="padding: 32px 40px; border-bottom: 1px solid #eaeef2;">
            {{#if logo}}
              <img src="{{logo}}" alt="{{company_name}}" style="max-height: 48px; max-width: 200px;" />
            {{else}}
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: {{primary_color}};">{{company_name}}</h1>
            {{/if}}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();

// Default Footer HTML - Uses variables for company info
const DEFAULT_FOOTER_HTML = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f6fa;">
  <tr>
    <td align="center" style="padding: 0 20px 40px 20px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="padding: 24px 40px; background-color: #f8f9fb; border-radius: 0 0 12px 12px; border-top: 1px solid #eaeef2;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center">
                  <!-- No-reply notice -->
                  <p style="margin: 0 0 16px 0; padding: 12px 16px; background-color: #fef3c7; border-radius: 6px; font-size: 12px; color: #92400e;">
                    ⚠️ Questa è un'email automatica. Non rispondere a questo messaggio.
                  </p>

                  <!-- Company info -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                    <tr>
                      <td align="center">
                        <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #1e293b;">{{company_name}}</p>
                        {{#if address}}
                        <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">
                          {{address}}
                        </p>
                        {{/if}}
                        {{#if contact_info}}
                        <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b;">
                          {{contact_info}}
                        </p>
                        {{/if}}
                        {{#if business_hours}}
                        <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b;">
                          🕐 {{business_hours}}
                        </p>
                        {{/if}}
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                    &copy; {{current_year}} {{company_name}}. Tutti i diritti riservati.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();

// Minimal Header (simple version)
const MINIMAL_HEADER_HTML = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f6fa;">
  <tr>
    <td align="center" style="padding: 40px 20px 0 20px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px 12px 0 0;">
        <tr>
          <td align="center" style="padding: 24px 40px; border-bottom: 1px solid #eaeef2;">
            <span style="font-size: 20px; font-weight: 600; color: {{primary_color}};">{{company_name}}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();

// Minimal Footer (simple version)
const MINIMAL_FOOTER_HTML = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f6fa;">
  <tr>
    <td align="center" style="padding: 0 20px 40px 20px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 0 0 12px 12px;">
        <tr>
          <td align="center" style="padding: 20px 40px; background-color: #f8f9fb; border-radius: 0 0 12px 12px; border-top: 1px solid #eaeef2;">
            <p style="margin: 0; font-size: 12px; color: #64748b;">
              &copy; {{current_year}} {{company_name}}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();

export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
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
