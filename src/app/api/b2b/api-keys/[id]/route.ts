/**
 * Single API Key Management Endpoints
 *
 * GET    /api/b2b/api-keys/[id] - Get key details (no secret)
 * PATCH  /api/b2b/api-keys/[id] - Update name, permissions, is_active
 * DELETE /api/b2b/api-keys/[id] - Delete key
 */

import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { API_KEY_PERMISSIONS } from "@/lib/db/models/api-key";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { getTenantDbFromRequest } from "@/lib/utils/tenant";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/b2b/api-keys/[id] - Get key details (no secret)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check session authentication
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can manage API keys
    if (session.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can view API keys" },
        { status: 403 }
      );
    }

    // Get tenant database - prefer session for authenticated users (avoids env var fallback)
    let tenantDb = session.tenantId ? `vinc-${session.tenantId}` : null;
    if (!tenantDb) {
      tenantDb = getTenantDbFromRequest(request);
    }
    if (!tenantDb) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      );
    }

    // Get tenant-specific models from connection pool
    const { APIKey: APIKeyModel } = await connectWithModels(tenantDb);

    // Find key by _id or key_id
    const key = await APIKeyModel.findOne({
      $or: [{ _id: id }, { key_id: id }],
    })
      .select("-secret_hash")
      .lean();

    if (!key) {
      return NextResponse.json(
        { error: "API key not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      key,
    });
  } catch (error) {
    console.error("Error fetching API key:", error);
    return NextResponse.json(
      { error: "Failed to fetch API key" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/b2b/api-keys/[id] - Update key
 * Body: { name?: string, permissions?: string[], is_active?: boolean }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check session authentication
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can manage API keys
    if (session.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can update API keys" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, permissions, is_active } = body;

    // Build update object
    const update: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Name must be a non-empty string" },
          { status: 400 }
        );
      }
      if (name.length > 100) {
        return NextResponse.json(
          { error: "Name must be 100 characters or less" },
          { status: 400 }
        );
      }
      update.name = name.trim();
    }

    if (permissions !== undefined) {
      const validPermissions = API_KEY_PERMISSIONS.map(p => p.value);
      if (!Array.isArray(permissions) || !permissions.every(p => validPermissions.includes(p))) {
        return NextResponse.json(
          { error: "Invalid permissions" },
          { status: 400 }
        );
      }
      update.permissions = permissions;
    }

    if (is_active !== undefined) {
      if (typeof is_active !== "boolean") {
        return NextResponse.json(
          { error: "is_active must be a boolean" },
          { status: 400 }
        );
      }
      update.is_active = is_active;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Get tenant database - prefer session for authenticated users (avoids env var fallback)
    let tenantDb = session.tenantId ? `vinc-${session.tenantId}` : null;
    if (!tenantDb) {
      tenantDb = getTenantDbFromRequest(request);
    }
    if (!tenantDb) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      );
    }

    // Get tenant-specific models from connection pool
    const { APIKey: APIKeyModel } = await connectWithModels(tenantDb);

    // Find and update
    const key = await APIKeyModel.findOneAndUpdate(
      { $or: [{ _id: id }, { key_id: id }] },
      { $set: update },
      { new: true }
    ).select("-secret_hash");

    if (!key) {
      return NextResponse.json(
        { error: "API key not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      key,
    });
  } catch (error) {
    console.error("Error updating API key:", error);
    return NextResponse.json(
      { error: "Failed to update API key" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/api-keys/[id] - Delete key
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check session authentication
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can manage API keys
    if (session.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can delete API keys" },
        { status: 403 }
      );
    }

    // Get tenant database - prefer session for authenticated users (avoids env var fallback)
    let tenantDb = session.tenantId ? `vinc-${session.tenantId}` : null;
    if (!tenantDb) {
      tenantDb = getTenantDbFromRequest(request);
    }
    if (!tenantDb) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      );
    }

    // Get tenant-specific models from connection pool
    const { APIKey: APIKeyModel } = await connectWithModels(tenantDb);

    // Find and delete
    const result = await APIKeyModel.findOneAndDelete({
      $or: [{ _id: id }, { key_id: id }],
    });

    if (!result) {
      return NextResponse.json(
        { error: "API key not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "API key deleted",
    });
  } catch (error) {
    console.error("Error deleting API key:", error);
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    );
  }
}
