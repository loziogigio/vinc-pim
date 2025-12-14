/**
 * Email Click Tracking API
 * Records the click event and redirects to the original URL
 */

import { NextRequest, NextResponse } from "next/server";
import { recordEmailClick } from "@/lib/email";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  const { emailId } = await params;
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Decode the URL
  const decodedUrl = decodeURIComponent(url);

  // Get tracking info from request
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;
  const userAgent = req.headers.get("user-agent") || undefined;

  // Record the click event (fire and forget)
  recordEmailClick(emailId, decodedUrl, ip, userAgent).catch((err) => {
    console.error(`[Email Track] Failed to record click for ${emailId}:`, err);
  });

  // Redirect to the original URL
  return NextResponse.redirect(decodedUrl, { status: 302 });
}
