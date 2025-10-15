import { NextResponse } from "next/server";

// This endpoint is deprecated in the new versioning system
// Use /api/pages/save-draft instead
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is deprecated. Use /api/pages/save-draft instead." },
    { status: 410 }
  );
}
