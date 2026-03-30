/**
 * B2B Welcome Email API
 * POST /api/b2b/emails/welcome
 *
 * Sends welcome email with login credentials to new B2B customer.
 * Uses the notification template system for tracking and consistent branding.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { sendWelcomeNotification } from "@/lib/notifications/send.service";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;
    const body = await req.json();
    const {
      toEmail,
      ragioneSociale,
      username,
      password,
      contactName,
      loginUrl,
      channel,
    } = body;

    // Validate required fields
    if (!toEmail || !ragioneSociale || !username || !password) {
      return NextResponse.json(
        { error: "Missing required fields: toEmail, ragioneSociale, username, password" },
        { status: 400 }
      );
    }

    const result = await sendWelcomeNotification(tenantDb, toEmail, {
      customer_name: contactName || ragioneSociale,
      company_name: ragioneSociale,
      username,
      password,
      login_url: loginUrl,
      channel,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: `Welcome email sent to ${toEmail}`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[api/b2b/emails/welcome] Error:", error);
    return NextResponse.json(
      { error: "Failed to send email", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
