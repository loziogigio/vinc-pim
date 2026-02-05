/**
 * Unified Notification Tracking API
 *
 * POST /api/b2b/notifications/track - Track notification engagement events
 *
 * Used by mobile apps (Flutter/iOS/Android) to track:
 * - opened: User tapped the notification
 * - clicked: User interacted with content (viewed product, clicked link)
 * - read: User consumed the content (spent time on page)
 * - dismissed: User swiped away the notification
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateTenant } from "@/lib/auth/tenant-auth";
import { recordEngagement, findLogById } from "@/lib/notifications/notification-log.service";
import type { LogEventType } from "@/lib/constants/notification";

type TrackPlatform = "mobile" | "web" | "email" | "ios" | "android";

interface TrackPayload {
  log_id: string;
  event: LogEventType;
  platform?: TrackPlatform;
  metadata?: {
    url?: string;
    sku?: string;
    order_number?: string;
    screen?: string;
    type?: string;  // click_type: "product", "link", "order", etc.
    ip?: string;
    user_agent?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateTenant(req);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error || "Unauthorized" },
        { status: 401 }
      );
    }

    const payload: TrackPayload = await req.json();
    const { log_id, event, platform, metadata } = payload;

    // Validate required fields
    if (!log_id) {
      return NextResponse.json(
        { error: "log_id is required" },
        { status: 400 }
      );
    }

    if (!event) {
      return NextResponse.json(
        { error: "event is required" },
        { status: 400 }
      );
    }

    // Validate event type
    const validEvents: LogEventType[] = ["delivered", "opened", "clicked", "read", "dismissed"];
    if (!validEvents.includes(event)) {
      return NextResponse.json(
        { error: `Invalid event type. Must be one of: ${validEvents.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify the log exists and belongs to this tenant
    const log = await findLogById(log_id);
    if (!log) {
      return NextResponse.json(
        { error: "Notification log not found" },
        { status: 404 }
      );
    }

    // Verify tenant ownership
    if (log.tenant_db !== auth.tenantDb) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Record the engagement event with platform (defaults to "web" if not specified)
    await recordEngagement({
      log_id,
      event_type: event,
      platform: platform || "web",
      metadata: {
        url: metadata?.url,
        ip: metadata?.ip || req.headers.get("x-forwarded-for") || undefined,
        user_agent: metadata?.user_agent || req.headers.get("user-agent") || undefined,
        sku: metadata?.sku,
        order_number: metadata?.order_number,
        screen: metadata?.screen,
        click_type: metadata?.type,
      },
    });

    return NextResponse.json({
      success: true,
      log_id,
      event,
      platform: platform || "web",
    });
  } catch (error) {
    console.error("Error tracking notification:", error);
    return NextResponse.json(
      { error: "Failed to track notification" },
      { status: 500 }
    );
  }
}
