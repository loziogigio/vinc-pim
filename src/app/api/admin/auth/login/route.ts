/**
 * POST /api/admin/auth/login
 * Super admin login endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getSuperAdminModel } from "@/lib/db/models/super-admin";

function getJwtSecret(): string {
  const secret = process.env.SUPER_ADMIN_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SUPER_ADMIN_JWT_SECRET env var must be set and at least 32 characters long");
  }
  return secret;
}
const JWT_EXPIRES_IN = "7d";
const COOKIE_NAME = "admin_session";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const SuperAdminModel = await getSuperAdminModel();
    const admin = await SuperAdminModel.findByEmail(email);

    if (!admin) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (!admin.is_active) {
      return NextResponse.json(
        { error: "Account is disabled" },
        { status: 401 }
      );
    }

    const isValidPassword = await admin.comparePassword(password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Update last login
    admin.last_login = new Date();
    await admin.save();

    // Create JWT token
    const secret = new TextEncoder().encode(getJwtSecret());
    const token = await new SignJWT({
      sub: (admin._id as { toString(): string }).toString(),
      email: admin.email,
      name: admin.name,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRES_IN)
      .sign(secret);

    // Set cookie
    const response = NextResponse.json({
      success: true,
      admin: {
        email: admin.email,
        name: admin.name,
      },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
