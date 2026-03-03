/**
 * Template Test API
 *
 * POST /api/b2b/notifications/templates/[id]/test - Send test email for a template
 *
 * Accepts optional `order_id` to populate template with real order data.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateTenant } from "@/lib/auth/tenant-auth";
import { sendEmail } from "@/lib/email";
import { previewTemplate } from "@/lib/notifications/template.service";
import { getTemplate } from "@/lib/notifications/template.service";
import { buildOrderTestVariables } from "@/lib/notifications/order-notification.service";
import type { NotificationTrigger } from "@/lib/constants/notification";

const ORDER_TRIGGERS = new Set<string>([
  "order_confirmation",
  "order_shipped",
  "order_delivered",
  "order_cancelled",
  "payment_received",
]);

interface TestPayload {
  test_email: string;
  sample_data?: Record<string, string>;
  order_id?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateTenant(req);
    if (!auth.authenticated || !auth.tenantDb) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { id: templateId } = await params;
    const tenantDb = auth.tenantDb;
    const body: TestPayload = await req.json();

    const { test_email, sample_data = {}, order_id } = body;

    // Validate email
    if (!test_email) {
      return NextResponse.json({ error: "Test email address is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(test_email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Build variables — merge order data if order_id provided
    let variables = { ...sample_data };

    if (order_id) {
      const template = await getTemplate(tenantDb, templateId);
      const trigger = template?.trigger as string;

      if (trigger && ORDER_TRIGGERS.has(trigger)) {
        const orderVars = await buildOrderTestVariables(
          tenantDb,
          trigger as NotificationTrigger,
          order_id
        );

        if (!orderVars) {
          return NextResponse.json(
            { error: `Order not found: ${order_id}` },
            { status: 404 }
          );
        }

        // Order data as base, manual sample_data overrides on top
        variables = { ...orderVars, ...sample_data };
      }
    }

    // Generate preview with header/footer
    const preview = await previewTemplate(tenantDb, templateId, variables);

    if (!preview) {
      return NextResponse.json(
        { error: "Template not found or email channel not configured" },
        { status: 404 }
      );
    }

    // Send test email
    const result = await sendEmail({
      to: test_email,
      subject: `[TEST] ${preview.subject}`,
      html: preview.html,
      text: preview.subject,
      immediate: true,
      tags: ["test", "template", templateId],
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send test email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${test_email}`,
    });
  } catch (error) {
    console.error("Error sending template test:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send test email" },
      { status: 500 }
    );
  }
}
