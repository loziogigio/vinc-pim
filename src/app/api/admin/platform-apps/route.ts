/**
 * /api/admin/platform-apps
 *
 * GET  - List all platform apps (optionally filter by is_active)
 * POST - Create a new platform app
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "@/lib/auth/admin-auth";
import { getPlatformAppModel } from "@/lib/db/models/admin-platform-app";

const APP_ID_REGEX = /^[a-z][a-z0-9-]{1,49}$/;

/**
 * GET /api/admin/platform-apps
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const PlatformApp = await getPlatformAppModel();
    const { searchParams } = new URL(req.url);
    const isActive = searchParams.get("is_active");

    const filter: Record<string, unknown> = {};
    if (isActive === "true") filter.is_active = true;
    if (isActive === "false") filter.is_active = false;

    const apps = await PlatformApp.find(filter)
      .sort({ sort_order: 1, created_at: 1 })
      .lean();

    return NextResponse.json({ success: true, apps, count: apps.length });
  } catch (error) {
    console.error("[platform-apps] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch platform apps" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/platform-apps
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await req.json();
    const { app_id, name, url, description, icon, color, is_active, sort_order } = body;

    if (!app_id || !name || !url) {
      return NextResponse.json(
        { error: "app_id, name, and url are required" },
        { status: 400 }
      );
    }

    if (!APP_ID_REGEX.test(app_id)) {
      return NextResponse.json(
        { error: "app_id must be lowercase alphanumeric with dashes, 2-50 chars, starting with a letter" },
        { status: 400 }
      );
    }

    const PlatformApp = await getPlatformAppModel();

    const existing = await PlatformApp.findOne({ app_id }).lean();
    if (existing) {
      return NextResponse.json(
        { error: `App with id "${app_id}" already exists` },
        { status: 409 }
      );
    }

    const app = await PlatformApp.create({
      app_id,
      name,
      url,
      description: description || "",
      icon: icon || "",
      color: color || "",
      is_active: is_active !== false,
      sort_order: sort_order ?? 0,
    });

    return NextResponse.json(
      { success: true, app },
      { status: 201 }
    );
  } catch (error) {
    console.error("[platform-apps] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create platform app" },
      { status: 500 }
    );
  }
}
