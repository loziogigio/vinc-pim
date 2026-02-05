/**
 * Notification Channels API
 *
 * GET /api/b2b/notifications/channels - Check which notification channels are enabled
 *
 * Returns availability status for each notification channel:
 * - email: SMTP configured
 * - mobile: FCM configured
 * - web_in_app: Always available (stored in tenant DB)
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { isEmailEnabledAsync } from "@/lib/email";
import { isFCMEnabled } from "@/lib/fcm";

export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;

    // Check each channel's availability
    const [emailEnabled, fcmEnabled] = await Promise.all([
      isEmailEnabledAsync(tenantDb),
      isFCMEnabled(tenantDb),
    ]);

    return NextResponse.json({
      channels: {
        email: emailEnabled,
        mobile: fcmEnabled,
        web_in_app: true, // Always available (stored in tenant DB)
      },
    });
  } catch (error) {
    console.error("Error checking notification channels:", error);
    return NextResponse.json(
      { error: "Failed to check notification channels" },
      { status: 500 }
    );
  }
}
