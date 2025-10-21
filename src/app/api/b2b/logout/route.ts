import { NextResponse } from "next/server";
import { destroyB2BSession } from "@/lib/auth/b2b-session";

export async function POST() {
  try {
    await destroyB2BSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("B2B logout error:", error);
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    );
  }
}
