/**
 * FCM Token Cleanup Service
 *
 * Implements state-of-the-art token management best practices:
 * 1. Immediate deletion of permanently invalid tokens
 * 2. Periodic cleanup of stale/inactive tokens
 * 3. Deduplication of tokens per device
 * 4. Orphan token cleanup (deleted users)
 *
 * Best Practices Reference:
 * - Firebase recommends removing tokens that consistently fail
 * - Tokens should be cleaned after 60-90 days of inactivity
 * - One token per device per user is the correct model
 */

import { connectWithModels } from "@/lib/db/connection";
import type { IFCMTokenDocument } from "@/lib/db/models/fcm-token";

// ============================================
// CONFIGURATION
// ============================================

/**
 * Default cleanup policies (can be overridden)
 */
export const DEFAULT_CLEANUP_POLICIES = {
  /** Days after which inactive tokens are deleted (default: 60 days) */
  INACTIVE_DAYS: 60,
  /** Days after which anonymous tokens (no user) are deleted (default: 7 days) */
  ANONYMOUS_DAYS: 7,
  /** Days after which tokens with max failures are deleted (default: 30 days) */
  FAILED_DAYS: 30,
  /** Max failure count before considering for deletion (default: 5) */
  MAX_FAILURES: 5,
  /** Days of inactivity for stale token cleanup (default: 90 days) */
  STALE_DAYS: 90,
} as const;

export interface CleanupPolicies {
  inactiveDays?: number;
  anonymousDays?: number;
  failedDays?: number;
  maxFailures?: number;
  staleDays?: number;
}

export interface CleanupResult {
  success: boolean;
  deleted: {
    invalidTokens: number;
    inactiveTokens: number;
    anonymousTokens: number;
    failedTokens: number;
    staleTokens: number;
    duplicates: number;
  };
  total: number;
  errors?: string[];
}

export interface CleanupStats {
  total: number;
  active: number;
  inactive: number;
  anonymous: number;
  withFailures: number;
  stale: number;
  duplicates: number;
}

// ============================================
// FIREBASE ERROR CODES
// ============================================

/**
 * Firebase error codes that indicate a token is permanently invalid
 * and should be deleted immediately (not just deactivated)
 */
export const PERMANENTLY_INVALID_ERROR_CODES = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/unregistered",
  "messaging/invalid-argument", // When token format is wrong
] as const;

/**
 * Check if an error code indicates permanent token invalidity
 */
export function isPermanentlyInvalidToken(errorCode: string): boolean {
  return PERMANENTLY_INVALID_ERROR_CODES.some(code => errorCode.includes(code));
}

// ============================================
// CLEANUP FUNCTIONS
// ============================================

/**
 * Run full cleanup with all policies
 */
export async function runFullCleanup(
  tenantDb: string,
  policies?: CleanupPolicies
): Promise<CleanupResult> {
  const config = {
    inactiveDays: policies?.inactiveDays ?? DEFAULT_CLEANUP_POLICIES.INACTIVE_DAYS,
    anonymousDays: policies?.anonymousDays ?? DEFAULT_CLEANUP_POLICIES.ANONYMOUS_DAYS,
    failedDays: policies?.failedDays ?? DEFAULT_CLEANUP_POLICIES.FAILED_DAYS,
    maxFailures: policies?.maxFailures ?? DEFAULT_CLEANUP_POLICIES.MAX_FAILURES,
    staleDays: policies?.staleDays ?? DEFAULT_CLEANUP_POLICIES.STALE_DAYS,
  };

  const errors: string[] = [];
  const deleted = {
    invalidTokens: 0,
    inactiveTokens: 0,
    anonymousTokens: 0,
    failedTokens: 0,
    staleTokens: 0,
    duplicates: 0,
  };

  try {
    // 1. Delete inactive tokens (is_active = false) older than threshold
    const inactiveResult = await deleteInactiveTokens(tenantDb, config.inactiveDays);
    deleted.inactiveTokens = inactiveResult;

    // 2. Delete anonymous tokens (no user_id) older than threshold
    const anonymousResult = await deleteAnonymousTokens(tenantDb, config.anonymousDays);
    deleted.anonymousTokens = anonymousResult;

    // 3. Delete tokens with max failures that are old
    const failedResult = await deleteFailedTokens(tenantDb, config.maxFailures, config.failedDays);
    deleted.failedTokens = failedResult;

    // 4. Delete stale tokens (no last_used_at or very old)
    const staleResult = await deleteStaleTokens(tenantDb, config.staleDays);
    deleted.staleTokens = staleResult;

    // 5. Remove duplicate tokens per device+user
    const duplicateResult = await removeDuplicateTokens(tenantDb);
    deleted.duplicates = duplicateResult;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    errors.push(errorMsg);
  }

  const total = Object.values(deleted).reduce((sum, val) => sum + val, 0);

  return {
    success: errors.length === 0,
    deleted,
    total,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Delete tokens marked as inactive for longer than specified days
 */
export async function deleteInactiveTokens(
  tenantDb: string,
  daysOld: number = DEFAULT_CLEANUP_POLICIES.INACTIVE_DAYS
): Promise<number> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await FCMToken.deleteMany({
    is_active: false,
    updated_at: { $lt: cutoffDate },
  });

  return result.deletedCount;
}

/**
 * Delete anonymous tokens (no user association) older than threshold
 * These are typically abandoned pre-login devices
 */
export async function deleteAnonymousTokens(
  tenantDb: string,
  daysOld: number = DEFAULT_CLEANUP_POLICIES.ANONYMOUS_DAYS
): Promise<number> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await FCMToken.deleteMany({
    $or: [
      { user_id: null },
      { user_id: { $exists: false } },
    ],
    created_at: { $lt: cutoffDate },
  });

  return result.deletedCount;
}

/**
 * Delete tokens that have reached max failures and are old
 */
export async function deleteFailedTokens(
  tenantDb: string,
  maxFailures: number = DEFAULT_CLEANUP_POLICIES.MAX_FAILURES,
  daysOld: number = DEFAULT_CLEANUP_POLICIES.FAILED_DAYS
): Promise<number> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await FCMToken.deleteMany({
    failure_count: { $gte: maxFailures },
    updated_at: { $lt: cutoffDate },
  });

  return result.deletedCount;
}

/**
 * Delete stale tokens that haven't been used recently
 */
export async function deleteStaleTokens(
  tenantDb: string,
  daysOld: number = DEFAULT_CLEANUP_POLICIES.STALE_DAYS
): Promise<number> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await FCMToken.deleteMany({
    $or: [
      // Tokens that have never been used and are old
      {
        last_used_at: { $exists: false },
        created_at: { $lt: cutoffDate },
      },
      // Tokens that haven't been used recently
      {
        last_used_at: { $lt: cutoffDate },
      },
    ],
  });

  return result.deletedCount;
}

/**
 * Remove duplicate tokens - keep only the most recent per device+user
 * This handles the case where token refresh creates new records instead of updating
 */
export async function removeDuplicateTokens(tenantDb: string): Promise<number> {
  const { FCMToken } = await connectWithModels(tenantDb);

  // Find duplicates: same user_id + device_id with multiple tokens
  const duplicates = await FCMToken.aggregate([
    {
      $match: {
        user_id: { $exists: true, $ne: null },
        device_id: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: { user_id: "$user_id", device_id: "$device_id" },
        count: { $sum: 1 },
        tokens: {
          $push: {
            token_id: "$token_id",
            is_active: "$is_active",
            failure_count: "$failure_count",
            last_used_at: "$last_used_at",
            updated_at: "$updated_at",
          },
        },
      },
    },
    {
      $match: {
        count: { $gt: 1 },
      },
    },
  ]);

  let deletedCount = 0;

  for (const group of duplicates) {
    const tokens = group.tokens as Array<{
      token_id: string;
      is_active: boolean;
      failure_count: number;
      last_used_at?: Date;
      updated_at: Date;
    }>;

    // Sort to keep the best token:
    // Priority: active > most recently used > most recently updated > lowest failure count
    tokens.sort((a, b) => {
      // Active tokens first
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      // Most recently used first
      if (a.last_used_at && b.last_used_at) {
        return new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime();
      }
      if (a.last_used_at) return -1;
      if (b.last_used_at) return 1;
      // Most recently updated first
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    // Keep the first token, delete the rest
    const tokensToDelete = tokens.slice(1).map(t => t.token_id);

    if (tokensToDelete.length > 0) {
      const result = await FCMToken.deleteMany({
        token_id: { $in: tokensToDelete },
      });
      deletedCount += result.deletedCount;
    }
  }

  return deletedCount;
}

/**
 * Immediately delete a permanently invalid token
 * Called from send logic when Firebase returns unrecoverable errors
 */
export async function deleteInvalidToken(
  tenantDb: string,
  tokenId: string
): Promise<boolean> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const result = await FCMToken.deleteOne({ token_id: tokenId });

  return result.deletedCount > 0;
}

/**
 * Immediately delete a permanently invalid token by FCM token string
 */
export async function deleteInvalidTokenByFCMToken(
  tenantDb: string,
  fcmToken: string
): Promise<boolean> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const result = await FCMToken.deleteOne({ fcm_token: fcmToken });

  return result.deletedCount > 0;
}

// ============================================
// STATISTICS & PREVIEW
// ============================================

/**
 * Get cleanup statistics without actually deleting
 * Useful for previewing what would be deleted
 */
export async function getCleanupStats(
  tenantDb: string,
  policies?: CleanupPolicies
): Promise<CleanupStats> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const config = {
    inactiveDays: policies?.inactiveDays ?? DEFAULT_CLEANUP_POLICIES.INACTIVE_DAYS,
    anonymousDays: policies?.anonymousDays ?? DEFAULT_CLEANUP_POLICIES.ANONYMOUS_DAYS,
    staleDays: policies?.staleDays ?? DEFAULT_CLEANUP_POLICIES.STALE_DAYS,
    maxFailures: policies?.maxFailures ?? DEFAULT_CLEANUP_POLICIES.MAX_FAILURES,
  };

  const now = new Date();
  const inactiveCutoff = new Date(now.getTime() - config.inactiveDays * 24 * 60 * 60 * 1000);
  const anonymousCutoff = new Date(now.getTime() - config.anonymousDays * 24 * 60 * 60 * 1000);
  const staleCutoff = new Date(now.getTime() - config.staleDays * 24 * 60 * 60 * 1000);

  const [stats] = await FCMToken.aggregate([
    {
      $facet: {
        total: [{ $count: "count" }],
        active: [{ $match: { is_active: true } }, { $count: "count" }],
        inactive: [
          { $match: { is_active: false, updated_at: { $lt: inactiveCutoff } } },
          { $count: "count" },
        ],
        anonymous: [
          {
            $match: {
              $or: [{ user_id: null }, { user_id: { $exists: false } }],
              created_at: { $lt: anonymousCutoff },
            },
          },
          { $count: "count" },
        ],
        withFailures: [
          { $match: { failure_count: { $gte: config.maxFailures } } },
          { $count: "count" },
        ],
        stale: [
          {
            $match: {
              $or: [
                { last_used_at: { $exists: false }, created_at: { $lt: staleCutoff } },
                { last_used_at: { $lt: staleCutoff } },
              ],
            },
          },
          { $count: "count" },
        ],
        duplicates: [
          {
            $match: {
              user_id: { $exists: true, $ne: null },
              device_id: { $exists: true, $ne: null },
            },
          },
          {
            $group: {
              _id: { user_id: "$user_id", device_id: "$device_id" },
              count: { $sum: 1 },
            },
          },
          { $match: { count: { $gt: 1 } } },
          {
            $group: {
              _id: null,
              duplicateCount: { $sum: { $subtract: ["$count", 1] } },
            },
          },
        ],
      },
    },
  ]);

  return {
    total: stats.total[0]?.count ?? 0,
    active: stats.active[0]?.count ?? 0,
    inactive: stats.inactive[0]?.count ?? 0,
    anonymous: stats.anonymous[0]?.count ?? 0,
    withFailures: stats.withFailures[0]?.count ?? 0,
    stale: stats.stale[0]?.count ?? 0,
    duplicates: stats.duplicates[0]?.duplicateCount ?? 0,
  };
}

// ============================================
// DEVICE-BASED REGISTRATION HELPER
// ============================================

/**
 * Register or update token using device_id as unique key per user
 * This is the recommended approach to prevent duplicates
 */
export async function registerOrUpdateByDevice(
  tenantDb: string,
  input: {
    tenant_id: string;
    user_id?: string;
    device_id: string;
    fcm_token: string;
    platform: "ios" | "android";
    device_model?: string;
    app_version?: string;
    os_version?: string;
    preferences?: {
      order_updates?: boolean;
      price_alerts?: boolean;
      marketing?: boolean;
      system?: boolean;
    };
  }
): Promise<IFCMTokenDocument> {
  const { FCMToken } = await connectWithModels(tenantDb);

  // Find existing token by device_id + user_id (or just device_id for anonymous)
  const query: Record<string, unknown> = {
    tenant_id: input.tenant_id,
    device_id: input.device_id,
  };

  if (input.user_id) {
    query.user_id = input.user_id;
  } else {
    query.$or = [{ user_id: null }, { user_id: { $exists: false } }];
  }

  const existingByDevice = await FCMToken.findOne(query);

  if (existingByDevice) {
    // Update existing record with new FCM token
    existingByDevice.fcm_token = input.fcm_token;
    existingByDevice.platform = input.platform;
    existingByDevice.device_model = input.device_model;
    existingByDevice.app_version = input.app_version;
    existingByDevice.os_version = input.os_version;
    existingByDevice.is_active = true;
    existingByDevice.failure_count = 0;

    if (input.preferences) {
      existingByDevice.preferences = {
        ...existingByDevice.preferences,
        ...input.preferences,
      };
    }

    await existingByDevice.save();
    return existingByDevice;
  }

  // Also check if the FCM token exists (in case device_id changed)
  const existingByToken = await FCMToken.findOne({
    tenant_id: input.tenant_id,
    fcm_token: input.fcm_token,
  });

  if (existingByToken) {
    // Update existing token record
    existingByToken.user_id = input.user_id;
    existingByToken.device_id = input.device_id;
    existingByToken.platform = input.platform;
    existingByToken.device_model = input.device_model;
    existingByToken.app_version = input.app_version;
    existingByToken.os_version = input.os_version;
    existingByToken.is_active = true;
    existingByToken.failure_count = 0;

    if (input.preferences) {
      existingByToken.preferences = {
        ...existingByToken.preferences,
        ...input.preferences,
      };
    }

    await existingByToken.save();
    return existingByToken;
  }

  // Create new token
  const token = new FCMToken({
    tenant_id: input.tenant_id,
    user_id: input.user_id,
    user_type: "portal_user",
    fcm_token: input.fcm_token,
    platform: input.platform,
    device_id: input.device_id,
    device_model: input.device_model,
    app_version: input.app_version,
    os_version: input.os_version,
    preferences: {
      order_updates: true,
      price_alerts: true,
      marketing: false,
      system: true,
      ...input.preferences,
    },
  });

  await token.save();
  return token;
}
