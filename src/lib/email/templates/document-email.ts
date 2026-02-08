/**
 * Document Email Template
 *
 * Email template for sending documents (invoices, quotations, etc.) as PDF attachments.
 */

import { renderBaseTemplate, type EmailBranding } from "./base";
import { DOCUMENT_TYPE_LABELS } from "@/lib/constants/document";
import type { DocumentType } from "@/lib/constants/document";
import { getLabels } from "@/lib/constants/countries";

interface DocumentEmailOptions {
  branding: EmailBranding;
  documentType: DocumentType;
  documentNumber: string;
  customerName: string;
  message?: string;
  countryCode?: string;
  language?: string;
}

/**
 * Render the email body for a document send.
 * Uses country/language labels for localized text. Defaults to IT/it for backward compat.
 */
export function renderDocumentEmail(options: DocumentEmailOptions): string {
  const { branding, documentType, documentNumber, customerName, message, countryCode, language } = options;

  // Resolve labels for the document's country/language
  const labels = getLabels(countryCode || "IT", language);
  const typeLabel = labels.document_types[documentType]
    || DOCUMENT_TYPE_LABELS[documentType]
    || documentType;
  const emailLabels = labels.email;

  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1e293b;">
      ${typeLabel} ${documentNumber}
    </h2>

    <p style="margin: 0 0 16px 0; font-size: 15px; color: #475569;">
      ${emailLabels.dear_customer} ${customerName},
    </p>

    ${message
      ? `<p style="margin: 0 0 16px 0; font-size: 15px; color: #475569;">${message}</p>`
      : `<p style="margin: 0 0 16px 0; font-size: 15px; color: #475569;">
          ${emailLabels.attached_document} <strong>${typeLabel} n. ${documentNumber}</strong>.
        </p>`
    }

    <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">
      ${emailLabels.pdf_format}
    </p>

    <p style="margin: 24px 0 0 0; font-size: 14px; color: #475569;">
      ${emailLabels.regards},<br>
      <strong>${branding.companyName}</strong>
    </p>
  `;

  return renderBaseTemplate({
    branding,
    preheader: `${typeLabel} ${documentNumber} - ${branding.companyName}`,
    content,
  });
}
