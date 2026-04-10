/**
 * /api/admin/platform-apps/[id]
 *
 * GET    - Get a single platform app by app_id
 * PATCH  - Update a platform app
 * DELETE - Delete a platform app
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "@/lib/auth/admin-auth";
import { getPlatformAppModel } from "@/lib/db/models/admin-platform-app";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function findApp(id: string) {
  const PlatformApp = await getPlatformAppModel();
  return PlatformApp.findOne({ app_id: id });
}

/**
 * GET /api/admin/platform-apps/[id]
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await verifyAdminAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const { id } = await params;
    const app = await findApp(id);

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, app });
  } catch (error) {
    console.error("[platform-apps] GET [id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch platform app" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/platform-apps/[id]
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await verifyAdminAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const { id } = await params;
    const app = await findApp(id);

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    const body = await req.json();
    const { app_id, name, description, url, icon, color, is_active, sort_order } = body;

    // Allow changing app_id (must be unique)
    if (app_id !== undefined && app_id !== app.app_id) {
      const PlatformApp = await getPlatformAppModel();
      const existing = await PlatformApp.findOne({ app_id });
      if (existing) {
        return NextResponse.json(
          { error: `App ID "${app_id}" is already in use` },
          { status: 409 }
        );
      }
      app.app_id = app_id;
    }

    if (name !== undefined) app.name = name;
    if (description !== undefined) app.description = description;
    if (url !== undefined) app.url = url;
    if (icon !== undefined) app.icon = icon;
    if (color !== undefined) app.color = color;
    if (is_active !== undefined) app.is_active = is_active;
    if (sort_order !== undefined) app.sort_order = sort_order;

    await app.save();

    return NextResponse.json({ success: true, app });
  } catch (error) {
    console.error("[platform-apps] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update platform app" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/platform-apps/[id]
 */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await verifyAdminAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const { id } = await params;
    const PlatformApp = await getPlatformAppModel();
    const app = await PlatformApp.findOneAndDelete({ app_id: id });

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `App "${id}" deleted`,
    });
  } catch (error) {
    console.error("[platform-apps] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete platform app" },
      { status: 500 }
    );
  }
}
