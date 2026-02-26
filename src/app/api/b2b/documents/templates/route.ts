/**
 * Document Templates API
 *
 * GET  /api/b2b/documents/templates - List templates
 * POST /api/b2b/documents/templates - Create template
 */

import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { authenticateDocumentRequest } from "../_auth";
import { connectWithModels } from "@/lib/db/connection";

export async function GET(req: NextRequest) {
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  const { DocumentTemplate } = await connectWithModels(auth.tenantDb!);

  const templates = await DocumentTemplate.find({ tenant_id: auth.tenantId })
    .sort({ is_default: -1, name: 1 })
    .lean();

  return NextResponse.json({ success: true, templates });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  const { DocumentTemplate } = await connectWithModels(auth.tenantDb!);
  const body = await req.json();

  if (!body.name || !body.html_template) {
    return NextResponse.json({ error: "name and html_template are required" }, { status: 400 });
  }

  const template = await DocumentTemplate.create({
    template_id: nanoid(12),
    tenant_id: auth.tenantId,
    name: body.name,
    description: body.description,
    document_type: body.document_type || "all",
    html_template: body.html_template,
    css_styles: body.css_styles,
    page_size: body.page_size || "A4",
    orientation: body.orientation || "portrait",
    margins: body.margins || { top: 15, right: 15, bottom: 15, left: 15 },
    header_config: body.header_config,
    footer_config: body.footer_config,
    is_default: body.is_default || false,
    is_system: false,
  });

  return NextResponse.json({ success: true, template }, { status: 201 });
}
