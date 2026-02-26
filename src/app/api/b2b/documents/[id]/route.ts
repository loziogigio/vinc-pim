/**
 * Document API - Get, Update, Delete
 *
 * GET    /api/b2b/documents/[id] - Get document detail
 * PATCH  /api/b2b/documents/[id] - Update draft document
 * DELETE /api/b2b/documents/[id] - Delete draft document
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateDocumentRequest } from "../_auth";
import { connectWithModels } from "@/lib/db/connection";
import { updateDocument, deleteDocument } from "@/lib/services/document.service";

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

  const doc = await Document.findOne({
    document_id: id,
    tenant_id: auth.tenantId,
  }).lean();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, document: doc });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  const body = await req.json();

  const result = await updateDocument(
    auth.tenantDb!,
    id,
    {
      items: body.items,
      customer_id: body.customer_id,
      currency: body.currency,
      payment_terms: body.payment_terms,
      payment_method: body.payment_method,
      due_date: body.due_date ? new Date(body.due_date) : undefined,
      validity_days: body.validity_days,
      notes: body.notes,
      internal_notes: body.internal_notes,
      footer_text: body.footer_text,
      template_id: body.template_id,
    },
    auth.userId!,
    auth.username!
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }

  return NextResponse.json({ success: true, document: result.data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  const result = await deleteDocument(auth.tenantDb!, auth.tenantId!, id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }

  return NextResponse.json({ success: true });
}
