/**
 * Test SMTP Connection API
 * Sends a test email to verify SMTP credentials
 */

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { host, port, secure, user, password, from, from_name, default_to } = body;

    if (!host || !port || !user || !password || !from) {
      return NextResponse.json(
        { error: "Missing required SMTP credentials" },
        { status: 400 }
      );
    }

    // Create transporter with provided credentials
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: secure === true,
      auth: {
        user,
        pass: password,
      },
    });

    // Verify connection
    await transporter.verify();

    // Send test email
    const testRecipient = default_to || from;
    const result = await transporter.sendMail({
      from: from_name ? `"${from_name}" <${from}>` : from,
      to: testRecipient,
      subject: "SMTP Test - Connection Successful",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2 style="color: #009f7f;">SMTP Connection Test Successful!</h2>
          <p>Your SMTP settings are configured correctly.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 14px;">
            <strong>Server:</strong> ${host}:${port}<br>
            <strong>From:</strong> ${from_name ? `${from_name} <${from}>` : from}<br>
            <strong>Secure:</strong> ${secure ? 'Yes (TLS)' : 'No'}
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            This is an automated test email from VINC Commerce Suite.
          </p>
        </div>
      `,
      text: `SMTP Connection Test Successful!\n\nYour SMTP settings are configured correctly.\n\nServer: ${host}:${port}\nFrom: ${from}\nSecure: ${secure ? 'Yes' : 'No'}`,
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent successfully to ${testRecipient}`,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("[Test SMTP] Error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "SMTP connection failed",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
