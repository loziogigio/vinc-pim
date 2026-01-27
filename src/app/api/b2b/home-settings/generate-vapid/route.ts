/**
 * VAPID Key Generation Endpoint
 *
 * POST /api/b2b/home-settings/generate-vapid
 *
 * Generates new VAPID keys for web push notifications.
 * Requires admin authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { initializeVapidKeys, getWebPushSettings, updateWebPushSettings } from "@/lib/push";

/**
 * POST - Generate new VAPID keys
 */
export async function POST(req: NextRequest) {
  try {
    // Get session for tenant context
    const session = await getB2BSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check admin role (optional - customize based on your auth system)
    // if (session.role !== "admin") {
    //   return NextResponse.json(
    //     { error: "Admin access required" },
    //     { status: 403 }
    //   );
    // }

    const tenantDb = `vinc-${session.tenantId}`;

    // Parse optional options from body
    let options: {
      subject?: string;
      defaultIcon?: string;
      defaultBadge?: string;
      forceRegenerate?: boolean;
    } = {};

    try {
      options = await req.json();
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Generate or retrieve VAPID keys
    const config = await initializeVapidKeys(tenantDb, {
      subject: options.subject,
      defaultIcon: options.defaultIcon,
      defaultBadge: options.defaultBadge,
      forceRegenerate: options.forceRegenerate
    });

    return NextResponse.json({
      success: true,
      publicKey: config.publicKey,
      // Note: private key is NOT returned for security
      subject: config.subject,
      message: options.forceRegenerate
        ? "New VAPID keys generated"
        : "VAPID keys initialized (existing keys returned if already configured)"
    });
  } catch (error) {
    console.error("[generate-vapid] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET - Get current VAPID configuration status
 */
export async function GET(req: NextRequest) {
  try {
    // Get session for tenant context
    const session = await getB2BSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const tenantDb = `vinc-${session.tenantId}`;

    // Get current settings
    const settings = await getWebPushSettings(tenantDb);

    return NextResponse.json({
      success: true,
      configured: !!(settings?.vapid_public_key && settings?.vapid_private_key),
      enabled: settings?.enabled || false,
      publicKey: settings?.vapid_public_key || null,
      subject: settings?.vapid_subject || null,
      defaultIcon: settings?.default_icon || null,
      defaultBadge: settings?.default_badge || null
    });
  } catch (error) {
    console.error("[generate-vapid] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update web push settings (enable/disable, icons, etc.)
 */
export async function PATCH(req: NextRequest) {
  try {
    // Get session for tenant context
    const session = await getB2BSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const tenantDb = `vinc-${session.tenantId}`;

    // Parse update fields
    const body = await req.json();
    const { enabled, default_icon, default_badge, vapid_subject } = body as {
      enabled?: boolean;
      default_icon?: string;
      default_badge?: string;
      vapid_subject?: string;
    };

    // Update settings
    const success = await updateWebPushSettings(
      tenantDb,
      {
        ...(enabled !== undefined && { enabled }),
        ...(default_icon !== undefined && { default_icon }),
        ...(default_badge !== undefined && { default_badge }),
        ...(vapid_subject !== undefined && { vapid_subject })
      },
      session.userId
    );

    if (!success) {
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Web push settings updated"
    });
  } catch (error) {
    console.error("[generate-vapid] PATCH Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
