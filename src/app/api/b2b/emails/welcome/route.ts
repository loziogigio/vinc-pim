/**
 * B2B Welcome Email API
 * POST /api/b2b/emails/welcome
 *
 * Sends welcome email with login credentials to new B2B customer (S2S)
 */

import { NextRequest, NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/email/b2b-emails";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      toEmail,
      ragioneSociale,
      username,
      password,
      contactName,
      loginUrl
    } = body;

    // Validate required fields
    if (!toEmail || !ragioneSociale || !username || !password) {
      return NextResponse.json(
        { error: "Missing required fields: toEmail, ragioneSociale, username, password" },
        { status: 400 }
      );
    }

    const result = await sendWelcomeEmail(
      {
        ragioneSociale,
        username,
        password,
        contactName
      },
      toEmail,
      loginUrl
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: `Welcome email sent to ${toEmail}`
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
