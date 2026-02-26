/**
 * Set Document Counter API
 *
 * PUT /api/b2b/documents/settings/counters/[type]
 * Set the counter value for a specific document type.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateDocumentRequest } from "../../../_auth";
import { setCounter } from "@/lib/services/document-numbering.service";
import { DOCUMENT_TYPES } from "@/lib/constants/document";
import type { DocumentType } from "@/lib/constants/document";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  if (!(DOCUMENT_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
  }

  const body = await req.json();
  const value = parseInt(body.value);
  const year = parseInt(body.year || String(new Date().getFullYear()));

  if (isNaN(value) || value < 0) {
    return NextResponse.json({ error: "value must be a non-negative integer" }, { status: 400 });
  }

  await setCounter(auth.tenantDb!, type as DocumentType, year, value);

  return NextResponse.json({
    success: true,
    type,
    year,
    value,
    message: `Next ${type} number will be ${value + 1}`,
  });
}
