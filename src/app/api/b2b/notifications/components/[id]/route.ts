/**
 * Email Component API - Single Item
 *
 * GET    /api/b2b/notifications/components/[id] - Get component by ID
 * PUT    /api/b2b/notifications/components/[id] - Update component
 * DELETE /api/b2b/notifications/components/[id] - Delete component
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateTenant } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { EMAIL_COMPONENT_TYPES } from "@/lib/db/models/email-component";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateTenant(req);
    if (!auth.authenticated || !auth.tenantDb) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantDb = auth.tenantDb;
    const { EmailComponent } = await connectWithModels(tenantDb);

    const component = await EmailComponent.findOne({ component_id: id }).lean();
    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    return NextResponse.json({ component });
  } catch (error) {
    console.error("Error fetching email component:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch component" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateTenant(req);
    if (!auth.authenticated || !auth.tenantDb) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, description, html_content, variables, is_default, is_active } = body;

    const tenantDb = auth.tenantDb;
    const { EmailComponent } = await connectWithModels(tenantDb);

    const component = await EmailComponent.findOne({ component_id: id });
    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    // If setting as default, unset other defaults of same type
    if (is_default && !component.is_default) {
      await EmailComponent.updateMany(
        { type: component.type, is_default: true },
        { $set: { is_default: false } }
      );
    }

    // Update fields
    if (name !== undefined) component.name = name.trim();
    if (description !== undefined) component.description = description?.trim();
    if (html_content !== undefined) component.html_content = html_content.trim();
    if (variables !== undefined) component.variables = variables;
    if (is_default !== undefined) component.is_default = is_default;
    if (is_active !== undefined) component.is_active = is_active;

    await component.save();

    return NextResponse.json({
      success: true,
      component: component.toObject(),
    });
  } catch (error) {
    console.error("Error updating email component:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update component" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateTenant(req);
    if (!auth.authenticated || !auth.tenantDb) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantDb = auth.tenantDb;
    const { EmailComponent, NotificationTemplate } = await connectWithModels(tenantDb);

    const component = await EmailComponent.findOne({ component_id: id });
    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    // Check if component is used by any templates
    const usedBy = await NotificationTemplate.countDocuments({
      $or: [
        { header_id: id },
        { footer_id: id }
      ]
    });

    if (usedBy > 0) {
      return NextResponse.json(
        { error: `Cannot delete: component is used by ${usedBy} template(s)` },
        { status: 400 }
      );
    }

    await component.deleteOne();

    return NextResponse.json({
      success: true,
      message: "Component deleted",
    });
  } catch (error) {
    console.error("Error deleting email component:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete component" },
      { status: 500 }
    );
  }
}
