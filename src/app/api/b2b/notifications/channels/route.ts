/**
 * Notification Channels API
 *
 * GET /api/b2b/notifications/channels - Check which notification channels are enabled
 *
 * Returns availability status for each notification channel:
 * - email: SMTP configured
 * - mobile: FCM configured
 * - web_in_app: Always available (stored in tenant DB)
 * - sms: not a campaign channel yet (campaign-send.service has no SMS path),
 *   so it is reported unavailable and the campaign form disables it. Transactional
 *   SMS exists separately via notification_settings/test-send.
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

    // Optional ?channel= param for per-channel email config lookup (default: "default")
    const channelCode = req.nextUrl.searchParams.get("channel") ?? undefined;

    // Check each channel's availability
    const [emailEnabled, fcmEnabled] = await Promise.all([
      isEmailEnabledAsync(tenantDb, channelCode),
      isFCMEnabled(tenantDb),
    ]);

    return NextResponse.json({
      channels: {
        email: emailEnabled,
        sms: false, // campaign SMS not implemented in campaign-send.service yet
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
