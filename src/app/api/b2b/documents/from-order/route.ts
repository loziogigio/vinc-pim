/**
 * Create Document from Order API
 *
 * POST /api/b2b/documents/from-order
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateDocumentRequest } from "../_auth";
import { createFromOrder } from "@/lib/services/document.service";
import { DOCUMENT_TYPES } from "@/lib/constants/document";

export async function POST(req: NextRequest) {
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  const body = await req.json();

  if (!body.order_id) {
    return NextResponse.json({ error: "order_id is required" }, { status: 400 });
  }
  if (!body.document_type || !(DOCUMENT_TYPES as readonly string[]).includes(body.document_type)) {
    return NextResponse.json({ error: "Invalid document_type" }, { status: 400 });
  }

  const result = await createFromOrder(
    auth.tenantDb!,
    auth.tenantId!,
    body.order_id,
    body.document_type,
    auth.userId!,
    auth.username!
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }

  return NextResponse.json({ success: true, document: result.data }, { status: 201 });
}
