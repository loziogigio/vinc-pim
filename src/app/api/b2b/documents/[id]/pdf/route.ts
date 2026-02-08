/**
 * Document PDF API
 *
 * GET /api/b2b/documents/[id]/pdf - Download PDF
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateDocumentRequest } from "../../_auth";
import { connectWithModels } from "@/lib/db/connection";
import { generateDocumentPdf } from "@/lib/services/document-pdf.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  // Verify document exists and belongs to tenant
  const { Document } = await connectWithModels(auth.tenantDb!);
  const doc = await Document.findOne({
    document_id: id,
    tenant_id: auth.tenantId,
  }).lean();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { buffer, filename } = await generateDocumentPdf(auth.tenantDb!, id);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
