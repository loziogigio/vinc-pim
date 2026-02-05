/**
 * Send Email Now API
 *
 * POST /api/b2b/notifications/logs/[id]/send - Immediately send a queued/failed email
 *
 * This retries sending an existing email without creating a duplicate log entry.
 * It updates the existing log with the new status and attempt count.
 *
 * Email logs are stored in vinc-admin database for centralized tracking.
 */

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { authenticateTenant } from "@/lib/auth/tenant-auth";
import { connectToAdminDatabase } from "@/lib/db/admin-connection";
import { EmailLogSchema } from "@/lib/db/models/email-log";
import { fetchEmailConfigFromDb } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateTenant(req);
    if (!auth.authenticated || !auth.tenantDb) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantDb = auth.tenantDb;

    // Email logs are stored in the admin database
    const adminConn = await connectToAdminDatabase();
    const EmailLog = adminConn.models.EmailLog || adminConn.model("EmailLog", EmailLogSchema);

    // Find the email log - verify it belongs to this tenant
    const emailLog = await EmailLog.findOne({ email_id: id, tenant_db: tenantDb });
    if (!emailLog) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Only allow sending for queued or failed emails
    if (!["queued", "failed"].includes(emailLog.status)) {
      return NextResponse.json(
        { error: `Cannot send email with status: ${emailLog.status}` },
        { status: 400 }
      );
    }

    // Check max attempts
    if (emailLog.attempts >= emailLog.max_attempts) {
      return NextResponse.json(
        { error: `Maximum attempts (${emailLog.max_attempts}) reached` },
        { status: 400 }
      );
    }

    // Get email config for this tenant
    const config = await fetchEmailConfigFromDb(tenantDb);
    // Allow localhost without auth for dev testing
    const isLocalhost = config.host === "localhost" || config.host === "127.0.0.1";
    const hasAuth = config.user && config.password;
    if (!(config.host && config.from && (hasAuth || isLocalhost))) {
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    // Mark as sending
    emailLog.status = "sending";
    emailLog.attempts = (emailLog.attempts || 0) + 1;
    await emailLog.save();

    try {
      // Create transporter and send
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.password,
        },
      });

      const result = await transporter.sendMail({
        from: emailLog.from_name
          ? `"${emailLog.from_name}" <${emailLog.from}>`
          : emailLog.from,
        to: Array.isArray(emailLog.to) ? emailLog.to.join(", ") : emailLog.to,
        cc: emailLog.cc
          ? Array.isArray(emailLog.cc)
            ? emailLog.cc.join(", ")
            : emailLog.cc
          : undefined,
        bcc: emailLog.bcc
          ? Array.isArray(emailLog.bcc)
            ? emailLog.bcc.join(", ")
            : emailLog.bcc
          : undefined,
        replyTo: emailLog.reply_to,
        subject: emailLog.subject,
        html: emailLog.html,
        text: emailLog.text,
      });

      // Mark as sent
      emailLog.status = "sent";
      emailLog.sent_at = new Date();
      emailLog.message_id = result.messageId;
      emailLog.error = undefined;
      await emailLog.save();

      console.log(`[Email] Sent (retry): ${emailLog.email_id} to ${emailLog.to} (attempt ${emailLog.attempts})`);

      return NextResponse.json({
        success: true,
        message: "Email sent successfully",
        email_id: id,
        attempts: emailLog.attempts,
        message_id: result.messageId,
      });
    } catch (sendError) {
      // Mark as failed
      const errorMessage = sendError instanceof Error ? sendError.message : "Unknown error";
      emailLog.status = "failed";
      emailLog.error = errorMessage;
      await emailLog.save();

      console.error(`[Email] Send failed (retry): ${emailLog.email_id} - ${errorMessage} (attempt ${emailLog.attempts})`);

      return NextResponse.json(
        { error: errorMessage, attempts: emailLog.attempts },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send email" },
      { status: 500 }
    );
  }
}
