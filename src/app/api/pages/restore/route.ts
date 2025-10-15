import { NextResponse } from "next/server";

export const runtime = "nodejs";

// This endpoint is deprecated in the new versioning system
// Use /api/pages/load-version-as-draft instead
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is deprecated. Use /api/pages/load-version-as-draft instead." },
    { status: 410 }
  );
}
