/**
 * FCM Token Service
 *
 * Manages FCM tokens for mobile app users.
 * Handles CRUD operations and preference management.
 */

import { connectWithModels } from "@/lib/db/connection";
import type { IFCMTokenDocument } from "@/lib/db/models/fcm-token";
import type {
  RegisterFCMTokenInput,
  FCMPreferences,
  FCMUserType,
  FCMPlatform
} from "./types";

// ============================================
// TOKEN CRUD
// ============================================

/**
 * Register or update an FCM token
 * If a token with the same fcm_token exists, it will be updated
 */
export async function registerToken(
  tenantDb: string,
  input: RegisterFCMTokenInput
): Promise<IFCMTokenDocument> {
  const { FCMToken } = await connectWithModels(tenantDb);

  // Check if token already exists
  const existing = await FCMToken.findOne({
    tenant_id: input.tenant_id,
    fcm_token: input.fcm_token
  });

  if (existing) {
    // Update existing token
    existing.user_id = input.user_id;
    existing.user_type = input.user_type || "portal_user";
    existing.customer_id = input.customer_id;
    existing.platform = input.platform;
    existing.device_id = input.device_id;
    existing.device_model = input.device_model;
    existing.app_version = input.app_version;
    existing.os_version = input.os_version;
    existing.is_active = true;
    existing.failure_count = 0;

    if (input.preferences) {
      existing.preferences = {
        ...existing.preferences,
        ...input.preferences
      };
    }

    await existing.save();
    return existing;
  }

  // Create new token
  const token = new FCMToken({
    tenant_id: input.tenant_id,
    user_id: input.user_id,
    user_type: input.user_type || "portal_user",
    customer_id: input.customer_id,
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
      ...input.preferences
    }
  });

  await token.save();
  return token;
}

/**
 * Get token by ID
 */
export async function getToken(
  tenantDb: string,
  tokenId: string
): Promise<IFCMTokenDocument | null> {
  const { FCMToken } = await connectWithModels(tenantDb);
  return FCMToken.findOne({ token_id: tokenId });
}

/**
 * Get token by FCM token string
 */
export async function getTokenByFCMToken(
  tenantDb: string,
  fcmToken: string
): Promise<IFCMTokenDocument | null> {
  const { FCMToken } = await connectWithModels(tenantDb);
  return FCMToken.findOne({ fcm_token: fcmToken });
}

/**
 * Get all tokens for a user
 */
export async function getTokensByUser(
  tenantDb: string,
  userId: string,
  activeOnly = true
): Promise<IFCMTokenDocument[]> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const query: Record<string, unknown> = { user_id: userId };
  if (activeOnly) {
    query.is_active = true;
  }

  return FCMToken.find(query);
}

/**
 * Get all active tokens for a tenant
 */
export async function getActiveTokens(
  tenantDb: string,
  options?: {
    preferenceType?: keyof FCMPreferences;
    userIds?: string[];
    tokenIds?: string[];
    platform?: FCMPlatform;
    limit?: number;
  }
): Promise<IFCMTokenDocument[]> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const query: Record<string, unknown> = { is_active: true };

  // Filter by preference type
  if (options?.preferenceType) {
    query[`preferences.${options.preferenceType}`] = true;
  }

  // Filter by user IDs
  if (options?.userIds?.length) {
    query.user_id = { $in: options.userIds };
  }

  // Filter by token IDs
  if (options?.tokenIds?.length) {
    query.token_id = { $in: options.tokenIds };
  }

  // Filter by platform
  if (options?.platform) {
    query.platform = options.platform;
  }

  let queryBuilder = FCMToken.find(query);

  if (options?.limit) {
    queryBuilder = queryBuilder.limit(options.limit);
  }

  return queryBuilder;
}

/**
 * Deactivate a token by ID
 */
export async function deactivateToken(
  tenantDb: string,
  tokenId: string
): Promise<boolean> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const result = await FCMToken.updateOne(
    { token_id: tokenId },
    { is_active: false }
  );

  return result.modifiedCount > 0;
}

/**
 * Deactivate a token by FCM token string
 */
export async function deactivateTokenByFCMToken(
  tenantDb: string,
  fcmToken: string
): Promise<boolean> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const result = await FCMToken.updateOne(
    { fcm_token: fcmToken },
    { is_active: false }
  );

  return result.modifiedCount > 0;
}

/**
 * Delete a token permanently
 */
export async function deleteToken(
  tenantDb: string,
  tokenId: string
): Promise<boolean> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const result = await FCMToken.deleteOne({
    token_id: tokenId
  });

  return result.deletedCount > 0;
}

/**
 * Delete a token by FCM token string
 */
export async function deleteTokenByFCMToken(
  tenantDb: string,
  fcmToken: string
): Promise<boolean> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const result = await FCMToken.deleteOne({ fcm_token: fcmToken });

  return result.deletedCount > 0;
}

/**
 * Delete all tokens for a user (logout from all devices)
 */
export async function deleteAllUserTokens(
  tenantDb: string,
  userId: string
): Promise<number> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const result = await FCMToken.deleteMany({ user_id: userId });

  return result.deletedCount;
}

// ============================================
// PREFERENCES MANAGEMENT
// ============================================

/**
 * Update token preferences
 */
export async function updatePreferences(
  tenantDb: string,
  tokenId: string,
  preferences: Partial<FCMPreferences>
): Promise<boolean> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const updateFields: Record<string, boolean> = {};
  Object.entries(preferences).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      updateFields[`preferences.${key}`] = value;
    }
  });

  const result = await FCMToken.updateOne(
    { token_id: tokenId },
    { $set: updateFields }
  );

  return result.modifiedCount > 0;
}

/**
 * Get preferences for a token
 */
export async function getPreferences(
  tenantDb: string,
  tokenId: string
): Promise<FCMPreferences | null> {
  const token = await getToken(tenantDb, tokenId);
  return token?.preferences || null;
}

/**
 * Update preferences for all tokens of a user
 */
export async function updateUserPreferences(
  tenantDb: string,
  userId: string,
  preferences: Partial<FCMPreferences>
): Promise<number> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const updateFields: Record<string, boolean> = {};
  Object.entries(preferences).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      updateFields[`preferences.${key}`] = value;
    }
  });

  const result = await FCMToken.updateMany(
    { user_id: userId },
    { $set: updateFields }
  );

  return result.modifiedCount;
}

// ============================================
// FAILURE TRACKING
// ============================================

/**
 * Increment failure count for a token
 * Deactivates after MAX_FAILURES (5)
 */
export async function incrementFailureCount(
  tenantDb: string,
  tokenId: string
): Promise<void> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const MAX_FAILURES = 5;

  const token = await FCMToken.findOneAndUpdate(
    { token_id: tokenId },
    { $inc: { failure_count: 1 } },
    { new: true }
  );

  if (token && token.failure_count >= MAX_FAILURES) {
    await FCMToken.updateOne(
      { token_id: tokenId },
      { is_active: false }
    );
  }
}

/**
 * Reset failure count (called on successful push)
 */
export async function resetFailureCount(
  tenantDb: string,
  tokenId: string
): Promise<void> {
  const { FCMToken } = await connectWithModels(tenantDb);

  await FCMToken.updateOne(
    { token_id: tokenId },
    {
      failure_count: 0,
      last_used_at: new Date()
    }
  );
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get token statistics for a tenant
 */
export async function getTokenStats(
  tenantDb: string
): Promise<{
  total: number;
  active: number;
  byUserType: Record<FCMUserType, number>;
  byPlatform: Record<FCMPlatform, number>;
}> {
  const { FCMToken } = await connectWithModels(tenantDb);

  const [stats] = await FCMToken.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ["$is_active", true] }, 1, 0] }
        },
        b2b_user: {
          $sum: { $cond: [{ $eq: ["$user_type", "b2b_user"] }, 1, 0] }
        },
        portal_user: {
          $sum: { $cond: [{ $eq: ["$user_type", "portal_user"] }, 1, 0] }
        },
        ios: {
          $sum: { $cond: [{ $eq: ["$platform", "ios"] }, 1, 0] }
        },
        android: {
          $sum: { $cond: [{ $eq: ["$platform", "android"] }, 1, 0] }
        }
      }
    }
  ]);

  if (!stats) {
    return {
      total: 0,
      active: 0,
      byUserType: { b2b_user: 0, portal_user: 0 },
      byPlatform: { ios: 0, android: 0 }
    };
  }

  return {
    total: stats.total,
    active: stats.active,
    byUserType: {
      b2b_user: stats.b2b_user,
      portal_user: stats.portal_user
    },
    byPlatform: {
      ios: stats.ios,
      android: stats.android
    }
  };
}
