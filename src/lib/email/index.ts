/**
 * Email Service
 * Supports both queued (default) and immediate sending
 * Includes open and click tracking
 */

import nodemailer from "nodemailer";
import { Queue } from "bullmq";
import { nanoid } from "nanoid";
import type { IEmailLog, EmailStatus } from "@/lib/db/models/email-log";
import { EmailLogSchema } from "@/lib/db/models/email-log";
import { connectWithModels, connectToDatabase } from "@/lib/db/connection";
import { connectToAdminDatabase } from "@/lib/db/admin-connection";
import { createNotificationLog, markLogAsSent, markLogAsFailed } from "@/lib/notifications/notification-log.service";

// ============================================
// CONFIGURATION
// ============================================

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  fromName: string;
}

// Cached config from database
let cachedDbConfig: EmailConfig | null = null;
let configLastFetched: number = 0;
const CONFIG_CACHE_TTL = 60000; // 1 minute

/**
 * Get email config from environment variables (fallback)
 */
export function getEmailConfigFromEnv(): EmailConfig {
  return {
    host: process.env.MAIL_HOST || "smtp.hostinger.com",
    port: parseInt(process.env.MAIL_PORT || "587", 10),
    secure: process.env.MAIL_SECURE === "true",
    user: process.env.MAIL_USER || "",
    password: process.env.MAIL_PASSWORD || "",
    from: process.env.MAIL_FROM || "",
    fromName: process.env.MAIL_FROM_NAME || "VINC Commerce",
  };
}

/**
 * Get email config - prefers database settings, falls back to env
 */
export function getEmailConfig(): EmailConfig {
  // Return cached config if fresh
  if (cachedDbConfig && Date.now() - configLastFetched < CONFIG_CACHE_TTL) {
    return cachedDbConfig;
  }
  // Return env config synchronously
  return getEmailConfigFromEnv();
}

/**
 * Fetch email config from database (async)
 */
export async function fetchEmailConfigFromDb(tenantDb?: string): Promise<EmailConfig> {
  try {
    // Dynamic import to avoid circular dependencies
    const { getHomeSettings } = await import("@/lib/db/home-settings");
    const settings = await getHomeSettings(tenantDb);

    if (settings?.smtp_settings?.host && settings?.smtp_settings?.from) {
      cachedDbConfig = {
        host: settings.smtp_settings.host,
        port: settings.smtp_settings.port || 587,
        secure: settings.smtp_settings.secure || false,
        user: settings.smtp_settings.user || "",
        password: settings.smtp_settings.password || "",
        from: settings.smtp_settings.from,
        fromName: settings.smtp_settings.from_name || "VINC Commerce",
      };
      configLastFetched = Date.now();
      return cachedDbConfig;
    }
  } catch (error) {
    console.warn("[Email] Failed to fetch SMTP config from DB:", error);
  }

  return getEmailConfigFromEnv();
}

export function isEmailEnabled(): boolean {
  const config = getEmailConfig();
  const isLocalhost = config.host === "localhost" || config.host === "127.0.0.1";
  const hasAuth = config.user && config.password;
  return !!(config.host && config.from && (hasAuth || isLocalhost));
}

export async function isEmailEnabledAsync(tenantDb?: string): Promise<boolean> {
  const config = await fetchEmailConfigFromDb(tenantDb);
  const isLocalhost = config.host === "localhost" || config.host === "127.0.0.1";
  const hasAuth = config.user && config.password;
  return !!(config.host && config.from && (hasAuth || isLocalhost));
}

// ============================================
// DATABASE HELPERS
// ============================================

/**
 * Get the tenant database name from auto-detection
 * Uses connectToDatabase's auto-detection logic and extracts dbName
 */
async function getTenantDbName(): Promise<string> {
  // Use connectToDatabase for auto-detection, it returns the connection with db info
  const conn = await connectToDatabase();
  // Extract database name from the connection
  const dbName = conn.connection.db?.databaseName;
  if (!dbName) {
    throw new Error("Could not determine tenant database name");
  }
  return dbName;
}

/**
 * Get EmailLog model for a specific tenant database
 */
async function getEmailLogModelForDb(tenantDb: string) {
  const { EmailLog } = await connectWithModels(tenantDb);
  return EmailLog;
}

/**
 * Get EmailLog model for the current tenant (auto-detect)
 */
async function getEmailLogModel() {
  const dbName = await getTenantDbName();
  return getEmailLogModelForDb(dbName);
}

/**
 * Get EmailLog model from admin database (for tracking without tenant context)
 * Email logs are stored centrally in vinc-admin for cross-tenant tracking
 */
async function getAdminEmailLogModel() {
  const adminConn = await connectToAdminDatabase();
  // Return existing model if already registered on this connection
  if (adminConn.models.EmailLog) {
    return adminConn.models.EmailLog;
  }
  // Register the model on the admin connection
  return adminConn.model("EmailLog", EmailLogSchema);
}

// ============================================
// TRANSPORTER
// ============================================

let transporter: nodemailer.Transporter | null = null;
let transporterConfigHash: string = "";

function getConfigHash(config: EmailConfig): string {
  return `${config.host}:${config.port}:${config.user}`;
}

function getTransporter(config: EmailConfig): nodemailer.Transporter {
  const hash = getConfigHash(config);

  // Recreate transporter if config changed
  if (!transporter || transporterConfigHash !== hash) {
    // Build transport options - skip auth for localhost without credentials
    const transportOptions: nodemailer.TransportOptions = {
      host: config.host,
      port: config.port,
      secure: config.secure,
    } as nodemailer.TransportOptions;

    // Only add auth if credentials are provided
    if (config.user && config.password) {
      (transportOptions as { auth?: { user: string; pass: string } }).auth = {
        user: config.user,
        pass: config.password,
      };
    }

    transporter = nodemailer.createTransport(transportOptions);
    transporterConfigHash = hash;
  }
  return transporter;
}

// ============================================
// EMAIL QUEUE
// ============================================

let emailQueue: Queue | null = null;

function getEmailQueue(): Queue {
  if (!emailQueue) {
    const redisHost = process.env.REDIS_HOST || "localhost";
    const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);

    emailQueue = new Queue("email", {
      connection: {
        host: redisHost,
        port: redisPort,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return emailQueue;
}

// ============================================
// EMAIL TYPES
// ============================================

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  from?: string;
  fromName?: string;
  /** Reply-To address */
  replyTo?: string;
  /** Send immediately instead of queuing (default: false) */
  immediate?: boolean;
  /** Enable open/click tracking (default: true) */
  tracking?: boolean;
  /** Priority: higher = processed first (default: 0) */
  priority?: number;
  /** Schedule send for a specific time */
  scheduledAt?: Date;
  /** Custom tags for filtering/grouping */
  tags?: string[];
  /** Custom metadata */
  metadata?: Record<string, any>;
  /** Tenant database name for multi-tenant support (e.g., 'vinc-hidros-it') */
  tenantDb?: string;
  /** Campaign ID for linking email to campaign stats */
  campaign_id?: string;
  /** File attachments (e.g., PDF documents) */
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface SendEmailResult {
  success: boolean;
  emailId: string;
  status: EmailStatus;
  messageId?: string;
  error?: string;
}

// ============================================
// TRACKING HELPERS
// ============================================

/**
 * Generate tracking pixel HTML
 */
export function getTrackingPixel(emailId: string, baseUrl: string): string {
  const trackUrl = `${baseUrl}/api/email/track/open/${emailId}`;
  return `<img src="${trackUrl}" width="1" height="1" style="display:none" alt="" />`;
}

/**
 * Wrap links in HTML for click tracking
 */
export function wrapLinksForTracking(
  html: string,
  emailId: string,
  baseUrl: string
): string {
  // Match href="..." or href='...'
  const linkRegex = /href=["']([^"']+)["']/gi;

  return html.replace(linkRegex, (match, url) => {
    // Skip tracking/unsubscribe links and anchors
    if (url.startsWith("#") || url.includes("/track/") || url.includes("/unsubscribe")) {
      return match;
    }

    const encodedUrl = encodeURIComponent(url);
    const trackUrl = `${baseUrl}/api/email/track/click/${emailId}?url=${encodedUrl}`;
    return `href="${trackUrl}"`;
  });
}

/**
 * Add tracking to email HTML
 */
export function addTrackingToHtml(
  html: string,
  emailId: string,
  baseUrl?: string
): string {
  const trackingBaseUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

  // Add tracking pixel before </body> or at the end
  let trackedHtml = html;
  const pixel = getTrackingPixel(emailId, trackingBaseUrl);

  if (trackedHtml.includes("</body>")) {
    trackedHtml = trackedHtml.replace("</body>", `${pixel}</body>`);
  } else {
    trackedHtml += pixel;
  }

  // Wrap links for click tracking
  trackedHtml = wrapLinksForTracking(trackedHtml, emailId, trackingBaseUrl);

  return trackedHtml;
}

// ============================================
// MAIN SEND FUNCTIONS
// ============================================

/**
 * Send an email - queued by default, or immediately if specified
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const emailId = nanoid(12);

  // Fetch config from DB (with fallback to env)
  const config = await fetchEmailConfigFromDb(options.tenantDb);

  // Check if email is configured - allow localhost without auth for dev testing
  const isLocalhost = config.host === "localhost" || config.host === "127.0.0.1";
  const hasAuth = config.user && config.password;
  const isConfigured = config.host && config.from && (hasAuth || isLocalhost);

  if (!isConfigured) {
    console.warn("[Email] Email sending is not configured");
    return {
      success: false,
      emailId,
      status: "failed",
      error: "Email service not configured",
    };
  }

  // Get tenant database name for queue processing
  // Use provided tenantDb or try to auto-detect
  let tenantDb: string;
  if (options.tenantDb) {
    tenantDb = options.tenantDb;
  } else {
    try {
      tenantDb = await getTenantDbName();
    } catch {
      console.warn("[Email] Could not auto-detect tenant, using default");
      tenantDb = "vinc-default";
    }
  }

  // Get EmailLog model from admin database (centralized for tracking)
  const EmailLogModel = await getAdminEmailLogModel();

  // Prepare HTML with tracking if enabled
  let html = options.html;
  const trackingEnabled = options.tracking !== false;

  if (html && trackingEnabled) {
    html = addTrackingToHtml(html, emailId);
  }

  // Create email log entry with tenant info
  const emailLog = await EmailLogModel.create({
    email_id: emailId,
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    from: options.from || config.from,
    from_name: options.fromName || config.fromName,
    reply_to: options.replyTo,
    subject: options.subject,
    html,
    text: options.text,
    status: options.immediate ? "sending" : "queued",
    tracking_enabled: trackingEnabled,
    priority: options.priority || 0,
    scheduled_at: options.scheduledAt,
    tags: options.tags,
    metadata: options.metadata,
    tenant_db: tenantDb,
    campaign_id: options.campaign_id,
  });

  // Create unified notification log for analytics
  const recipient = Array.isArray(options.to) ? options.to[0] : options.to;
  const notificationLog = await createNotificationLog({
    channel: "email",
    source: options.campaign_id ? "campaign" : "trigger",
    campaign_id: options.campaign_id,
    trigger: options.tags?.[0], // Use first tag as trigger if available
    tenant_db: tenantDb,
    recipient,
    title: options.subject,
    body: options.text || "",
    status: options.immediate ? "sending" : "queued",
  });

  // Store notification log ID on email log for cross-reference
  emailLog.metadata = {
    ...emailLog.metadata,
    notification_log_id: notificationLog.log_id,
  };
  await emailLog.save();

  // Attach files to the email log object (transient, not persisted)
  if (options.attachments?.length) {
    (emailLog as any)._attachments = options.attachments;
  }

  // Send immediately or queue
  if (options.immediate) {
    return await sendEmailNow(emailLog, notificationLog.log_id);
  } else {
    return await queueEmail(emailLog, options.scheduledAt, tenantDb, notificationLog.log_id);
  }
}

/**
 * Send email immediately (bypasses queue)
 */
async function sendEmailNow(
  emailLog: IEmailLog,
  notificationLogId?: string
): Promise<SendEmailResult> {
  // Use tenant_db from emailLog if available for multi-tenant SMTP config
  const config = await fetchEmailConfigFromDb(emailLog.tenant_db);

  try {
    const transport = getTransporter(config);

    const result = await transport.sendMail({
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
      attachments: (emailLog as any)._attachments || undefined,
    });

    // Update log with success
    emailLog.status = "sent";
    emailLog.message_id = result.messageId;
    emailLog.sent_at = new Date();
    emailLog.attempts = (emailLog.attempts || 0) + 1;
    await emailLog.save();

    // Update unified notification log
    if (notificationLogId) {
      await markLogAsSent(notificationLogId);
    }

    console.log(`[Email] Sent immediately: ${emailLog.email_id} to ${emailLog.to}`);

    return {
      success: true,
      emailId: emailLog.email_id,
      status: "sent",
      messageId: result.messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    emailLog.status = "failed";
    emailLog.error = errorMessage;
    emailLog.attempts = (emailLog.attempts || 0) + 1;
    await emailLog.save();

    // Update unified notification log
    if (notificationLogId) {
      await markLogAsFailed(notificationLogId, errorMessage);
    }

    console.error(`[Email] Send failed: ${emailLog.email_id}`, errorMessage);

    return {
      success: false,
      emailId: emailLog.email_id,
      status: "failed",
      error: errorMessage,
    };
  }
}

/**
 * Add email to queue for background processing
 */
async function queueEmail(
  emailLog: IEmailLog,
  scheduledAt?: Date,
  tenantDb?: string,
  notificationLogId?: string
): Promise<SendEmailResult> {
  try {
    const queue = getEmailQueue();

    const delay = scheduledAt ? scheduledAt.getTime() - Date.now() : 0;

    await queue.add(
      "send-email",
      { emailId: emailLog.email_id, tenantDb, notificationLogId },
      {
        priority: emailLog.priority || 0,
        delay: Math.max(0, delay),
        jobId: emailLog.email_id,
      }
    );

    console.log(
      `[Email] Queued: ${emailLog.email_id} to ${emailLog.to} (tenant: ${tenantDb})`,
      scheduledAt ? `(scheduled for ${scheduledAt.toISOString()})` : ""
    );

    return {
      success: true,
      emailId: emailLog.email_id,
      status: "queued",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    emailLog.status = "failed";
    emailLog.error = `Queue error: ${errorMessage}`;
    await emailLog.save();

    // Update unified notification log on queue failure
    if (notificationLogId) {
      await markLogAsFailed(notificationLogId, `Queue error: ${errorMessage}`);
    }

    console.error(`[Email] Queue failed: ${emailLog.email_id}`, errorMessage);

    return {
      success: false,
      emailId: emailLog.email_id,
      status: "failed",
      error: errorMessage,
    };
  }
}

/**
 * Process a queued email (called by worker)
 * @param emailId - The email ID to process
 * @param tenantDb - The tenant database name (optional, used for SMTP config fallback)
 * @param notificationLogId - The notification log ID for unified tracking
 */
export async function processQueuedEmail(
  emailId: string,
  tenantDb?: string,
  notificationLogId?: string
): Promise<SendEmailResult> {
  // Email logs are stored centrally in admin database
  const EmailLogModel = await getAdminEmailLogModel();

  const emailLog = await EmailLogModel.findOne({ email_id: emailId });
  if (!emailLog) {
    return {
      success: false,
      emailId,
      status: "failed",
      error: "Email not found",
    };
  }

  // Get notification log ID from metadata if not provided
  const logId = notificationLogId || (emailLog.metadata as { notification_log_id?: string })?.notification_log_id;

  emailLog.status = "sending";
  await emailLog.save();

  return await sendEmailNow(emailLog as IEmailLog, logId);
}

// ============================================
// TRACKING FUNCTIONS
// ============================================

/**
 * Record email open event
 * Uses admin database for tracking (works without tenant context)
 */
export async function recordEmailOpen(
  emailId: string,
  ip?: string,
  userAgent?: string
): Promise<boolean> {
  const EmailLogModel = await getAdminEmailLogModel();
  const { recordEngagement } = await import("@/lib/notifications/notification-log.service");

  const now = new Date();
  const result = await EmailLogModel.updateOne(
    { email_id: emailId, tracking_enabled: true },
    {
      $push: {
        opens: {
          opened_at: now,
          ip,
          user_agent: userAgent,
        },
      },
      $inc: { open_count: 1 },
      $set: { last_opened_at: now },
      $min: { first_opened_at: now },
    }
  );

  // Also record in unified notification log
  if (result.modifiedCount > 0) {
    const emailLog = await EmailLogModel.findOne({ email_id: emailId });
    const notificationLogId = (emailLog?.metadata as { notification_log_id?: string })?.notification_log_id;
    if (notificationLogId) {
      await recordEngagement({
        log_id: notificationLogId,
        event_type: "opened",
        metadata: { ip, user_agent: userAgent },
      });
    }
  }

  return result.modifiedCount > 0;
}

/**
 * Record email click event
 * Uses admin database for tracking (works without tenant context)
 */
export async function recordEmailClick(
  emailId: string,
  url: string,
  ip?: string,
  userAgent?: string
): Promise<boolean> {
  const EmailLogModel = await getAdminEmailLogModel();
  const { recordEngagement } = await import("@/lib/notifications/notification-log.service");

  const result = await EmailLogModel.updateOne(
    { email_id: emailId, tracking_enabled: true },
    {
      $push: {
        clicks: {
          url,
          clicked_at: new Date(),
          ip,
          user_agent: userAgent,
        },
      },
      $inc: { click_count: 1 },
    }
  );

  // Also record in unified notification log
  if (result.modifiedCount > 0) {
    const emailLog = await EmailLogModel.findOne({ email_id: emailId });
    const notificationLogId = (emailLog?.metadata as { notification_log_id?: string })?.notification_log_id;
    if (notificationLogId) {
      await recordEngagement({
        log_id: notificationLogId,
        event_type: "clicked",
        metadata: { url, ip, user_agent: userAgent },
      });
    }
  }

  return result.modifiedCount > 0;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get email log by ID
 * Uses admin database (centralized email logs)
 */
export async function getEmailLog(emailId: string): Promise<IEmailLog | null> {
  const EmailLogModel = await getAdminEmailLogModel();
  return EmailLogModel.findOne({ email_id: emailId }) as Promise<IEmailLog | null>;
}

/**
 * Get email stats
 * Uses admin database (centralized email logs)
 * Can filter by tenant_db for tenant-specific stats
 */
export async function getEmailStats(filter?: {
  from?: Date;
  to?: Date;
  tags?: string[];
  tenantDb?: string;
}): Promise<{
  total: number;
  sent: number;
  failed: number;
  queued: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
}> {
  const EmailLogModel = await getAdminEmailLogModel();

  const query: Record<string, any> = {};

  // Filter by tenant if specified
  if (filter?.tenantDb) {
    query.tenant_db = filter.tenantDb;
  }

  if (filter?.from || filter?.to) {
    query.created_at = {};
    if (filter.from) query.created_at.$gte = filter.from;
    if (filter.to) query.created_at.$lte = filter.to;
  }

  if (filter?.tags?.length) {
    query.tags = { $in: filter.tags };
  }

  const [stats] = await EmailLogModel.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        sent: { $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
        queued: { $sum: { $cond: [{ $eq: ["$status", "queued"] }, 1, 0] } },
        opened: { $sum: { $cond: [{ $gt: ["$open_count", 0] }, 1, 0] } },
        clicked: { $sum: { $cond: [{ $gt: ["$click_count", 0] }, 1, 0] } },
      },
    },
  ]);

  if (!stats) {
    return {
      total: 0,
      sent: 0,
      failed: 0,
      queued: 0,
      opened: 0,
      clicked: 0,
      openRate: 0,
      clickRate: 0,
    };
  }

  return {
    total: stats.total,
    sent: stats.sent,
    failed: stats.failed,
    queued: stats.queued,
    opened: stats.opened,
    clicked: stats.clicked,
    openRate: stats.sent > 0 ? (stats.opened / stats.sent) * 100 : 0,
    clickRate: stats.sent > 0 ? (stats.clicked / stats.sent) * 100 : 0,
  };
}
