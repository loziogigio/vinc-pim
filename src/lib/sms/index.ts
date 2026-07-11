/**
 * SMS Service
 * Supports both queued (default) and immediate sending.
 * Mirrors the email service pattern: producer + BullMQ queue.
 */

import { createSmsSender } from "vinc-notifications/server";
import type { SmsConfig } from "vinc-notifications";
import { resolveNotificationConfig } from "@/lib/notifications/resolve-config";
import { connectWithModels } from "@/lib/db/connection";
import type { ISmsLog } from "@/lib/db/models/sms-log";

// ============================================
// TYPES
// ============================================

export interface SendSmsOptions {
  /** Recipient phone number in E.164 format (e.g. "+39333...") */
  to: string;
  /** Plain text body */
  body: string;
  /** Tenant database name (e.g. "vinc-hidros-it") */
  tenantDb: string;
  /** Sales-channel code for per-channel config resolution (default: "default") */
  channel?: string;
  /** Send immediately instead of queuing (default: false) */
  immediate?: boolean;
  /** Schedule send for a specific time */
  scheduledAt?: Date;
}

export interface SendSmsResult {
  ok: boolean;
  logId?: string;
  error?: string;
}

// ============================================
// QUEUE HELPER (lazy to avoid circular deps / module-level side effects)
// ============================================

async function getSmsQueue() {
  const { smsQueue } = await import("@/lib/queue/queues");
  return smsQueue;
}

// ============================================
// IMMEDIATE SEND (bypasses queue)
// ============================================

/**
 * Send an SMS message immediately (bypasses queue).
 * Resolves per-channel SMS config, creates a SmsLog, calls the provider, updates status.
 */
export async function sendSmsNow(options: SendSmsOptions): Promise<SendSmsResult> {
  const cfg = await resolveNotificationConfig(options.tenantDb, options.channel ?? "default");

  if (!cfg.sms?.enabled) {
    return { ok: false, error: "SMS disabled for channel" };
  }

  const { SmsLog } = await connectWithModels(options.tenantDb);

  const log = await SmsLog.create({
    to: options.to,
    body: options.body,
    channel: options.channel ?? "default",
    status: "sending",
    tenant_db: options.tenantDb,
    scheduled_at: options.scheduledAt,
  }) as ISmsLog;

  try {
    const sender = createSmsSender(cfg.sms as SmsConfig);
    const result = await sender.send({ to: options.to, body: options.body });

    log.status = result.ok ? "sent" : "failed";
    if (result.providerMessageId) log.message_id = result.providerMessageId;
    if (result.error) log.error = result.error;
    if (result.ok) log.sent_at = new Date();
    log.attempts = (log.attempts ?? 0) + 1;
    await log.save();

    return { ok: result.ok, logId: String(log._id), error: result.error };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    log.status = "failed";
    log.error = errorMessage;
    log.attempts = (log.attempts ?? 0) + 1;
    await log.save();
    return { ok: false, logId: String(log._id), error: errorMessage };
  }
}

// ============================================
// QUEUED SEND
// ============================================

/**
 * Enqueue an SMS for background processing.
 * Creates a pending SmsLog, then adds a job to the "sms" BullMQ queue.
 * Returns early (no log, no enqueue) when SMS is disabled for the channel.
 */
export async function queueSms(options: SendSmsOptions): Promise<SendSmsResult> {
  // Resolve config first — skip entirely when SMS is disabled (mirrors sendSmsNow guard)
  const cfg = await resolveNotificationConfig(options.tenantDb, options.channel ?? "default");

  if (!cfg.sms?.enabled) {
    return { ok: false, error: "SMS disabled for channel" };
  }

  const { SmsLog } = await connectWithModels(options.tenantDb);

  const log = await SmsLog.create({
    to: options.to,
    body: options.body,
    channel: options.channel ?? "default",
    status: "queued",
    tenant_db: options.tenantDb,
    scheduled_at: options.scheduledAt,
  }) as ISmsLog;

  try {
    const queue = await getSmsQueue();
    const delay = options.scheduledAt
      ? Math.max(0, options.scheduledAt.getTime() - Date.now())
      : 0;

    await queue.add(
      "send-sms",
      { smsLogId: String(log._id), tenantDb: options.tenantDb },
      { delay, jobId: String(log._id) }
    );

    console.log(`[SMS] Queued: ${log._id} to ${options.to} (tenant: ${options.tenantDb})`);
    return { ok: true, logId: String(log._id) };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    log.status = "failed";
    log.error = `Queue error: ${errorMessage}`;
    await log.save();
    return { ok: false, logId: String(log._id), error: errorMessage };
  }
}

// ============================================
// UNIFIED ENTRY POINT
// ============================================

/**
 * Send an SMS — queued by default, or immediately if `options.immediate` is set.
 */
export async function sendSms(options: SendSmsOptions): Promise<SendSmsResult> {
  if (options.immediate) return sendSmsNow(options);
  return queueSms(options);
}

// ============================================
// WORKER-FACING PROCESSOR
// ============================================

/**
 * Process a queued SMS log entry (called by the sms worker).
 */
export async function processQueuedSms(
  smsLogId: string,
  tenantDb: string,
): Promise<SendSmsResult> {
  const { SmsLog } = await connectWithModels(tenantDb);

  const log = await SmsLog.findById(smsLogId) as ISmsLog | null;
  if (!log) {
    return { ok: false, error: `SmsLog ${smsLogId} not found` };
  }

  const cfg = await resolveNotificationConfig(tenantDb, log.channel ?? "default");

  if (!cfg.sms?.enabled) {
    log.status = "failed";
    log.error = "SMS disabled for channel";
    await log.save();
    return { ok: false, error: "SMS disabled for channel" };
  }

  log.status = "sending";
  await log.save();

  try {
    const sender = createSmsSender(cfg.sms as SmsConfig);
    const result = await sender.send({ to: log.to, body: log.body });

    log.status = result.ok ? "sent" : "failed";
    if (result.providerMessageId) log.message_id = result.providerMessageId;
    if (result.error) log.error = result.error;
    if (result.ok) log.sent_at = new Date();
    log.attempts = (log.attempts ?? 0) + 1;
    await log.save();

    return { ok: result.ok, logId: String(log._id), error: result.error };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    log.status = "failed";
    log.error = errorMessage;
    log.attempts = (log.attempts ?? 0) + 1;
    await log.save();
    return { ok: false, logId: String(log._id), error: errorMessage };
  }
}
