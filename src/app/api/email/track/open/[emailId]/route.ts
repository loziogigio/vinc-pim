/**
 * Email Open Tracking API
 * Returns a 1x1 transparent pixel and records the open event
 */

import { NextRequest, NextResponse } from "next/server";
import { recordEmailOpen } from "@/lib/email";

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  const { emailId } = await params;

  // Get tracking info from request
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;
  const userAgent = req.headers.get("user-agent") || undefined;

  // Record the open event (fire and forget)
  recordEmailOpen(emailId, ip, userAgent).catch((err) => {
    console.error(`[Email Track] Failed to record open for ${emailId}:`, err);
  });

  // Return transparent pixel
  return new NextResponse(TRANSPARENT_GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
