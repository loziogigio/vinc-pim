/**
 * B2B Registration Request Email API
 * POST /api/b2b/emails/registration-request
 *
 * Sends registration request notification to admin (S2S)
 */

import { NextRequest, NextResponse } from "next/server";
import { sendRegistrationRequestEmail } from "@/lib/email/b2b-emails";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      adminEmail,
      ragioneSociale,
      email,
      comune,
      indirizzo,
      telefono,
      partitaIva,
      sdi,
      pec,
      adminUrl
    } = body;

    // Validate required fields (adminEmail is optional - falls back to SMTP default_to)
    if (!ragioneSociale || !email) {
      return NextResponse.json(
        { error: "Missing required fields: ragioneSociale, email" },
        { status: 400 }
      );
    }

    const result = await sendRegistrationRequestEmail(
      {
        ragioneSociale,
        email,
        comune,
        indirizzo,
        telefono,
        partitaIva,
        sdi,
        pec,
        submittedAt: new Date()
      },
      adminEmail, // Optional - uses SMTP default_to if not provided
      { adminUrl }
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        adminMessageId: result.adminMessageId,
        customerMessageId: result.customerMessageId,
        message: `Registration emails sent: admin notification + customer confirmation`
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[api/b2b/emails/registration-request] Error:", error);
    return NextResponse.json(
      { error: "Failed to send email", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
