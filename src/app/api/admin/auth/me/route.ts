/**
 * GET /api/admin/auth/me
 * Get current authenticated super admin
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getSuperAdminModel } from "@/lib/db/models/super-admin";

const JWT_SECRET = process.env.SUPER_ADMIN_JWT_SECRET || "super-admin-secret-change-me";
const COOKIE_NAME = "admin_session";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify JWT
    const secret = new TextEncoder().encode(JWT_SECRET);
    let payload;
    try {
      const result = await jwtVerify(token, secret);
      payload = result.payload;
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Get admin from database
    const SuperAdminModel = await getSuperAdminModel();
    const admin = await SuperAdminModel.findById(payload.sub).select("-password_hash");

    if (!admin) {
      return NextResponse.json(
        { error: "Admin not found" },
        { status: 401 }
      );
    }

    if (!admin.is_active) {
      return NextResponse.json(
        { error: "Account is disabled" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        last_login: admin.last_login,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
