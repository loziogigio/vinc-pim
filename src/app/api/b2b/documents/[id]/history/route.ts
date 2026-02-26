/**
 * Document History API
 *
 * GET /api/b2b/documents/[id]/history
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateDocumentRequest } from "../../_auth";
import { connectWithModels } from "@/lib/db/connection";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  const { Document } = await connectWithModels(auth.tenantDb!);

  const doc = await Document.findOne(
    { document_id: id, tenant_id: auth.tenantId },
    { history: 1, document_id: 1, document_number: 1 }
  ).lean();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    document_id: (doc as any).document_id,
    document_number: (doc as any).document_number,
    history: (doc as any).history || [],
  });
}
