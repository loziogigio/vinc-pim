/**
 * Document Settings API
 *
 * GET /api/b2b/documents/settings  - Get numbering config
 * PUT /api/b2b/documents/settings  - Update numbering config
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateDocumentRequest } from "../_auth";
import {
  getDocumentSettings,
  updateDocumentSettings,
} from "@/lib/services/document-numbering.service";

export async function GET(req: NextRequest) {
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  const settings = await getDocumentSettings(auth.tenantDb!, auth.tenantId!);

  return NextResponse.json({ success: true, settings });
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  const body = await req.json();

  const settings = await updateDocumentSettings(auth.tenantDb!, auth.tenantId!, {
    numbering: body.numbering,
    default_currency: body.default_currency,
    default_payment_terms: body.default_payment_terms,
    default_notes: body.default_notes,
    default_validity_days: body.default_validity_days,
  });

  return NextResponse.json({ success: true, settings });
}
