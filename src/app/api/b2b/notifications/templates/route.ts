/**
 * Notification Templates API
 *
 * GET  /api/b2b/notifications/templates - List templates
 * POST /api/b2b/notifications/templates - Create template
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { listTemplates, createTemplate } from "@/lib/notifications/template.service";

export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { searchParams } = new URL(req.url);

    const result = await listTemplates(tenantDb, {
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
      trigger: searchParams.get("trigger") as any,
      is_active: searchParams.get("is_active") === "true" ? true : searchParams.get("is_active") === "false" ? false : undefined,
      is_default: searchParams.get("is_default") === "true" ? true : searchParams.get("is_default") === "false" ? false : undefined,
      search: searchParams.get("search") || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing templates:", error);
    return NextResponse.json(
      { error: "Failed to list templates" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const body = await req.json();

    const template = await createTemplate(tenantDb, {
      ...body,
      created_by: session.email || "unknown",
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create template" },
      { status: 400 }
    );
  }
}
