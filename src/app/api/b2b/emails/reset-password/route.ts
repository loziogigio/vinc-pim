/**
 * B2B Reset Password Confirmation Email API
 * POST /api/b2b/emails/reset-password
 *
 * Sends confirmation email after password has been successfully reset (S2S)
 */

import { NextRequest, NextResponse } from "next/server";
import { sendResetPasswordEmail } from "@/lib/email/b2b-emails";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      toEmail,
      email,
      ragioneSociale,
      contactName,
      resetAt,
      ipAddress,
      userAgent,
      loginUrl,
      supportEmail
    } = body;

    // Validate required fields
    if (!toEmail || !email) {
      return NextResponse.json(
        { error: "Missing required fields: toEmail, email" },
        { status: 400 }
      );
    }

    const result = await sendResetPasswordEmail(
      {
        email,
        ragioneSociale,
        contactName,
        resetAt: resetAt ? new Date(resetAt) : new Date(),
        ipAddress,
        userAgent
      },
      toEmail,
      loginUrl,
      { supportEmail }
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: `Reset password confirmation email sent to ${toEmail}`
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[api/b2b/emails/reset-password] Error:", error);
    return NextResponse.json(
      { error: "Failed to send email", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
