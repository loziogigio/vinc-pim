/**
 * Email Components API
 *
 * GET  /api/b2b/notifications/components - List all components (headers/footers)
 * POST /api/b2b/notifications/components - Create a new component
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { nanoid } from "nanoid";
import { EMAIL_COMPONENT_TYPES, type EmailComponentType } from "@/lib/db/models/email-component";

export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as EmailComponentType | null;
    const activeOnly = searchParams.get("active") !== "false";

    const tenantDb = `vinc-${session.tenantId}`;
    const { EmailComponent } = await connectWithModels(tenantDb);

    // Build query
    const query: Record<string, unknown> = {};
    if (type && EMAIL_COMPONENT_TYPES.includes(type)) {
      query.type = type;
    }
    if (activeOnly) {
      query.is_active = true;
    }

    const components = await EmailComponent.find(query)
      .sort({ type: 1, is_default: -1, name: 1 })
      .lean();

    return NextResponse.json({ components });
  } catch (error) {
    console.error("Error fetching email components:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch components" },
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

    const body = await req.json();
    const { type, name, description, html_content, variables, is_default } = body;

    // Validation
    if (!type || !EMAIL_COMPONENT_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "Invalid component type. Must be 'header' or 'footer'" },
        { status: 400 }
      );
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!html_content?.trim()) {
      return NextResponse.json({ error: "HTML content is required" }, { status: 400 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { EmailComponent } = await connectWithModels(tenantDb);

    // Generate unique component_id
    const component_id = `${type}_${nanoid(10)}`;

    // If setting as default, unset other defaults of same type
    if (is_default) {
      await EmailComponent.updateMany(
        { type, is_default: true },
        { $set: { is_default: false } }
      );
    }

    const component = await EmailComponent.create({
      component_id,
      type,
      name: name.trim(),
      description: description?.trim(),
      html_content: html_content.trim(),
      variables: variables || [],
      is_default: is_default || false,
      is_active: true,
    });

    return NextResponse.json({
      success: true,
      component: component.toObject(),
    });
  } catch (error) {
    console.error("Error creating email component:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create component" },
      { status: 500 }
    );
  }
}
