/**
 * Test Graph API Connection
 * Sends a test email to verify Microsoft Graph credentials
 */

import { NextRequest, NextResponse } from "next/server";
import { sendViaGraph, getGraphToken, clearGraphTokenCache } from "@/lib/email/graph-transport";
import type { GraphSettings } from "@/lib/types/home-settings";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      client_id,
      azure_tenant_id,
      client_secret,
      sender_email,
      sender_name,
      test_recipient,
    } = body;

    if (!client_id || !azure_tenant_id || !client_secret || !sender_email) {
      return NextResponse.json(
        { error: "Missing required Graph settings (client_id, azure_tenant_id, client_secret, sender_email)" },
        { status: 400 }
      );
    }

    const settings: GraphSettings = {
      client_id,
      azure_tenant_id,
      client_secret,
      sender_email,
      sender_name,
      save_to_sent_items: false,
    };

    // Step 1: Test token acquisition (clear cache first)
    clearGraphTokenCache(settings);
    await getGraphToken(settings);

    // Step 2: Send test email
    const recipient = test_recipient || sender_email;
    const result = await sendViaGraph(settings, {
      to: recipient,
      subject: "Graph API Test - Connection Successful",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2 style="color: #009f7f;">Graph API Connection Test Successful!</h2>
          <p>Your Microsoft Graph email settings are configured correctly.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 14px;">
            <strong>Azure Tenant:</strong> ${azure_tenant_id}<br>
            <strong>Client ID:</strong> ${client_id.substring(0, 8)}...<br>
            <strong>Sender:</strong> ${sender_name ? `${sender_name} &lt;${sender_email}&gt;` : sender_email}
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            This is an automated test email from VINC Commerce Suite.
          </p>
        </div>
      `,
      text: `Graph API Connection Test Successful!\n\nAzure Tenant: ${azure_tenant_id}\nSender: ${sender_email}`,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Graph API send failed", details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent successfully to ${recipient} via Graph API`,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("[Test Graph] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Graph API connection failed", details: errorMessage },
      { status: 500 }
    );
  }
}
