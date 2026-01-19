/**
 * Email Service
 * Supports both queued (default) and immediate sending
 * Includes open and click tracking
 */

import nodemailer from "nodemailer";
import { Queue } from "bullmq";
import { nanoid } from "nanoid";
import type { IEmailLog, EmailStatus } from "@/lib/db/models/email-log";
import { connectWithModels, connectToDatabase } from "@/lib/db/connection";

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
export async function fetchEmailConfigFromDb(): Promise<EmailConfig> {
  try {
    // Dynamic import to avoid circular dependencies
    const { getHomeSettings } = await import("@/lib/db/home-settings");
    const settings = await getHomeSettings();

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
  return !!(config.host && config.user && config.password && config.from);
}

export async function isEmailEnabledAsync(): Promise<boolean> {
  const config = await fetchEmailConfigFromDb();
  return !!(config.host && config.user && config.password && config.from);
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
 * Get EmailLog model for the current tenant
 */
async function getEmailLogModel() {
  const dbName = await getTenantDbName();
  const { EmailLog } = await connectWithModels(dbName);
  return EmailLog;
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
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });
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
  const config = await fetchEmailConfigFromDb();

  if (!(config.host && config.user && config.password && config.from)) {
    console.warn("[Email] Email sending is not configured");
    return {
      success: false,
      emailId,
      status: "failed",
      error: "Email service not configured",
    };
  }

  // Get EmailLog model for current tenant
  const EmailLogModel = await getEmailLogModel();

  // Prepare HTML with tracking if enabled
  let html = options.html;
  const trackingEnabled = options.tracking !== false;

  if (html && trackingEnabled) {
    html = addTrackingToHtml(html, emailId);
  }

  // Create email log entry
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
  });

  // Send immediately or queue
  if (options.immediate) {
    return await sendEmailNow(emailLog);
  } else {
    return await queueEmail(emailLog, options.scheduledAt);
  }
}

/**
 * Send email immediately (bypasses queue)
 */
async function sendEmailNow(emailLog: IEmailLog): Promise<SendEmailResult> {
  const config = await fetchEmailConfigFromDb();

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
    });

    // Update log with success
    emailLog.status = "sent";
    emailLog.message_id = result.messageId;
    emailLog.sent_at = new Date();
    emailLog.attempts = (emailLog.attempts || 0) + 1;
    await emailLog.save();

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
  scheduledAt?: Date
): Promise<SendEmailResult> {
  try {
    const queue = getEmailQueue();

    const delay = scheduledAt ? scheduledAt.getTime() - Date.now() : 0;

    await queue.add(
      "send-email",
      { emailId: emailLog.email_id },
      {
        priority: emailLog.priority || 0,
        delay: Math.max(0, delay),
        jobId: emailLog.email_id,
      }
    );

    console.log(
      `[Email] Queued: ${emailLog.email_id} to ${emailLog.to}`,
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
 */
export async function processQueuedEmail(emailId: string): Promise<SendEmailResult> {
  const EmailLogModel = await getEmailLogModel();

  const emailLog = await EmailLogModel.findOne({ email_id: emailId });
  if (!emailLog) {
    return {
      success: false,
      emailId,
      status: "failed",
      error: "Email not found",
    };
  }

  emailLog.status = "sending";
  await emailLog.save();

  return await sendEmailNow(emailLog as IEmailLog);
}

// ============================================
// TRACKING FUNCTIONS
// ============================================

/**
 * Record email open event
 */
export async function recordEmailOpen(
  emailId: string,
  ip?: string,
  userAgent?: string
): Promise<boolean> {
  const EmailLogModel = await getEmailLogModel();

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

  return result.modifiedCount > 0;
}

/**
 * Record email click event
 */
export async function recordEmailClick(
  emailId: string,
  url: string,
  ip?: string,
  userAgent?: string
): Promise<boolean> {
  const EmailLogModel = await getEmailLogModel();

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

  return result.modifiedCount > 0;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get email log by ID
 */
export async function getEmailLog(emailId: string): Promise<IEmailLog | null> {
  const EmailLogModel = await getEmailLogModel();
  return EmailLogModel.findOne({ email_id: emailId }) as Promise<IEmailLog | null>;
}

/**
 * Get email stats
 */
export async function getEmailStats(filter?: {
  from?: Date;
  to?: Date;
  tags?: string[];
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
  const EmailLogModel = await getEmailLogModel();

  const query: Record<string, any> = {};

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
