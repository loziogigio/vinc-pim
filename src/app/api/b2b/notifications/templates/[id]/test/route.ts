/**
 * Template Test API
 *
 * POST /api/b2b/notifications/templates/[id]/test - Send test email for a template
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { sendEmail } from "@/lib/email";
import { previewTemplate } from "@/lib/notifications/template.service";

interface TestPayload {
  test_email: string;
  sample_data?: Record<string, string>;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: templateId } = await params;
    const tenantDb = `vinc-${session.tenantId}`;
    const body: TestPayload = await req.json();

    const { test_email, sample_data = {} } = body;

    // Validate email
    if (!test_email) {
      return NextResponse.json({ error: "Test email address is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(test_email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Generate preview with header/footer
    const preview = await previewTemplate(tenantDb, templateId, sample_data);

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
