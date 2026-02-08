/**
 * Duplicate Document API
 *
 * POST /api/b2b/documents/[id]/duplicate
 * Creates a new draft copy.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateDocumentRequest } from "../../_auth";
import { duplicateDocument } from "@/lib/services/document.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  const result = await duplicateDocument(
    auth.tenantDb!,
    auth.tenantId!,
    id,
    auth.userId!,
    auth.username!
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }

  return NextResponse.json({ success: true, document: result.data }, { status: 201 });
}
