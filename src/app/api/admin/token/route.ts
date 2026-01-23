import { NextResponse } from "next/server";
import { getAdminToken } from "@/lib/services/cache-clear.service";
import { getAdminTokenModel } from "@/lib/db/models/admin-token";

/**
 * GET /api/admin/token
 * Returns the current active admin token for cache clear notifications
 */
export async function GET() {
  try {
    // Get or create the admin token
    const token = await getAdminToken();

    if (!token) {
      return NextResponse.json(
        { error: "Failed to get admin token" },
        { status: 500 }
      );
    }

    // Get token metadata
    const AdminToken = await getAdminTokenModel();
    const tokenDoc = await AdminToken.findOne({ token, is_active: true }).lean();

    return NextResponse.json({
      token,
      created_at: tokenDoc?.created_at,
      description: tokenDoc?.description,
      expires_at: tokenDoc?.expires_at,
    });
  } catch (error) {
    console.error("[GET /api/admin/token] Error:", error);
    return NextResponse.json(
      { error: "Failed to get admin token" },
      { status: 500 }
    );
  }
}
