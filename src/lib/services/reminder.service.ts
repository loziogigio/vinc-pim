/**
 * Reminder Service
 *
 * Business logic for back-in-stock reminders.
 * Status lifecycle: active → notified | expired | cancelled
 * Redis caching with 1-hour TTL and targeted invalidation.
 */

import { connectWithModels } from "@/lib/db/model-registry";
import { getRedis } from "@/lib/cache/redis-client";
import { REMINDER_DEFAULTS, REMINDER_CACHE_TTL } from "@/lib/constants/reminder";
import type { ReminderStatus } from "@/lib/constants/reminder";
import type {
  ReminderInput,
  ReminderResponse,
  ReminderStatusResponse,
  ReminderToggleResponse,
  ReminderStatsResponse,
  ReminderSummaryResponse,
} from "@/lib/types/reminder";

// ============================================
// CACHE HELPERS
// ============================================

function statusCacheKey(tenantId: string, userId: string, sku: string) {
  return `reminders:status:${tenantId}:${userId}:${sku}`;
}

function statsCacheKey(tenantId: string, sku: string) {
  return `reminders:stats:${tenantId}:${sku}`;
}

async function invalidateCache(tenantId: string, userId: string, sku: string) {
  const redis = getRedis();
  await redis.del(statusCacheKey(tenantId, userId, sku), statsCacheKey(tenantId, sku));
}

// ============================================
// HELPERS
// ============================================

function toReminderResponse(doc: Record<string, unknown>): ReminderResponse {
  return {
    sku: doc.sku as string,
    user_id: doc.user_id as string,
    status: doc.status as ReminderStatus,
    email: doc.email as string | undefined,
    push_token: doc.push_token as string | undefined,
    expires_at: doc.expires_at ? (doc.expires_at as Date).toISOString() : undefined,
    created_at: (doc.created_at as Date).toISOString(),
  };
}

// ============================================
// CORE OPERATIONS
// ============================================

/**
 * Create a reminder. Reactivates if cancelled/expired for same user+sku.
 */
export async function createReminder(
  tenantDb: string,
  tenantId: string,
  userId: string,
  input: ReminderInput
): Promise<ReminderResponse> {
  const { ProductReminder } = await connectWithModels(tenantDb);

  const expiresInDays = Math.min(
    input.expires_in_days || REMINDER_DEFAULTS.EXPIRES_IN_DAYS,
    REMINDER_DEFAULTS.MAX_EXPIRES_DAYS
  );
  const expiresAt = new Date(Date.now() + expiresInDays * 86400000);

  // Check for existing active reminder
  const existing = await ProductReminder.findOne({
    tenant_id: tenantId,
    user_id: userId,
    sku: input.sku,
    is_active: true,
  }).lean();

  if (existing) {
    return toReminderResponse(existing as Record<string, unknown>);
  }

  // Upsert: reactivate inactive or create new
  const doc = await ProductReminder.findOneAndUpdate(
    { tenant_id: tenantId, user_id: userId, sku: input.sku, is_active: false },
    {
      $set: {
        status: "active",
        is_active: true,
        email: input.email,
        push_token: input.push_token,
        expires_at: expiresAt,
        notified_at: null,
      },
    },
    { new: true }
  ).lean();

  if (doc) {
    await invalidateCache(tenantId, userId, input.sku);
    return toReminderResponse(doc as Record<string, unknown>);
  }

  // Create new
  const created = await ProductReminder.create({
    tenant_id: tenantId,
    user_id: userId,
    sku: input.sku,
    status: "active",
    is_active: true,
    email: input.email,
    push_token: input.push_token,
    expires_at: expiresAt,
  });

  await invalidateCache(tenantId, userId, input.sku);
  return toReminderResponse(created.toObject() as Record<string, unknown>);
}

/**
 * Cancel an active reminder.
 */
export async function cancelReminder(
  tenantDb: string,
  tenantId: string,
  userId: string,
  sku: string
): Promise<boolean> {
  const { ProductReminder } = await connectWithModels(tenantDb);

  const result = await ProductReminder.findOneAndUpdate(
    { tenant_id: tenantId, user_id: userId, sku, is_active: true },
    { $set: { status: "cancelled", is_active: false } }
  );

  if (result) {
    await invalidateCache(tenantId, userId, sku);
  }

  return !!result;
}

/**
 * Toggle reminder: create if not active, cancel if active.
 */
export async function toggleReminder(
  tenantDb: string,
  tenantId: string,
  userId: string,
  input: ReminderInput
): Promise<ReminderToggleResponse> {
  const { ProductReminder } = await connectWithModels(tenantDb);

  const existing = await ProductReminder.findOne({
    tenant_id: tenantId,
    user_id: userId,
    sku: input.sku,
    is_active: true,
  }).lean();

  if (existing) {
    await cancelReminder(tenantDb, tenantId, userId, input.sku);
    return { sku: input.sku, user_id: userId, action: "cancelled", has_active_reminder: false };
  }

  await createReminder(tenantDb, tenantId, userId, input);
  return { sku: input.sku, user_id: userId, action: "created", has_active_reminder: true };
}

// ============================================
// STATUS QUERIES
// ============================================

/**
 * Get reminder status for a single SKU (with Redis cache).
 */
export async function getReminderStatus(
  tenantDb: string,
  tenantId: string,
  userId: string,
  sku: string
): Promise<ReminderStatusResponse> {
  const redis = getRedis();
  const cacheKey = statusCacheKey(tenantId, userId, sku);

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const { ProductReminder } = await connectWithModels(tenantDb);

  const reminder = await ProductReminder.findOne({
    tenant_id: tenantId,
    user_id: userId,
    sku,
    is_active: true,
  }).lean();

  const result: ReminderStatusResponse = {
    sku,
    has_active_reminder: !!reminder,
    status: reminder ? (reminder as { status: ReminderStatus }).status : undefined,
    created_at: reminder ? (reminder as { created_at: Date }).created_at.toISOString() : undefined,
    expires_at: reminder && (reminder as { expires_at?: Date }).expires_at
      ? (reminder as { expires_at: Date }).expires_at.toISOString()
      : undefined,
  };

  await redis.setex(cacheKey, REMINDER_CACHE_TTL, JSON.stringify(result));
  return result;
}

/**
 * Bulk status check for multiple SKUs.
 */
export async function getBulkReminderStatus(
  tenantDb: string,
  tenantId: string,
  userId: string,
  skus: string[]
): Promise<ReminderStatusResponse[]> {
  const { ProductReminder } = await connectWithModels(tenantDb);

  const reminders = await ProductReminder.find({
    tenant_id: tenantId,
    user_id: userId,
    sku: { $in: skus },
    is_active: true,
  }).lean();

  const reminderMap = new Map<string, Record<string, unknown>>();
  for (const r of reminders) {
    const doc = r as Record<string, unknown>;
    reminderMap.set(doc.sku as string, doc);
  }

  return skus.map((sku) => {
    const doc = reminderMap.get(sku);
    return {
      sku,
      has_active_reminder: !!doc,
      status: doc ? (doc.status as ReminderStatus) : undefined,
      created_at: doc ? (doc.created_at as Date).toISOString() : undefined,
      expires_at: doc?.expires_at ? (doc.expires_at as Date).toISOString() : undefined,
    };
  });
}

/**
 * Get current user's reminders, paginated with optional status filter.
 */
export async function getUserReminders(
  tenantDb: string,
  tenantId: string,
  userId: string,
  page: number,
  limit: number,
  statusFilter?: ReminderStatus
): Promise<{ reminders: ReminderResponse[]; total_count: number }> {
  const { ProductReminder } = await connectWithModels(tenantDb);
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = { tenant_id: tenantId, user_id: userId };
  if (statusFilter) {
    query.status = statusFilter;
  }

  const [docs, total_count] = await Promise.all([
    ProductReminder.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    ProductReminder.countDocuments(query),
  ]);

  return {
    reminders: docs.map((d) => toReminderResponse(d as Record<string, unknown>)),
    total_count,
  };
}

/**
 * Get reminder summary for a user (counts by status, via aggregation).
 */
export async function getUserRemindersSummary(
  tenantDb: string,
  tenantId: string,
  userId: string
): Promise<ReminderSummaryResponse> {
  const { ProductReminder } = await connectWithModels(tenantDb);

  const results = await ProductReminder.aggregate([
    { $match: { tenant_id: tenantId, user_id: userId } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of results) {
    counts[r._id] = r.count;
    total += r.count;
  }

  return {
    user_id: userId,
    total_reminders: total,
    active: counts.active || 0,
    notified: counts.notified || 0,
    expired: counts.expired || 0,
    cancelled: counts.cancelled || 0,
  };
}

// ============================================
// ADMIN / STATS
// ============================================

/**
 * Get reminder stats for a product (with Redis cache).
 */
export async function getReminderStats(
  tenantDb: string,
  tenantId: string,
  sku: string
): Promise<ReminderStatsResponse> {
  const redis = getRedis();
  const cacheKey = statsCacheKey(tenantId, sku);

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const { ProductReminder } = await connectWithModels(tenantDb);

  const results = await ProductReminder.aggregate([
    { $match: { tenant_id: tenantId, sku } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of results) {
    counts[r._id] = r.count;
    total += r.count;
  }

  const response: ReminderStatsResponse = {
    sku,
    active_count: counts.active || 0,
    notified_count: counts.notified || 0,
    total_count: total,
  };

  await redis.setex(cacheKey, REMINDER_CACHE_TTL, JSON.stringify(response));
  return response;
}

/**
 * Expire old reminders (batch update where expires_at < now and status = active).
 */
export async function expireOldReminders(
  tenantDb: string,
  tenantId: string
): Promise<number> {
  const { ProductReminder } = await connectWithModels(tenantDb);

  const result = await ProductReminder.updateMany(
    { tenant_id: tenantId, status: "active", expires_at: { $lt: new Date() } },
    { $set: { status: "expired", is_active: false } }
  );

  return result.modifiedCount;
}

/**
 * Hard delete all reminders for a user.
 */
export async function deleteAllUserReminders(
  tenantDb: string,
  tenantId: string,
  userId: string
): Promise<number> {
  const { ProductReminder } = await connectWithModels(tenantDb);

  const result = await ProductReminder.deleteMany({ tenant_id: tenantId, user_id: userId });
  return result.deletedCount;
}
