/**
 * B2B Authentication and Database Connection Helpers
 * Utilities for handling tenant-specific database connections in B2B routes
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { getTenantDbFromRequest } from "@/lib/utils/tenant";
import { verifyB2BSession } from "./b2b-session";

/**
 * Connect to tenant-specific database based on request
 * Extracts tenant ID from subdomain, header, or query parameter
 *
 * @param request - Next.js request object
 * @returns Database name if successful, or NextResponse error if tenant not found
 */
export async function connectToTenantDb(request: NextRequest): Promise<string | NextResponse> {
  const tenantDb = getTenantDbFromRequest(request);

  if (!tenantDb) {
    return NextResponse.json(
      {
        error: "Tenant ID not found in request. Please access via tenant subdomain or provide X-Tenant-ID header.",
        hint: "Use subdomain (e.g., tenant-id.domain.com), query param (?tenant=tenant-id), or X-Tenant-ID header"
      },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase(tenantDb);
    return tenantDb;
  } catch (error) {
    console.error("Failed to connect to tenant database:", error);
    return NextResponse.json(
      { error: "Database connection failed" },
      { status: 500 }
    );
  }
}

/**
 * Initialize B2B route with tenant database connection and session verification
 *
 * @param request - Next.js request object
 * @returns Session data if successful, or NextResponse error
 */
export async function initializeB2BRoute(request: NextRequest) {
  // Connect to tenant-specific database
  const dbResult = await connectToTenantDb(request);

  // If dbResult is a NextResponse (error), return it
  if (dbResult instanceof NextResponse) {
    return { error: dbResult };
  }

  // Verify session
  const session = await verifyB2BSession();

  if (!session) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    };
  }

  return {
    session,
    tenantDb: dbResult,
  };
}
