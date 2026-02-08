/**
 * Documents API - List & Create
 *
 * GET  /api/b2b/documents - List documents (paginated)
 * POST /api/b2b/documents - Create new draft document
 */

import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { createDocument } from "@/lib/services/document.service";
import { DOCUMENT_TYPES, DOCUMENT_STATUSES } from "@/lib/constants/document";
import { authenticateDocumentRequest } from "./_auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  const { Document } = await connectWithModels(auth.tenantDb!);

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const skip = (page - 1) * limit;

  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const customerId = searchParams.get("customer_id");
  const search = searchParams.get("search") || "";

  const query: Record<string, unknown> = { tenant_id: auth.tenantId };

  if (type && (DOCUMENT_TYPES as readonly string[]).includes(type)) {
    query.document_type = type;
  }
  if (status && (DOCUMENT_STATUSES as readonly string[]).includes(status)) {
    query.status = status;
  }
  if (customerId) {
    query["customer.customer_id"] = customerId;
  }
  if (search) {
    query.$or = [
      { document_number: { $regex: search, $options: "i" } },
      { "customer.company_name": { $regex: search, $options: "i" } },
      { "customer.vat_number": { $regex: search, $options: "i" } },
    ];
  }

  const [documents, total] = await Promise.all([
    Document.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Document.countDocuments(query),
  ]);

  return NextResponse.json({
    success: true,
    documents,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  const body = await req.json();

  if (!body.document_type || !(DOCUMENT_TYPES as readonly string[]).includes(body.document_type)) {
    return NextResponse.json({ error: "Invalid document_type" }, { status: 400 });
  }
  if (!body.customer_id) {
    return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
  }

  const result = await createDocument(
    auth.tenantDb!,
    auth.tenantId!,
    {
      document_type: body.document_type,
      customer_id: body.customer_id,
      items: body.items,
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

  return NextResponse.json({ success: true, document: result.data }, { status: 201 });
}
