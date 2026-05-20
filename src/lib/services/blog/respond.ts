import { NextResponse } from "next/server";

/** Map a thrown service error (optionally carrying .status) to a JSON error response. */
export function blogError(error: unknown, fallback: string): NextResponse {
  const status =
    typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
  const message = error instanceof Error ? error.message : fallback;
  if (status >= 500) console.error(`[blog] ${fallback}:`, error);
  return NextResponse.json({ error: message }, { status });
}
