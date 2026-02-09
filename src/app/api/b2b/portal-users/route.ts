/**
 * Portal Users API
 *
 * GET  /api/b2b/portal-users - List all portal users (admin only)
 * POST /api/b2b/portal-users - Create a new portal user (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { connectWithModels } from "@/lib/db/connection";
import type { IPortalUserCreate, PortalUserSafe } from "@/lib/types/portal-user";

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
 * GET /api/b2b/portal-users
 * List all portal users for the tenant
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateAdmin(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { PortalUser: PortalUserModel } = auth.models;

    // Parse query params
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const search = searchParams.get("search") || "";
    const customerId = searchParams.get("customer_id") || "";
    const isActive = searchParams.get("is_active");

    // Build query
    const query: Record<string, unknown> = { tenant_id: auth.tenantId };

    if (search) {
      query.$or = [
        { portal_user_id: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (customerId) {
      query["customer_access.customer_id"] = customerId;
    }

    if (isActive !== null && isActive !== "") {
      query.is_active = isActive === "true";
    }

    // Execute query
    const skip = (page - 1) * limit;

    // Build stats query (always for full tenant, not filtered)
    const statsQuery = { tenant_id: auth.tenantId };

    const [users, total, stats] = await Promise.all([
      PortalUserModel.find(query)
        .select("-password_hash")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PortalUserModel.countDocuments(query),
      // Aggregate stats for all users (not filtered)
      PortalUserModel.aggregate([
        { $match: statsQuery },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: ["$is_active", 1, 0] } },
            inactive: { $sum: { $cond: ["$is_active", 0, 1] } },
            with_access: {
              $sum: {
                $cond: [{ $gt: [{ $size: { $ifNull: ["$customer_access", []] } }, 0] }, 1, 0],
              },
            },
            never_logged_in: {
              $sum: { $cond: [{ $eq: ["$last_login_at", null] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    // Extract stats (default to 0 if no users exist)
    const statsResult = stats[0] || {
      total: 0,
      active: 0,
      inactive: 0,
      with_access: 0,
      never_logged_in: 0,
    };

    return NextResponse.json({
      portal_users: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: {
        total: statsResult.total,
        active: statsResult.active,
        inactive: statsResult.inactive,
        with_access: statsResult.with_access,
        never_logged_in: statsResult.never_logged_in,
      },
    });
  } catch (error) {
    console.error("Error listing portal users:", error);
    return NextResponse.json(
      { error: "Failed to list portal users" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b/portal-users
 * Create a new portal user
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateAdmin(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { PortalUser: PortalUserModel } = auth.models;

    // Parse request body
    const body: IPortalUserCreate = await req.json();
    const { username, email, password, customer_access } = body;

    // Validate required fields
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: "Username, email, and password are required" },
        { status: 400 }
      );
    }

    // customer_access can be empty - users can add customer assignments later

    // Normalize username and email
    const normalizedUsername = username.toLowerCase().trim();
    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing username
    const existingUsername = await PortalUserModel.findOne({
      tenant_id: auth.tenantId,
      username: normalizedUsername,
    });

    if (existingUsername) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409 }
      );
    }

    // Check for existing email
    const existingEmail = await PortalUserModel.findOne({
      tenant_id: auth.tenantId,
      email: normalizedEmail,
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 }
      );
    }

    // Validate customer_access format if provided
    if (customer_access && customer_access.length > 0) {
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
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Generate unique ID
    const portalUserId = `PU-${nanoid(8)}`;

    // Create portal user
    const newUser = await PortalUserModel.create({
      portal_user_id: portalUserId,
      tenant_id: auth.tenantId,
      username: normalizedUsername,
      email: normalizedEmail,
      password_hash: passwordHash,
      customer_access: customer_access || [],
      is_active: true,
    });

    // Return user without password_hash
    const portalUser: PortalUserSafe = {
      portal_user_id: newUser.portal_user_id,
      tenant_id: newUser.tenant_id,
      username: newUser.username,
      email: newUser.email,
      customer_access: newUser.customer_access,
      is_active: newUser.is_active,
      last_login_at: newUser.last_login_at,
      created_at: newUser.created_at,
      updated_at: newUser.updated_at,
    };

    return NextResponse.json(
      { portal_user: portalUser },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating portal user:", error);

    // Handle duplicate key errors
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: "Username or email already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create portal user" },
      { status: 500 }
    );
  }
}
