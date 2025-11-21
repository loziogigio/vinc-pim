import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase, getCurrentDatabase } from "@/lib/db/connection";
import { getTenantIdFromRequest, getTenantDbFromRequest } from "@/lib/utils/tenant";
import { B2BUserModel } from "@/lib/db/models/b2b-user";

/**
 * Debug endpoint to test database connections
 * GET /api/b2b/debug/db-connection
 */
export async function GET(request: NextRequest) {
  try {
    // Extract tenant information
    const tenantId = getTenantIdFromRequest(request);
    const tenantDb = getTenantDbFromRequest(request);

    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      request: {
        url: request.url,
        headers: {
          "x-resolved-tenant-id": request.headers.get("x-resolved-tenant-id"),
          "x-resolved-tenant-db": request.headers.get("x-resolved-tenant-db"),
          "x-tenant-id": request.headers.get("x-tenant-id"),
          host: request.headers.get("host"),
        },
        query: Object.fromEntries(new URL(request.url).searchParams),
      },
      tenant: {
        extractedTenantId: tenantId,
        resolvedDatabaseName: tenantDb,
      },
      env: {
        VINC_TENANT_ID: process.env.VINC_TENANT_ID,
        VINC_MONGO_DB: process.env.VINC_MONGO_DB,
        VINC_MONGO_URL: process.env.VINC_MONGO_URL?.replace(/\/\/.*@/, "//***@"),
      },
    };

    if (!tenantDb) {
      return NextResponse.json(
        {
          error: "Tenant database could not be determined",
          debug: debugInfo,
        },
        { status: 400 }
      );
    }

    // Attempt to connect
    console.log(`\n🔍 Debug: Attempting to connect to ${tenantDb}...`);
    await connectToDatabase(tenantDb);

    const currentDb = getCurrentDatabase();
    console.log(`🔍 Debug: Currently connected to ${currentDb}`);

    // Test query - count users
    const userCount = await B2BUserModel.countDocuments();
    const users = await B2BUserModel.find()
      .select("username email role companyName isActive")
      .limit(10)
      .lean();

    return NextResponse.json({
      success: true,
      connection: {
        requestedDatabase: tenantDb,
        connectedDatabase: currentDb,
        isCorrectDatabase: currentDb === tenantDb,
      },
      data: {
        userCount,
        users,
      },
      debug: debugInfo,
    });
  } catch (error: any) {
    console.error("Debug connection error:", error);
    return NextResponse.json(
      {
        error: "Database connection failed",
        message: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
