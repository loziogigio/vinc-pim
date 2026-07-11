/**
 * B2C Form Submission Email Template
 * Sent to admin when a visitor submits a contact form on a B2C page
 */

import { renderBaseTemplate, renderInfoBox, type EmailBranding } from './base';
import type { LeadContext } from '@/lib/leads/lead-context';

export interface FormSubmissionData {
  pageSlug: string;
  storefrontName: string;
  fields: Array<{ label: string; value: string }>;
  submitterEmail?: string;
  leadContext?: LeadContext;
}

export interface FormSubmissionEmailOptions {
  branding: EmailBranding;
  data: FormSubmissionData;
}

export function renderFormSubmissionEmail(options: FormSubmissionEmailOptions): string {
  const { branding, data } = options;

  const content = `
    <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 600; color: #1e293b;">
      New Form Submission
    </h2>
    <p style="margin: 0 0 24px 0; font-size: 15px; color: #64748b;">
      From page <strong>/${data.pageSlug}</strong> on <strong>${data.storefrontName}</strong>
    </p>

    ${data.leadContext ? `
    <div style="background:#eef6f7;border-left:4px solid ${branding.primaryColor};padding:14px 16px;border-radius:8px;margin:0 0 20px 0;">
      <p style="margin:0 0 6px 0;font-weight:600;color:#0f172a;">Lead context — ${data.leadContext.segmentLabel}</p>
      <p style="margin:0 0 8px 0;font-size:13px;color:#334155;">${data.leadContext.attributionLines.join("<br/>")}</p>
      <p style="margin:0 0 10px 0;font-size:13px;color:#475569;"><em>${data.leadContext.openingLine}</em></p>
      ${data.leadContext.demoUrl ? `<a href="${data.leadContext.demoUrl}" style="color:${branding.primaryColor};font-size:13px;margin-right:14px;">Vai alla demo →</a>` : ""}
      ${data.leadContext.crmUrl ? `<a href="${data.leadContext.crmUrl}" style="color:${branding.primaryColor};font-size:13px;font-weight:600;">Apri nel CRM →</a>` : ""}
    </div>
    ` : ""}

    ${renderInfoBox(data.fields)}

    ${data.submitterEmail ? `
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #475569;">
      Reply to: <a href="mailto:${data.submitterEmail}" style="color: ${branding.primaryColor};">${data.submitterEmail}</a>
    </p>
    ` : ''}
  `;

  return renderBaseTemplate({
    branding,
    preheader: `New form submission from /${data.pageSlug} on ${data.storefrontName}`,
    content,
    footerText: 'B2C Form Submission Notification',
  });
}
