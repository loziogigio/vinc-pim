/**
 * Notification Template API - Single Template
 *
 * GET    /api/b2b/notifications/templates/[id] - Get template
 * PUT    /api/b2b/notifications/templates/[id] - Update template
 * DELETE /api/b2b/notifications/templates/[id] - Delete template
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { getTemplate, updateTemplate, deleteTemplate } from "@/lib/notifications/template.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantDb = `vinc-${session.tenantId}`;

    const template = await getTemplate(tenantDb, id);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error getting template:", error);
    return NextResponse.json(
      { error: "Failed to get template" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantDb = `vinc-${session.tenantId}`;
    const body = await req.json();

    const template = await updateTemplate(tenantDb, id, {
      ...body,
      updated_by: session.email || "unknown",
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update template" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantDb = `vinc-${session.tenantId}`;

    const result = await deleteTemplate(tenantDb, id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
