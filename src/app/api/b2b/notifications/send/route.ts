/**
 * Notification Send API (Trigger-based)
 *
 * GET  /api/b2b/notifications/send - List available triggers and their variables
 * POST /api/b2b/notifications/send - Send notification using a template trigger
 *
 * This endpoint allows external systems (ERP, CRM, mobile apps) to trigger
 * automated notifications using templates.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { sendNotification } from "@/lib/notifications/send.service";
import { listTemplates } from "@/lib/notifications/template.service";
import {
  NOTIFICATION_TRIGGERS,
  TRIGGER_LABELS,
  type NotificationTrigger,
} from "@/lib/constants/notification";

// ============================================
// TYPES
// ============================================

interface SendNotificationPayload {
  /** Trigger ID (e.g., "order_confirmation", "welcome_email") */
  trigger: NotificationTrigger;
  /** Recipient email address */
  to: string;
  /** Template variables to replace */
  variables?: Record<string, string>;
  /** Optional reply-to email */
  reply_to?: string;
  /** Portal user ID for in-app/push notifications */
  portal_user_id?: string;
}

// Known variables for each trigger type
const TRIGGER_VARIABLES: Record<string, string[]> = {
  registration_request_admin: ["customer_name", "company_name", "email", "approval_url"],
  registration_request_customer: ["customer_name", "company_name"],
  welcome: ["customer_name", "company_name", "username", "password", "login_url", "shop_name"],
  forgot_password: ["customer_name", "temporary_password", "login_url", "shop_name"],
  reset_password: ["customer_name", "reset_date", "ip_address", "login_url", "support_email", "shop_name"],
  order_confirmation: ["customer_name", "order_number", "order_date", "order_total", "items_list", "shipping_address", "order_url"],
  order_shipped: ["customer_name", "order_number", "tracking_number", "carrier", "tracking_url", "estimated_delivery"],
  order_delivered: ["customer_name", "order_number", "delivery_date"],
  order_cancelled: ["customer_name", "order_number", "cancellation_reason", "support_email"],
  price_drop_alert: ["customer_name", "product_name", "old_price", "new_price", "discount_percentage", "product_url"],
  back_in_stock: ["customer_name", "product_name", "product_url"],
  abandoned_cart: ["customer_name", "cart_items", "cart_total", "cart_url"],
  newsletter: ["customer_name"],
  campaign_product: ["customer_name"],
  campaign_generic: ["customer_name"],
  custom: [],
};

// ============================================
// GET - List available triggers
// ============================================

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;

    // Get active templates to show which triggers are configured
    const { templates } = await listTemplates(tenantDb, {
      is_active: true,
      limit: 100,
    });

    // Build trigger info with configured status
    const configuredTriggers = new Set(templates.map((t) => t.trigger));

    const triggers = NOTIFICATION_TRIGGERS.map((trigger) => ({
      trigger,
      label: TRIGGER_LABELS[trigger],
      variables: TRIGGER_VARIABLES[trigger] || [],
      is_configured: configuredTriggers.has(trigger),
    }));

    return NextResponse.json({
      triggers,
      total: triggers.length,
      configured: configuredTriggers.size,
      usage: {
        endpoint: "POST /api/b2b/notifications/send",
        headers: {
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_{tenant-id}_{key}",
          "x-api-secret": "sk_{secret}",
        },
        body: {
          trigger: "order_confirmation",
          to: "customer@example.com",
          variables: {
            customer_name: "Mario Rossi",
            order_number: "ORD-12345",
            order_total: "€150.00",
          },
        },
      },
    });
  } catch (error) {
    console.error("Error listing triggers:", error);
    return NextResponse.json(
      { error: "Failed to list triggers" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Send notification
// ============================================

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb, userId } = auth;
    const payload: SendNotificationPayload = await req.json();

    // Validate required fields
    if (!payload.trigger) {
      return NextResponse.json(
        { error: "Missing required field: trigger" },
        { status: 400 }
      );
    }

    if (!payload.to) {
      return NextResponse.json(
        { error: "Missing required field: to (recipient email)" },
        { status: 400 }
      );
    }

    // Validate trigger is known
    if (!NOTIFICATION_TRIGGERS.includes(payload.trigger)) {
      return NextResponse.json(
        {
          error: `Unknown trigger: ${payload.trigger}`,
          available_triggers: NOTIFICATION_TRIGGERS,
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.to)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Send notification using the template system
    const result = await sendNotification({
      tenantDb,
      trigger: payload.trigger,
      to: payload.to,
      variables: payload.variables || {},
      replyTo: payload.reply_to,
      targetUserId: payload.portal_user_id || userId,
      targetUserType: "portal_user",
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          trigger: payload.trigger,
        },
        { status: result.error?.includes("No active template") ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      trigger: payload.trigger,
      to: payload.to,
      email_id: result.emailId,
      message_id: result.messageId,
      in_app_id: result.inAppNotificationId,
      push_result: result.pushResult
        ? {
            sent: result.pushResult.sent,
            queued: result.pushResult.queued,
            failed: result.pushResult.failed,
          }
        : undefined,
      fcm_result: result.fcmResult
        ? {
            sent: result.fcmResult.sent,
            queued: result.fcmResult.queued,
            failed: result.fcmResult.failed,
          }
        : undefined,
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
