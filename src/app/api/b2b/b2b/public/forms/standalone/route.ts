import { NextRequest, NextResponse } from "next/server";
import { verifyAPIKey } from "@/lib/auth/api-key-auth";
import { getPortalByDomain } from "@/lib/services/b2b-portal.service";
import { connectWithModels } from "@/lib/db/connection";
import { sendEmail } from "@/lib/email";
import { renderFormSubmissionEmail } from "@/lib/email/templates/b2c-form-submission";
import type { EmailBranding } from "@/lib/email/templates/base";
import type { FormFieldConfig } from "@/lib/types/blocks";

/**
 * POST /api/b2b/b2b/public/forms/standalone
 *
 * Submit a standalone form (not tied to a page) for a B2B portal.
 * Auth: API key + Origin header → portal lookup by domain.
 *
 * Body: { form_definition_slug, data: { [field_id]: value } }
 * Response: { success: true, message }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate tenant via API key
    const keyId = req.headers.get("x-api-key-id");
    const secret = req.headers.get("x-api-secret");
    if (!keyId || !secret) {
      return NextResponse.json({ error: "Missing API key credentials" }, { status: 401 });
    }

    const authResult = await verifyAPIKey(keyId, secret);
    if (!authResult.valid || !authResult.tenantId) {
      return NextResponse.json({ error: authResult.error || "Invalid API key" }, { status: 401 });
    }

    const tenantDb = `vinc-${authResult.tenantId}`;

    // 2. Resolve portal by Origin header → domain match
    const origin = req.headers.get("origin") || req.headers.get("referer");
    if (!origin) {
      return NextResponse.json({ error: "Origin header is required" }, { status: 400 });
    }

    let domain: string;
    try {
      domain = new URL(origin).hostname;
    } catch {
      return NextResponse.json({ error: "Invalid Origin header" }, { status: 400 });
    }

    const portal = await getPortalByDomain(tenantDb, domain);
    if (!portal) {
      return NextResponse.json({ error: `No portal found for domain "${domain}"` }, { status: 404 });
    }

    // 3. Parse body
    const body = await req.json();
    const { form_definition_slug, data } = body;

    if (!form_definition_slug || !data || typeof data !== "object") {
      return NextResponse.json(
        { error: "form_definition_slug and data are required" },
        { status: 400 }
      );
    }

    // 4. Find the enabled form definition for this portal
    const { B2BFormDefinition, B2BFormSubmission } = await connectWithModels(tenantDb);
    const formDef = await B2BFormDefinition.findOne({
      portal_slug: portal.slug,
      slug: form_definition_slug,
      enabled: true,
    }).lean() as any;

    if (!formDef) {
      return NextResponse.json(
        { error: `Form definition "${form_definition_slug}" not found or disabled` },
        { status: 404 }
      );
    }

    // 5. Validate fields against definition config
    const fieldDefs: FormFieldConfig[] = formDef.config?.fields || [];
    const sanitizedData: Record<string, unknown> = {};

    for (const fieldDef of fieldDefs) {
      const value = data[fieldDef.id];

      if (fieldDef.required && (value === undefined || value === null || value === "")) {
        return NextResponse.json(
          { error: `Field "${fieldDef.label}" is required` },
          { status: 400 }
        );
      }

      if (value !== undefined && value !== null) {
        sanitizedData[fieldDef.id] = typeof value === "string" ? value.trim() : value;
      }
    }

    // Extract email from email-type fields
    const emailField = fieldDefs.find((f) => f.type === "email");
    const submitterEmail = emailField ? (sanitizedData[emailField.id] as string) : undefined;

    // 6. Store submission
    await B2BFormSubmission.create({
      portal_slug: portal.slug,
      form_type: "standalone",
      form_definition_slug,
      data: sanitizedData,
      submitter_email: submitterEmail,
      seen: false,
    });

    // 7. Send notification emails (fire and forget)
    const recipients: string[] = (formDef.notification_emails || []).filter(
      (e: string) => e.trim()
    );
    const sendSubmitterCopy = formDef.send_submitter_copy && submitterEmail;

    if (recipients.length > 0 || sendSubmitterCopy) {
      const branding: EmailBranding = {
        companyName: portal.branding?.title || "B2B Portal",
        logo: portal.branding?.logo_url,
        primaryColor: portal.branding?.primary_color || "#009f7f",
        secondaryColor: portal.branding?.secondary_color || "#02b290",
        companyInfo: undefined,
      };

      const fields = fieldDefs.map((f: FormFieldConfig) => ({
        label: f.label,
        value: String(sanitizedData[f.id] ?? "-"),
      }));

      const html = renderFormSubmissionEmail({
        branding,
        data: {
          pageSlug: form_definition_slug,
          storefrontName: portal.name,
          fields,
          submitterEmail,
        },
      });

      const subject = `New form submission: ${formDef.name}`;

      if (recipients.length > 0) {
        sendEmail({
          to: recipients,
          subject,
          html,
          replyTo: submitterEmail,
          immediate: true,
          tenantDb,
        }).catch((err) => {
          console.warn("[b2b-standalone-form] Failed to send notification:", err);
        });
      }

      if (sendSubmitterCopy) {
        sendEmail({
          to: submitterEmail!,
          subject,
          html,
          immediate: true,
          tenantDb,
        }).catch((err) => {
          console.warn("[b2b-standalone-form] Failed to send submitter copy:", err);
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: formDef.config?.success_message || "Form submitted successfully",
    });
  } catch (error) {
    console.error("[POST /api/b2b/b2b/public/forms/standalone]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
