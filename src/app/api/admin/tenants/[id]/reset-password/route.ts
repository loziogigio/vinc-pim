/**
 * /api/admin/tenants/[id]/reset-password
 *
 * POST - Reset tenant admin user password
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { verifyAdminAuth, unauthorizedResponse } from "@/lib/auth/admin-auth";
import { getTenant } from "@/lib/services/admin-tenant.service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/admin/tenants/[id]/reset-password
 * Reset the admin user's password for a tenant
 *
 * Body:
 * - new_password: string (min 8 characters)
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { id: tenantId } = await params;

  try {
    // Validate tenant exists
    const tenant = await getTenant(tenantId);
    if (!tenant) {
      return NextResponse.json(
        { error: `Tenant '${tenantId}' not found` },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { new_password } = body;

    if (!new_password || typeof new_password !== "string") {
      return NextResponse.json(
        { error: "new_password is required" },
        { status: 400 }
      );
    }

    if (new_password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Connect to tenant database
    const mongoUrl = process.env.VINC_MONGO_URL;
    if (!mongoUrl) {
      throw new Error("VINC_MONGO_URL is not set");
    }

    const dbName = `vinc-${tenantId}`;
    const connection = mongoose.createConnection(mongoUrl, {
      dbName,
    });

    await connection.asPromise();

    // Define B2BUser schema for this connection
    const B2BUserSchema = new mongoose.Schema({
      username: String,
      email: String,
      passwordHash: String,
      role: String,
      companyName: String,
      isActive: Boolean,
    });

    const B2BUserModel = connection.model("B2BUser", B2BUserSchema);

    // Find admin user by email
    const adminUser = await B2BUserModel.findOne({
      email: tenant.admin_email.toLowerCase(),
    });

    if (!adminUser) {
      await connection.close();
      return NextResponse.json(
        { error: `Admin user '${tenant.admin_email}' not found in tenant database` },
        { status: 404 }
      );
    }

    // Hash new password and update
    const passwordHash = await bcrypt.hash(new_password, 12);
    await B2BUserModel.updateOne(
      { _id: adminUser._id },
      { $set: { passwordHash } }
    );

    await connection.close();

    console.log(`Password reset for admin user '${tenant.admin_email}' in tenant '${tenantId}'`);

    return NextResponse.json({
      success: true,
      message: `Password reset successfully for ${tenant.admin_email}`,
    });
  } catch (error) {
    console.error("Reset password error:", error);
    const message = error instanceof Error ? error.message : "Failed to reset password";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
