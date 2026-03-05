/**
 * B2C Form Submission Email Template
 * Sent to admin when a visitor submits a contact form on a B2C page
 */

import { renderBaseTemplate, renderInfoBox, type EmailBranding } from './base';

export interface FormSubmissionData {
  pageSlug: string;
  storefrontName: string;
  fields: Array<{ label: string; value: string }>;
  submitterEmail?: string;
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
