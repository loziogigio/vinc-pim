/**
 * Update Document Number API
 *
 * POST /api/b2b/documents/[id]/update-number
 * Manually update the progressive number of a finalized (not yet sent) document.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateDocumentRequest } from "../../_auth";
import { updateDocumentNumber } from "@/lib/services/document.service";

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
  const newNumber = body.number;

  if (typeof newNumber !== "number" || !Number.isInteger(newNumber) || newNumber < 1) {
    return NextResponse.json(
      { error: "number deve essere un intero positivo" },
      { status: 400 }
    );
  }

  const result = await updateDocumentNumber(
    auth.tenantDb!,
    auth.tenantId!,
    id,
    newNumber,
    auth.userId!,
    auth.username!
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }

  return NextResponse.json({ success: true, document: result.data });
}
