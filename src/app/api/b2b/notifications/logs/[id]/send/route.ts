/**
 * Send Email Now API
 *
 * POST /api/b2b/notifications/logs/[id]/send - Immediately send a queued/failed email
 *
 * This retries sending an existing email without creating a duplicate log entry.
 * It updates the existing log with the new status and attempt count.
 */

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { authenticateTenant } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
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

    const { EmailLog } = await connectWithModels(tenantDb);

    // Find the email log
    const emailLog = await EmailLog.findOne({ email_id: id });
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

    // Get email config
    const config = await fetchEmailConfigFromDb();
    if (!(config.host && config.user && config.password && config.from)) {
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
