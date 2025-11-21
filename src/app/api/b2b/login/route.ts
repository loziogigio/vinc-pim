import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { B2BUserModel } from "@/lib/db/models/b2b-user";
import { createB2BSession } from "@/lib/auth/b2b-session";
import { ActivityLogModel } from "@/lib/db/models/activity-log";
import { getTenantDbFromRequest } from "@/lib/utils/tenant";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Extract tenant database from request (subdomain, header, or query param)
    const tenantDb = getTenantDbFromRequest(request);

    if (!tenantDb) {
      return NextResponse.json(
        { error: "Tenant ID not found in request. Please access via tenant subdomain or provide X-Tenant-ID header." },
        { status: 400 }
      );
    }

    await connectToDatabase(tenantDb);

    // Find user
    const user = await B2BUserModel.findOne({ username, isActive: true });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Log activity
    await ActivityLogModel.create({
      type: "user_login",
      description: `User ${username} logged in`,
      performedBy: username,
    });

    // Create session
    await createB2BSession({
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      companyName: user.companyName,
    });

    return NextResponse.json({
      success: true,
      user: {
        username: user.username,
        email: user.email,
        role: user.role,
        companyName: user.companyName,
      },
    });
  } catch (error) {
    console.error("B2B login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
