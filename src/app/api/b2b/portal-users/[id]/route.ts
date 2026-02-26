/**
 * Single Portal User API
 *
 * GET    /api/b2b/portal-users/[id] - Get portal user details
 * PUT    /api/b2b/portal-users/[id] - Update portal user
 * DELETE /api/b2b/portal-users/[id] - Deactivate portal user
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { connectWithModels } from "@/lib/db/connection";
import type { IPortalUserUpdate, PortalUserSafe } from "@/lib/types/portal-user";
import { isValidChannelCode } from "@/lib/constants/channel";

const BCRYPT_ROUNDS = 10;

/**
 * Authenticate request - supports session or API key
 * Returns tenant-specific models from connection pool
 */
async function authenticateAdmin(req: NextRequest): Promise<{
  authenticated: boolean;
  tenantId?: string;
  tenantDb?: string;
  models?: Awaited<ReturnType<typeof connectWithModels>>;
  error?: string;
  statusCode?: number;
}> {
  const authMethod = req.headers.get("x-auth-method");
  let tenantId: string;
  let tenantDb: string;

  if (authMethod === "api-key") {
    const result = await verifyAPIKeyFromRequest(req);
    if (!result.authenticated) {
      return {
        authenticated: false,
        error: result.error,
        statusCode: result.statusCode,
      };
    }
    tenantId = result.tenantId!;
    tenantDb = result.tenantDb!;
  } else {
    // Session auth (admin users)
    const session = await getB2BSession();
    if (!session || !session.isLoggedIn || !session.tenantId) {
      return { authenticated: false, error: "Unauthorized", statusCode: 401 };
    }
    tenantId = session.tenantId;
    tenantDb = `vinc-${session.tenantId}`;
  }

  // Get tenant-specific models from connection pool
  const models = await connectWithModels(tenantDb);

  return {
    authenticated: true,
    tenantId,
    tenantDb,
    models,
  };
}

/**
 * GET /api/b2b/portal-users/[id]
 * Get portal user details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: portalUserId } = await params;

    const auth = await authenticateAdmin(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { PortalUser: PortalUserModel } = auth.models;

    const user = await PortalUserModel.findOne({
      portal_user_id: portalUserId,
      tenant_id: auth.tenantId,
    })
      .select("-password_hash")
      .lean();

    if (!user) {
      return NextResponse.json(
        { error: "Portal user not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ portal_user: user });
  } catch (error) {
    console.error("Error getting portal user:", error);
    return NextResponse.json(
      { error: "Failed to get portal user" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/b2b/portal-users/[id]
 * Update portal user
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: portalUserId } = await params;

    const auth = await authenticateAdmin(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { PortalUser: PortalUserModel } = auth.models;

    // Find existing user
    const existingUser = await PortalUserModel.findOne({
      portal_user_id: portalUserId,
      tenant_id: auth.tenantId,
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "Portal user not found" },
        { status: 404 }
      );
    }

    // Parse request body
    const body: IPortalUserUpdate = await req.json();
    const { username, email, password, customer_access, is_active } = body;

    // Build update object
    const update: Record<string, unknown> = {};

    // Resolve channel: use new channel if being changed, otherwise existing
    const { channel } = body as IPortalUserUpdate;
    if (channel !== undefined) {
      if (!isValidChannelCode(channel)) {
        return NextResponse.json(
          { error: "Invalid channel code (e.g. B2C, SLOVAKIA)" },
          { status: 400 }
        );
      }
      update.channel = channel;
    }
    const effectiveChannel = channel ?? existingUser.channel;

    // Update username
    if (username !== undefined) {
      const normalizedUsername = username.toLowerCase().trim();

      // Check for duplicate username in same channel
      const duplicate = await PortalUserModel.findOne({
        tenant_id: auth.tenantId,
        username: normalizedUsername,
        channel: effectiveChannel,
        portal_user_id: { $ne: portalUserId },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "Username already exists in this channel" },
          { status: 409 }
        );
      }

      update.username = normalizedUsername;
    }

    // Update email
    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase().trim();

      // Check for duplicate email in same channel
      const duplicate = await PortalUserModel.findOne({
        tenant_id: auth.tenantId,
        email: normalizedEmail,
        channel: effectiveChannel,
        portal_user_id: { $ne: portalUserId },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "Email already exists in this channel" },
          { status: 409 }
        );
      }

      update.email = normalizedEmail;
    }

    // Update password
    if (password !== undefined) {
      update.password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    }

    // Update customer_access
    if (customer_access !== undefined) {
      // Validate format
      for (const ca of customer_access) {
        if (!ca.customer_id) {
          return NextResponse.json(
            { error: "Each customer_access entry must have a customer_id" },
            { status: 400 }
          );
        }
        if (ca.address_access !== "all" && !Array.isArray(ca.address_access)) {
          return NextResponse.json(
            { error: "address_access must be 'all' or an array of address IDs" },
            { status: 400 }
          );
        }
      }
      update.customer_access = customer_access;
    }

    // Update is_active
    if (is_active !== undefined) {
      update.is_active = is_active;
    }

    // Apply update
    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const updatedUser = await PortalUserModel.findOneAndUpdate(
      { portal_user_id: portalUserId, tenant_id: auth.tenantId },
      { $set: update },
      { new: true }
    )
      .select("-password_hash")
      .lean();

    return NextResponse.json({ portal_user: updatedUser });
  } catch (error) {
    console.error("Error updating portal user:", error);

    // Handle duplicate key errors
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: "Username or email already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update portal user" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/portal-users/[id]
 * Deactivate or permanently delete portal user
 * Use ?hard=true for permanent deletion, otherwise soft delete (deactivate)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: portalUserId } = await params;
    const { searchParams } = new URL(req.url);
    const hardDelete = searchParams.get("hard") === "true";

    const auth = await authenticateAdmin(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { PortalUser: PortalUserModel } = auth.models;

    if (hardDelete) {
      // Permanent deletion
      const result = await PortalUserModel.findOneAndDelete({
        portal_user_id: portalUserId,
        tenant_id: auth.tenantId,
      });

      if (!result) {
        return NextResponse.json(
          { error: "Portal user not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        message: "Portal user permanently deleted",
        deleted_id: portalUserId,
      });
    } else {
      // Soft delete (deactivate)
      const result = await PortalUserModel.findOneAndUpdate(
        { portal_user_id: portalUserId, tenant_id: auth.tenantId },
        { $set: { is_active: false } },
        { new: true }
      )
        .select("-password_hash")
        .lean();

      if (!result) {
        return NextResponse.json(
          { error: "Portal user not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        message: "Portal user deactivated",
        portal_user: result,
      });
    }
  } catch (error) {
    console.error("Error deleting portal user:", error);
    return NextResponse.json(
      { error: "Failed to delete portal user" },
      { status: 500 }
    );
  }
}
