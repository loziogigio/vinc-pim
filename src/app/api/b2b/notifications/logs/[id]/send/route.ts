/**
 * Send Email Now API
 *
 * POST /api/b2b/notifications/logs/[id]/send - Immediately send a queued/failed email
 *
 * This retries sending an existing email without creating a duplicate log entry.
 * It updates the existing log with the new status and attempt count.
 * Supports both SMTP and Microsoft Graph transports based on tenant config.
 *
 * Config resolution order:
 *   1. emailLog.metadata.transport_config (stored at queue time, avoids stale DB fallback)
 *   2. fetchTenantEmailConfig(tenantDb, emailLog.channel) (channel-aware live re-fetch)
 *
 * Email logs are stored in vinc-admin database for centralized tracking.
 */

import { NextRequest, NextResponse } from "next/server";
import { sendEmailViaSmtp, sendEmailViaGraph } from "vinc-notifications/server";
import { authenticateTenant } from "@/lib/auth/tenant-auth";
import { connectToAdminDatabase } from "@/lib/db/admin-connection";
import { EmailLogSchema } from "@/lib/db/models/email-log";
import {
  fetchTenantEmailConfig,
  toPkgEmailConfig,
  isGraphConfigured,
  getEmailConfigFromEnv,
  type TenantEmailConfig,
} from "@/lib/email";

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

    // Resolve transport config:
    //   1. Prefer transport_config stored in log metadata (set at queue time).
    //   2. Re-fetch by the log's channel (channel-aware) when no stored config.
    const storedConfig = (emailLog.metadata as Record<string, unknown>)?.transport_config as
      | { transport?: string; smtp?: ReturnType<typeof getEmailConfigFromEnv>; graph?: TenantEmailConfig["graph"] }
      | undefined;

    let tenantConfig: TenantEmailConfig;
    if (storedConfig?.transport) {
      tenantConfig = {
        transport: storedConfig.transport as TenantEmailConfig["transport"],
        smtp: storedConfig.smtp ?? getEmailConfigFromEnv(),
        graph: storedConfig.graph,
      };
    } else {
      tenantConfig = await fetchTenantEmailConfig(tenantDb, emailLog.channel ?? "default");
    }

    // Check if email is configured based on transport type
    const isConfigured =
      tenantConfig.transport === "graph"
        ? isGraphConfigured(tenantConfig.graph)
        : (() => {
            const c = tenantConfig.smtp;
            const isLocalhost = c.host === "localhost" || c.host === "127.0.0.1";
            const hasAuth = c.user && c.password;
            return !!(c.host && c.from && (hasAuth || isLocalhost));
          })();

    if (!isConfigured) {
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
      // Build package config + message, then dispatch via the shared package transport.
      // No duplicate nodemailer/Graph code here — the package owns transport logic.
      const pkgCfg = toPkgEmailConfig(tenantConfig);
      const pkgMsg = {
        to: emailLog.to,
        cc: emailLog.cc,
        bcc: emailLog.bcc,
        replyTo: emailLog.reply_to,
        subject: emailLog.subject,
        // emailLog.html may be undefined for text-only emails; package expects string
        html: emailLog.html ?? "",
        text: emailLog.text,
      };

      const result =
        tenantConfig.transport === "graph" && isGraphConfigured(tenantConfig.graph)
          ? await sendEmailViaGraph(pkgCfg, pkgMsg)
          : await sendEmailViaSmtp(pkgCfg, pkgMsg);

      if (!result.ok) {
        throw new Error(result.error || `${tenantConfig.transport} send failed`);
      }

      const messageId = result.providerMessageId;

      // Mark as sent
      emailLog.status = "sent";
      emailLog.sent_at = new Date();
      emailLog.message_id = messageId;
      emailLog.error = undefined;
      await emailLog.save();

      console.log(`[Email] Sent (retry via ${tenantConfig.transport}): ${emailLog.email_id} to ${emailLog.to} (attempt ${emailLog.attempts})`);

      return NextResponse.json({
        success: true,
        message: "Email sent successfully",
        email_id: id,
        attempts: emailLog.attempts,
        message_id: messageId,
      });
    } catch (sendError) {
      // Mark as failed
      const errorMessage = sendError instanceof Error ? sendError.message : "Unknown error";
      emailLog.status = "failed";
      emailLog.error = errorMessage;
      await emailLog.save();

      console.error(`[Email] Send failed (retry via ${tenantConfig.transport}): ${emailLog.email_id} - ${errorMessage} (attempt ${emailLog.attempts})`);

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
