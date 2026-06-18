import { NextRequest, NextResponse } from "next/server";
import { verifyAPIKey } from "@/lib/auth/api-key-auth";
import { getStorefrontByDomain } from "@/lib/services/b2c-storefront.service";
import { getPublishedB2CPageTemplate } from "@/lib/db/b2c-page-templates";
import { connectWithModels } from "@/lib/db/connection";
import { sendEmail } from "@/lib/email";
import { getHomeSettings } from "@/lib/db/home-settings";
import { renderFormSubmissionEmail } from "@/lib/email/templates/b2c-form-submission";
import { renderDemoAccessEmail } from "@/lib/email/templates/demo-access";
import type { EmailBranding } from "@/lib/email/templates/base";
import type { FormBlockConfig, FormFieldConfig, PageBlock } from "@/lib/types/blocks";
import {
  DEMO_REQUEST_PAGE_SLUG,
  DEMO_DOMAINS,
  getDemoPasswordsSafe,
  getDemoAccess,
} from "@/lib/demo/demo-access";
import { processLead } from "@/lib/leads/pipeline";
import { emitEvent } from "@/lib/analytics/emit";
import { EVENTS } from "vinc-analytics";
import { LEAD_PAGE_SLUGS } from "@/lib/constants/deal";

/** Best-effort: pull a human name out of the submitted fields for the greeting. */
function extractLeadName(
  fields: FormFieldConfig[],
  data: Record<string, unknown>
): string | undefined {
  const nameField = fields.find(
    (f) => /name|nome/i.test(f.id) || /name|nome/i.test(f.label || "")
  );
  const val = nameField ? data[nameField.id] : undefined;
  return typeof val === "string" && val.trim() ? val.trim() : undefined;
}

/**
 * POST /api/b2b/b2c/public/forms/submit
 *
 * Submit a form from a B2C storefront page.
 * Auth: API key + Origin header.
 *
 * Body: { page_slug, form_block_id, data: { [field_id]: value } }
 * Response: { success: true, message }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
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

    // 2. Identify storefront
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

    const storefront = await getStorefrontByDomain(tenantDb, domain);
    if (!storefront) {
      return NextResponse.json({ error: `No storefront found for domain "${domain}"` }, { status: 404 });
    }

    // 3. Parse body
    const body = await req.json();
    const { page_slug, form_block_id, data } = body;
    const inboundAttr = (body.__attribution ?? null) as any;

    if (!page_slug || !form_block_id || !data || typeof data !== "object") {
      return NextResponse.json(
        { error: "page_slug, form_block_id, and data are required" },
        { status: 400 }
      );
    }

    const isPipelineLead =
      (LEAD_PAGE_SLUGS as readonly string[]).includes(page_slug) &&
      authResult.tenantId === process.env.VINC_PIPELINE_TENANT_ID;

    // 4. Fetch published page and find the form block
    const template = await getPublishedB2CPageTemplate(storefront.slug, page_slug, tenantDb);
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

    const isDemoRequest = page_slug === DEMO_REQUEST_PAGE_SLUG;

    // 6. Store submission
    const { FormSubmission } = await connectWithModels(tenantDb);
    const submission = await FormSubmission.create({
      storefront_slug: storefront.slug,
      page_slug,
      form_block_id,
      data: sanitizedData,
      submitter_email: submitterEmail,
      demo_request_type: isDemoRequest ? "demo" : undefined,
    });

    // 6b. Lead pipeline (deal + CRM upsert) — gate: pipeline tenant + lead page slugs only
    let leadContext = undefined;
    if (isPipelineLead) {
      try {
        const { Deal } = await connectWithModels(tenantDb);
        const buyer =
          (data.buyer_segment as string) ||
          (inboundAttr?.buyer_segment as string) ||
          "unsure";
        const out = await processLead({
          models: { Deal },
          twentyCfg: process.env.VINC_TWENTY_API_KEY
            ? {
                baseUrl:
                  process.env.VINC_TWENTY_BASE_URL ||
                  "https://vinc.crm.vendereincloud.it",
                apiKey: process.env.VINC_TWENTY_API_KEY,
              }
            : undefined,
          form_submission_id: String(submission._id),
          contact: {
            name: extractLeadName(fieldDefs, sanitizedData),
            email: submitterEmail,
            company: sanitizedData["azienda"] as string,
            phone: sanitizedData["telefono"] as string,
          },
          buyer_segment: buyer as any,
          source_form: isDemoRequest ? "demo" : "audit",
          page_slug,
          attribution: inboundAttr ?? undefined,
        });
        leadContext = out.leadContext;
      } catch (err) {
        console.warn("[form-submit] pipeline processing failed (non-fatal):", err);
      }
    }

    // 7. Emails (branded, fire-and-forget): team notification + demo handoff.
    if (formConfig.notification_email || isDemoRequest) {
      const settings = await getHomeSettings(tenantDb);
      const branding: EmailBranding = {
        companyName: settings?.branding?.title || "B2C Store",
        logo: settings?.branding?.logo,
        primaryColor: settings?.branding?.primaryColor || "#009f7f",
        secondaryColor: settings?.branding?.secondaryColor || "#02b290",
        companyInfo: settings?.company_info,
      };

      // 7a. Team notification (unchanged behaviour, sharper subject for demos)
      if (formConfig.notification_email) {
        const fields = fieldDefs.map((f: FormFieldConfig) => ({
          label: f.label,
          value: String(sanitizedData[f.id] ?? "-"),
        }));

        const html = renderFormSubmissionEmail({
          branding,
          data: {
            pageSlug: page_slug,
            storefrontName: storefront.name,
            fields,
            submitterEmail,
            leadContext,
          },
        });

        sendEmail({
          to: formConfig.notification_email,
          subject: isDemoRequest
            ? `New demo request from /${page_slug}`
            : `New form submission from /${page_slug}`,
          html,
          replyTo: submitterEmail,
          immediate: true,
          tenantDb,
        }).catch((err) => {
          console.warn("[form-submit] Failed to send notification email:", err);
        });
      }

      // 7b. Demo-access email to the lead (the lead-gated demo handoff)
      if (isDemoRequest && submitterEmail) {
        const pwds = getDemoPasswordsSafe();
        if (pwds) {
          const demoHtml = renderDemoAccessEmail({
            branding,
            leadName: extractLeadName(fieldDefs, sanitizedData),
            access: getDemoAccess(pwds),
            hubUrl: `https://${DEMO_DOMAINS.hub}`,
          });

          sendEmail({
            to: submitterEmail,
            subject: "La tua demo di Vendere in Cloud è pronta",
            html: demoHtml,
            immediate: true,
            tenantDb,
          }).catch((err) => {
            console.warn("[form-submit] Failed to send demo-access email:", err);
          });

          if (isPipelineLead) {
            emitEvent({
              event: EVENTS.DEMO_CREDENTIALS_SENT,
              userId: submitterEmail,
              anonymousId: inboundAttr?.anonymous_id,
              properties: {
                buyer_segment: (data.buyer_segment as string) ?? "unsure",
                page_slug,
                deal_submission_id: String(submission._id),
              },
            }).catch(() => {});
          }
        } else {
          console.warn(
            "[form-submit] Demo request but DEMO_*_PASSWORD env not set — skipping demo-access email"
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: formConfig.success_message || "Form submitted successfully",
    });
  } catch (error) {
    console.error("[POST /api/b2b/b2c/public/forms/submit]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
