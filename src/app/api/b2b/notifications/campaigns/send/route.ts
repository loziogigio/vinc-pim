/**
 * Campaign Send API
 *
 * POST /api/b2b/notifications/campaigns/send - Send campaign to recipients
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { getTemplate } from "@/lib/notifications/template.service";

export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const body = await req.json();

    const { template_id, channels, recipient_type = "all" } = body;

    if (!template_id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return NextResponse.json({ error: "At least one channel must be selected" }, { status: 400 });
    }

    // Get template
    const template = await getTemplate(tenantDb, template_id);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Get recipients based on type
    const { Customer } = await connectWithModels(tenantDb);
    let recipients;

    switch (recipient_type) {
      case "all":
        recipients = await Customer.find({ status: "active" })
          .select("email company_name")
          .lean();
        break;
      case "selected":
        // TODO: Implement selected customers
        return NextResponse.json(
          { error: "Selected customers feature coming soon" },
          { status: 400 }
        );
      case "segment":
        // TODO: Implement customer segments
        return NextResponse.json(
          { error: "Customer segments feature coming soon" },
          { status: 400 }
        );
      default:
        recipients = [];
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No recipients found" }, { status: 400 });
    }

    // TODO: Queue emails for sending via BullMQ
    // For now, we'll just return the count
    // In production, this would queue jobs for async processing

    return NextResponse.json({
      success: true,
      template_id,
      channels,
      recipient_type,
      recipients_count: recipients.length,
      message: `Campaign queued for ${recipients.length} recipients`,
    });
  } catch (error) {
    console.error("Error sending campaign:", error);
    return NextResponse.json(
      { error: "Failed to send campaign" },
      { status: 500 }
    );
  }
}
