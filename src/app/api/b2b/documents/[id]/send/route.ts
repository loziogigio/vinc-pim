/**
 * Send Document API
 *
 * POST /api/b2b/documents/[id]/send
 * Generates PDF and sends via email.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateDocumentRequest } from "../../_auth";
import { connectWithModels } from "@/lib/db/connection";
import { markDocumentSent } from "@/lib/services/document.service";
import { generateDocumentPdf } from "@/lib/services/document-pdf.service";
import { renderDocumentEmail } from "@/lib/email/templates/document-email";
import { sendEmail } from "@/lib/email";
import { getHomeSettings } from "@/lib/db/home-settings";
import { DOCUMENT_TYPE_LABELS } from "@/lib/constants/document";
import type { DocumentType } from "@/lib/constants/document";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  const body = await req.json();
  const recipientEmail = body.recipient_email;

  if (!recipientEmail) {
    return NextResponse.json({ error: "recipient_email is required" }, { status: 400 });
  }

  // Get document
  const { Document } = await connectWithModels(auth.tenantDb!);
  const doc = await Document.findOne({
    document_id: id,
    tenant_id: auth.tenantId,
  }).lean();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const d = doc as any;

  // Must be finalized or already sent to send
  if (d.status === "draft") {
    return NextResponse.json(
      { error: "Document must be finalized before sending" },
      { status: 400 }
    );
  }

  // Generate PDF
  const { buffer, filename } = await generateDocumentPdf(auth.tenantDb!, id);

  // Build email
  const settings = await getHomeSettings(auth.tenantDb!);
  const typeLabel = DOCUMENT_TYPE_LABELS[d.document_type as DocumentType] || d.document_type;
  const companyName = settings?.company_info?.legal_name || settings?.branding?.title || "Company";
  const customerName = d.customer?.company_name ||
    [d.customer?.first_name, d.customer?.last_name].filter(Boolean).join(" ") || "Cliente";

  const html = renderDocumentEmail({
    branding: {
      companyName,
      logo: settings?.branding?.logo,
      primaryColor: settings?.branding?.primaryColor || "#009f7f",
      secondaryColor: settings?.branding?.secondaryColor || "#02b290",
      companyInfo: settings?.company_info as any,
    },
    documentType: d.document_type,
    documentNumber: d.document_number || d.document_id,
    customerName,
    message: body.message,
  });

  const subject = body.subject || `${typeLabel} ${d.document_number || ""} - ${companyName}`;

  // Send email with PDF attachment
  const emailResult = await sendEmail({
    to: recipientEmail,
    subject,
    html,
    tenantDb: auth.tenantDb!,
    immediate: true,
    attachments: [
      {
        filename,
        content: buffer,
        contentType: "application/pdf",
      },
    ],
  });

  if (!emailResult.success) {
    return NextResponse.json(
      { error: `Email sending failed: ${emailResult.error}` },
      { status: 500 }
    );
  }

  // Mark document as sent
  await markDocumentSent(auth.tenantDb!, id, recipientEmail, auth.userId!, auth.username!);

  return NextResponse.json({
    success: true,
    emailId: emailResult.emailId,
    sentTo: recipientEmail,
  });
}
