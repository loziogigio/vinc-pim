/**
 * API Keys Management Endpoints
 *
 * GET  /api/b2b/api-keys - List all API keys (without secrets)
 * POST /api/b2b/api-keys - Create a new API key
 */

import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { API_KEY_PERMISSIONS } from "@/lib/db/models/api-key";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { generateAPIKey, hashAPISecret } from "@/lib/auth/api-key-auth";
import { getTenantDbFromRequest, getTenantIdFromRequest } from "@/lib/utils/tenant";

/**
 * GET /api/b2b/api-keys - List all API keys (without secrets)
 */
export async function GET(request: NextRequest) {
  try {
    // Check session authentication
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can manage API keys
    if (session.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can manage API keys" },
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

    // Get all keys (exclude secret_hash)
    const keys = await APIKeyModel.find()
      .select("-secret_hash")
      .sort({ created_at: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      keys,
      permissions: API_KEY_PERMISSIONS,
    });
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b/api-keys - Create a new API key
 * Body: { name: string, permissions?: string[] }
 * Returns: { key_id, secret, name, permissions } (secret shown ONCE)
 */
export async function POST(request: NextRequest) {
  try {
    // Check session authentication
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can manage API keys
    if (session.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can create API keys" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, permissions = ["*"] } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: "Name must be 100 characters or less" },
        { status: 400 }
      );
    }

    // Validate permissions
    const validPermissions = API_KEY_PERMISSIONS.map(p => p.value);
    if (!Array.isArray(permissions) || !permissions.every(p => validPermissions.includes(p))) {
      return NextResponse.json(
        { error: "Invalid permissions" },
        { status: 400 }
      );
    }

    // Get tenant info - prefer session for authenticated users (avoids env var fallback)
    let tenantId = session.tenantId;
    let tenantDb = tenantId ? `vinc-${tenantId}` : null;

    // Only fall back to request headers if no session tenant
    if (!tenantId) {
      tenantId = getTenantIdFromRequest(request);
      tenantDb = getTenantDbFromRequest(request);
    }

    if (!tenantId || !tenantDb) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      );
    }

    // Get tenant-specific models from connection pool
    const { APIKey: APIKeyModel } = await connectWithModels(tenantDb);

    // Generate key pair
    const { keyId, secret } = generateAPIKey(tenantId);
    const secretHash = await hashAPISecret(secret);

    // Create the key document
    const newKey = await APIKeyModel.create({
      key_id: keyId,
      secret_hash: secretHash,
      name: name.trim(),
      permissions,
      is_active: true,
      created_by: session.userId,
    });

    // Return the key with the secret (shown only once!)
    return NextResponse.json({
      success: true,
      key: {
        _id: newKey._id,
        key_id: newKey.key_id,
        name: newKey.name,
        permissions: newKey.permissions,
        is_active: newKey.is_active,
        created_at: newKey.created_at,
        created_by: newKey.created_by,
      },
      // Secret is returned ONLY during creation
      secret,
      warning: "Save this secret now! It will not be shown again.",
    });
  } catch (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}
