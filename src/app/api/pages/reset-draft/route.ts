import { NextResponse } from "next/server";

// This endpoint is deprecated in the new versioning system
// In the new system, versions are immutable and you load previous versions to create new ones
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is deprecated. Use /api/pages/load-version-as-draft instead." },
    { status: 410 }
  );
}
