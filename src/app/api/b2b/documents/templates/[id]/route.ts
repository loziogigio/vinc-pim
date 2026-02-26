/**
 * Document Template Detail API
 *
 * GET    /api/b2b/documents/templates/[id] - Get template
 * PUT    /api/b2b/documents/templates/[id] - Update template
 * DELETE /api/b2b/documents/templates/[id] - Delete template (non-system only)
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

  const { DocumentTemplate } = await connectWithModels(auth.tenantDb!);

  const template = await DocumentTemplate.findOne({
    template_id: id,
    tenant_id: auth.tenantId,
  }).lean();

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, template });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  const { DocumentTemplate } = await connectWithModels(auth.tenantDb!);
  const body = await req.json();

  const template = await DocumentTemplate.findOneAndUpdate(
    { template_id: id, tenant_id: auth.tenantId },
    {
      $set: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.document_type !== undefined && { document_type: body.document_type }),
        ...(body.html_template !== undefined && { html_template: body.html_template }),
        ...(body.css_styles !== undefined && { css_styles: body.css_styles }),
        ...(body.page_size !== undefined && { page_size: body.page_size }),
        ...(body.orientation !== undefined && { orientation: body.orientation }),
        ...(body.margins !== undefined && { margins: body.margins }),
        ...(body.header_config !== undefined && { header_config: body.header_config }),
        ...(body.footer_config !== undefined && { footer_config: body.footer_config }),
        ...(body.is_default !== undefined && { is_default: body.is_default }),
      },
    },
    { new: true }
  );

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, template });
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

  const { DocumentTemplate } = await connectWithModels(auth.tenantDb!);

  const template = await DocumentTemplate.findOne({
    template_id: id,
    tenant_id: auth.tenantId,
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  if ((template as any).is_system) {
    return NextResponse.json({ error: "System templates cannot be deleted" }, { status: 400 });
  }

  await DocumentTemplate.deleteOne({ template_id: id });
  return NextResponse.json({ success: true });
}
