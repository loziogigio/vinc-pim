/**
 * Test B2B Email Templates API
 * POST /api/b2b/test-emails
 *
 * Triggers all B2B email templates for testing
 */

import { NextRequest, NextResponse } from "next/server";
import {
  sendRegistrationRequestEmail,
  sendWelcomeEmail,
  sendForgotPasswordEmail,
  sendResetPasswordEmail
} from "@/lib/email/b2b-emails";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testEmail, template } = body;

    if (!testEmail) {
      return NextResponse.json(
        { error: "testEmail is required" },
        { status: 400 }
      );
    }

    const results: Record<string, { success: boolean; error?: string }> = {};

    // 1. Registration Request Email (uses shopUrl from branding)
    if (!template || template === "registration_request") {
      const regResult = await sendRegistrationRequestEmail(
        {
          ragioneSociale: "Acme Idraulica Srl",
          email: testEmail,
          comune: "Milano",
          indirizzo: "Via Roma 123",
          telefono: "+39 02 1234567",
          partitaIva: "IT12345678901",
          sdi: "XXXXXXX",
          submittedAt: new Date()
        },
        testEmail
      );
      results.registration_request = regResult;
    }

    // 2. Welcome Email (uses shopUrl from branding)
    if (!template || template === "welcome") {
      const welcomeResult = await sendWelcomeEmail(
        {
          ragioneSociale: "Acme Idraulica Srl",
          username: testEmail,
          password: "TempPass123!",
          contactName: "Mario Rossi"
        },
        testEmail
      );
      results.welcome = welcomeResult;
    }

    // 3. Forgot Password Email (uses shopUrl from branding)
    if (!template || template === "forgot_password") {
      const forgotResult = await sendForgotPasswordEmail(
        {
          email: testEmail,
          ragioneSociale: "Acme Idraulica Srl",
          contactName: "Mario Rossi",
          tempPassword: "TempPass456!"
        },
        testEmail
      );
      results.forgot_password = forgotResult;
    }

    // 4. Reset Password Confirmation Email (uses shopUrl from branding)
    if (!template || template === "reset_password") {
      const resetResult = await sendResetPasswordEmail(
        {
          email: testEmail,
          ragioneSociale: "Acme Idraulica Srl",
          contactName: "Mario Rossi",
          resetAt: new Date(),
          ipAddress: "192.168.1.100"
        },
        testEmail
      );
      results.reset_password = resetResult;
    }

    const allSuccess = Object.values(results).every(r => r.success);

    return NextResponse.json({
      success: allSuccess,
      results,
      message: allSuccess
        ? `All ${Object.keys(results).length} test emails sent successfully to ${testEmail}`
        : "Some emails failed to send"
    });

  } catch (error) {
    console.error("[test-emails] Error:", error);
    return NextResponse.json(
      { error: "Failed to send test emails", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
