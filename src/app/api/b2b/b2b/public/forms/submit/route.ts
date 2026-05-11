import { NextRequest, NextResponse } from "next/server";
import { verifyAPIKey } from "@/lib/auth/api-key-auth";
import { getPortalByDomain } from "@/lib/services/b2b-portal.service";
import { getPublishedB2BPageTemplate } from "@/lib/db/b2b-page-templates";
import { connectWithModels } from "@/lib/db/connection";
import { sendEmail } from "@/lib/email";
import { renderFormSubmissionEmail } from "@/lib/email/templates/b2c-form-submission";
import type { EmailBranding } from "@/lib/email/templates/base";
import type { FormBlockConfig, FormFieldConfig, PageBlock } from "@/lib/types/blocks";

/**
 * POST /api/b2b/b2b/public/forms/submit
 *
 * Submit a form embedded in a B2B portal page.
 * Auth: API key + Origin header → portal lookup by domain.
 *
 * Body: { page_slug, form_block_id, data: { [field_id]: value } }
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
    const { page_slug, form_block_id, data } = body;

    if (!page_slug || !form_block_id || !data || typeof data !== "object") {
      return NextResponse.json(
        { error: "page_slug, form_block_id, and data are required" },
        { status: 400 }
      );
    }

    // 4. Fetch published page and find the form block
    const template = await getPublishedB2BPageTemplate(portal.slug, page_slug, tenantDb);
    if (!template) {
      return NextResponse.json({ error: "Page not found or not published" }, { status: 404 });
    }

    const formBlock = (template.blocks as PageBlock[]).find(
      (b) => b.id === form_block_id && b.type === "form-contact"
    );
    if (!formBlock) {
      return NextResponse.json({ error: "Form block not found on page" }, { status: 404 });
    }

    const formConfig = formBlock.config as FormBlockConfig;
    const fieldDefs = formConfig.fields || [];

    // 5. Validate required fields
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
    const { B2BFormSubmission } = await connectWithModels(tenantDb);
    await B2BFormSubmission.create({
      portal_slug: portal.slug,
      page_slug,
      form_block_id,
      form_type: "page_form",
      data: sanitizedData,
      submitter_email: submitterEmail,
      seen: false,
    });

    // 7. Send notification email using portal branding (fire and forget)
    if (formConfig.notification_email) {
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
          pageSlug: page_slug,
          storefrontName: portal.name,
          fields,
          submitterEmail,
        },
      });

      sendEmail({
        to: formConfig.notification_email,
        subject: `New form submission from /${page_slug}`,
        html,
        replyTo: submitterEmail,
        immediate: true,
        tenantDb,
      }).catch((err) => {
        console.warn("[b2b-form-submit] Failed to send notification email:", err);
      });
    }

    return NextResponse.json({
      success: true,
      message: formConfig.success_message || "Form submitted successfully",
    });
  } catch (error) {
    console.error("[POST /api/b2b/b2b/public/forms/submit]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
