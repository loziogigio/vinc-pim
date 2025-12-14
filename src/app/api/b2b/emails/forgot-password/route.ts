/**
 * B2B Forgot Password Email API
 * POST /api/b2b/emails/forgot-password
 *
 * Sends temporary password to user who requested password reset (S2S)
 */

import { NextRequest, NextResponse } from "next/server";
import { sendForgotPasswordEmail } from "@/lib/email/b2b-emails";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      toEmail,
      email,
      ragioneSociale,
      contactName,
      tempPassword,
      loginUrl
    } = body;

    // Validate required fields
    if (!toEmail || !email || !tempPassword) {
      return NextResponse.json(
        { error: "Missing required fields: toEmail, email, tempPassword" },
        { status: 400 }
      );
    }

    const result = await sendForgotPasswordEmail(
      {
        email,
        ragioneSociale,
        contactName,
        tempPassword
      },
      toEmail,
      loginUrl
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: `Forgot password email sent to ${toEmail}`
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[api/b2b/emails/forgot-password] Error:", error);
    return NextResponse.json(
      { error: "Failed to send email", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
