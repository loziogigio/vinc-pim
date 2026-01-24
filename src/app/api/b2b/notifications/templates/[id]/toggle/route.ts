/**
 * Toggle Template Active Status
 *
 * POST /api/b2b/notifications/templates/[id]/toggle
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { toggleTemplateActive } from "@/lib/notifications/template.service";

export async function POST(
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

    const template = await toggleTemplateActive(tenantDb, id);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error toggling template:", error);
    return NextResponse.json(
      { error: "Failed to toggle template" },
      { status: 500 }
    );
  }
}
