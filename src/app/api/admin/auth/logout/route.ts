/**
 * POST /api/admin/auth/logout
 * Super admin logout - clears session cookie
 */

import { NextResponse } from "next/server";

const COOKIE_NAME = "admin_session";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });

  // Clear the session cookie
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0, // Expire immediately
    path: "/",
  });

  return response;
}
