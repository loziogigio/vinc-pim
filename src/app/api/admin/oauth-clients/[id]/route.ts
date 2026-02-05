/**
 * /api/admin/oauth-clients/[id]
 *
 * GET    - Get single OAuth client
 * PUT    - Update OAuth client
 * DELETE - Deactivate OAuth client (soft delete)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "@/lib/auth/admin-auth";
import { getAuthClientModel } from "@/lib/db/models/sso-auth-client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/oauth-clients/[id]
 * Get a single OAuth client by client_id
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await params;

    const AuthClient = await getAuthClientModel();
    const client = await AuthClient.findOne({ client_id: id.toLowerCase() })
      .select("-client_secret_hash")
      .lean();

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      client,
    });
  } catch (error) {
    console.error("Get OAuth client error:", error);
    return NextResponse.json(
      { error: "Failed to get OAuth client" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/oauth-clients/[id]
 * Update an OAuth client
 *
 * Body (all optional):
 * - name: string
 * - redirect_uris: string[] (required for mobile apps only)
 * - description: string
 * - is_active: boolean
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { name, redirect_uris, description, is_active } = body;

    const AuthClient = await getAuthClientModel();

    // Fetch client to check type
    const existingClient = await AuthClient.findOne({ client_id: id.toLowerCase() });
    if (!existingClient) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // Build update object with only provided fields
    const updateFields: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!name || typeof name !== "string") {
        return NextResponse.json(
          { error: "name must be a non-empty string" },
          { status: 400 }
        );
      }
      updateFields.name = name;
    }

    if (redirect_uris !== undefined) {
      if (!Array.isArray(redirect_uris)) {
        return NextResponse.json(
          { error: "redirect_uris must be an array" },
          { status: 400 }
        );
      }
      // Mobile apps require at least one redirect URI
      if (existingClient.type === "mobile" && redirect_uris.length === 0) {
        return NextResponse.json(
          { error: "Mobile apps require at least one redirect URI (deep link)" },
          { status: 400 }
        );
      }
      // Validate each URI
      for (const uri of redirect_uris) {
        try {
          new URL(uri);
        } catch {
          return NextResponse.json(
            { error: `Invalid redirect URI: ${uri}` },
            { status: 400 }
          );
        }
      }
      updateFields.redirect_uris = redirect_uris;
    }

    if (description !== undefined) {
      updateFields.description = description;
    }

    if (is_active !== undefined) {
      if (typeof is_active !== "boolean") {
        return NextResponse.json(
          { error: "is_active must be a boolean" },
          { status: 400 }
        );
      }
      updateFields.is_active = is_active;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const client = await AuthClient.findOneAndUpdate(
      { client_id: id.toLowerCase() },
      { $set: updateFields },
      { new: true }
    ).select("-client_secret_hash");

    return NextResponse.json({
      success: true,
      client,
      message: "Client updated successfully",
    });
  } catch (error) {
    console.error("Update OAuth client error:", error);
    return NextResponse.json(
      { error: "Failed to update OAuth client" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/oauth-clients/[id]
 * Deactivate an OAuth client (soft delete)
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await params;

    const AuthClient = await getAuthClientModel();
    const client = await AuthClient.findOneAndUpdate(
      { client_id: id.toLowerCase() },
      { $set: { is_active: false } },
      { new: true }
    ).select("-client_secret_hash");

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Client '${id}' has been deactivated`,
    });
  } catch (error) {
    console.error("Delete OAuth client error:", error);
    return NextResponse.json(
      { error: "Failed to delete OAuth client" },
      { status: 500 }
    );
  }
}
