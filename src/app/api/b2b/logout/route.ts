import { NextResponse } from "next/server";
import { destroyB2BSession } from "@/lib/auth/b2b-session";

export async function POST() {
  try {
    await destroyB2BSession();
    const response = NextResponse.json({ success: true });
    // Clear SSO session cookie so silent login won't auto-authenticate
    response.cookies.set("sso_sid", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("B2B logout error:", error);
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    );
  }
}
