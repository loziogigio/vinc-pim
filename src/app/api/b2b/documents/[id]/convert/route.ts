/**
 * Convert Document Type API
 *
 * POST /api/b2b/documents/[id]/convert
 * Body: { target_type: "invoice" | "proforma" | "quotation" | "credit_note" }
 *
 * Creates a new draft document of the target type, copying all data from the source.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateDocumentRequest } from "../../_auth";
import { convertDocument } from "@/lib/services/document.service";
import { DOCUMENT_TYPES } from "@/lib/constants/document";

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
  const { target_type } = body;

  if (!target_type || !(DOCUMENT_TYPES as readonly string[]).includes(target_type)) {
    return NextResponse.json(
      { error: "Invalid target_type. Must be one of: " + DOCUMENT_TYPES.join(", ") },
      { status: 400 }
    );
  }

  const result = await convertDocument(
    auth.tenantDb!,
    auth.tenantId!,
    id,
    target_type,
    auth.userId!,
    auth.username!
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }

  return NextResponse.json({ success: true, document: result.data }, { status: 201 });
}
