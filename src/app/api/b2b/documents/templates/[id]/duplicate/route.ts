/**
 * Duplicate Document Template API
 *
 * POST /api/b2b/documents/templates/[id]/duplicate - Create an editable copy of a template
 */

import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { authenticateDocumentRequest } from "../../../_auth";
import { connectWithModels } from "@/lib/db/connection";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  const { DocumentTemplate } = await connectWithModels(auth.tenantDb!);

  const source = await DocumentTemplate.findOne({
    template_id: id,
    tenant_id: auth.tenantId,
  }).lean();

  if (!source) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const s = source as any;
  const duplicate = await DocumentTemplate.create({
    template_id: nanoid(12),
    tenant_id: auth.tenantId,
    name: `${s.name} (copia)`,
    description: s.description,
    document_type: s.document_type,
    html_template: s.html_template,
    css_styles: s.css_styles,
    page_size: s.page_size,
    orientation: s.orientation,
    margins: s.margins,
    header_config: s.header_config,
    footer_config: s.footer_config,
    is_default: false,
    is_system: false,
  });

  return NextResponse.json({ success: true, template: duplicate }, { status: 201 });
}
