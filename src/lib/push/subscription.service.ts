/**
 * Push Subscription Service
 *
 * Manages push subscriptions for users.
 * Handles CRUD operations and preference management.
 */

import { connectWithModels } from "@/lib/db/connection";
import { getPushSubscriptionModel, type IPushSubscriptionDocument } from "@/lib/db/models/push-subscription";
import type {
  CreateSubscriptionInput,
  PushPreferences,
  PushUserType,
  DEFAULT_PUSH_PREFERENCES
} from "./types";

// ============================================
// SUBSCRIPTION CRUD
// ============================================

/**
 * Create or update a push subscription
 * If a subscription with the same endpoint exists, it will be updated
 */
export async function createSubscription(
  tenantDb: string,
  input: CreateSubscriptionInput
): Promise<IPushSubscriptionDocument> {
  const { PushSubscription } = await connectWithModels(tenantDb);

  // Check if subscription already exists for this endpoint
  const existing = await PushSubscription.findOne({
    tenant_id: input.tenant_id,
    endpoint: input.endpoint
  });

  if (existing) {
    // Update existing subscription
    existing.keys = input.keys;
    existing.user_id = input.user_id;
    existing.user_type = input.user_type;
    existing.customer_id = input.customer_id;
    existing.user_agent = input.user_agent;
    existing.device_type = input.device_type;
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

  // Create new subscription
  const subscription = new PushSubscription({
    tenant_id: input.tenant_id,
    user_id: input.user_id,
    user_type: input.user_type,
    customer_id: input.customer_id,
    endpoint: input.endpoint,
    keys: input.keys,
    user_agent: input.user_agent,
    device_type: input.device_type,
    preferences: {
      order_updates: true,
      price_alerts: true,
      marketing: false,
      system: true,
      ...input.preferences
    }
  });

  await subscription.save();
  return subscription;
}

/**
 * Get subscription by ID
 */
export async function getSubscription(
  tenantDb: string,
  subscriptionId: string
): Promise<IPushSubscriptionDocument | null> {
  const { PushSubscription } = await connectWithModels(tenantDb);
  return PushSubscription.findOne({ subscription_id: subscriptionId });
}

/**
 * Get subscription by endpoint
 */
export async function getSubscriptionByEndpoint(
  tenantDb: string,
  endpoint: string
): Promise<IPushSubscriptionDocument | null> {
  const { PushSubscription } = await connectWithModels(tenantDb);
  return PushSubscription.findOne({ endpoint });
}

/**
 * Get all subscriptions for a user
 */
export async function getSubscriptionsByUser(
  tenantDb: string,
  userId: string,
  activeOnly = true
): Promise<IPushSubscriptionDocument[]> {
  const { PushSubscription } = await connectWithModels(tenantDb);

  const query: Record<string, unknown> = { user_id: userId };
  if (activeOnly) {
    query.is_active = true;
  }

  return PushSubscription.find(query);
}

/**
 * Get all active subscriptions for a tenant
 */
export async function getActiveSubscriptions(
  tenantDb: string,
  options?: {
    preferenceType?: keyof PushPreferences;
    userIds?: string[];
    subscriptionIds?: string[];
    limit?: number;
  }
): Promise<IPushSubscriptionDocument[]> {
  const { PushSubscription } = await connectWithModels(tenantDb);

  const query: Record<string, unknown> = { is_active: true };

  // Filter by preference type
  if (options?.preferenceType) {
    query[`preferences.${options.preferenceType}`] = true;
  }

  // Filter by user IDs
  if (options?.userIds?.length) {
    query.user_id = { $in: options.userIds };
  }

  // Filter by subscription IDs
  if (options?.subscriptionIds?.length) {
    query.subscription_id = { $in: options.subscriptionIds };
  }

  let queryBuilder = PushSubscription.find(query);

  if (options?.limit) {
    queryBuilder = queryBuilder.limit(options.limit);
  }

  return queryBuilder;
}

/**
 * Deactivate a subscription by ID
 */
export async function deactivateSubscription(
  tenantDb: string,
  subscriptionId: string
): Promise<boolean> {
  const { PushSubscription } = await connectWithModels(tenantDb);

  const result = await PushSubscription.updateOne(
    { subscription_id: subscriptionId },
    { is_active: false }
  );

  return result.modifiedCount > 0;
}

/**
 * Deactivate a subscription by endpoint
 */
export async function deactivateSubscriptionByEndpoint(
  tenantDb: string,
  endpoint: string
): Promise<boolean> {
  const { PushSubscription } = await connectWithModels(tenantDb);

  const result = await PushSubscription.updateOne(
    { endpoint },
    { is_active: false }
  );

  return result.modifiedCount > 0;
}

/**
 * Delete a subscription permanently
 */
export async function deleteSubscription(
  tenantDb: string,
  subscriptionId: string
): Promise<boolean> {
  const { PushSubscription } = await connectWithModels(tenantDb);

  const result = await PushSubscription.deleteOne({
    subscription_id: subscriptionId
  });

  return result.deletedCount > 0;
}

/**
 * Delete a subscription by endpoint
 */
export async function deleteSubscriptionByEndpoint(
  tenantDb: string,
  endpoint: string
): Promise<boolean> {
  const { PushSubscription } = await connectWithModels(tenantDb);

  const result = await PushSubscription.deleteOne({ endpoint });

  return result.deletedCount > 0;
}

// ============================================
// PREFERENCES MANAGEMENT
// ============================================

/**
 * Update subscription preferences
 */
export async function updatePreferences(
  tenantDb: string,
  subscriptionId: string,
  preferences: Partial<PushPreferences>
): Promise<boolean> {
  const { PushSubscription } = await connectWithModels(tenantDb);

  const updateFields: Record<string, boolean> = {};
  Object.entries(preferences).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      updateFields[`preferences.${key}`] = value;
    }
  });

  const result = await PushSubscription.updateOne(
    { subscription_id: subscriptionId },
    { $set: updateFields }
  );

  return result.modifiedCount > 0;
}

/**
 * Get preferences for a subscription
 */
export async function getPreferences(
  tenantDb: string,
  subscriptionId: string
): Promise<PushPreferences | null> {
  const subscription = await getSubscription(tenantDb, subscriptionId);
  return subscription?.preferences || null;
}

/**
 * Update preferences for all subscriptions of a user
 */
export async function updateUserPreferences(
  tenantDb: string,
  userId: string,
  preferences: Partial<PushPreferences>
): Promise<number> {
  const { PushSubscription } = await connectWithModels(tenantDb);

  const updateFields: Record<string, boolean> = {};
  Object.entries(preferences).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      updateFields[`preferences.${key}`] = value;
    }
  });

  const result = await PushSubscription.updateMany(
    { user_id: userId },
    { $set: updateFields }
  );

  return result.modifiedCount;
}

// ============================================
// FAILURE TRACKING
// ============================================

/**
 * Increment failure count for a subscription
 * Deactivates after MAX_FAILURES (5)
 */
export async function incrementFailureCount(
  tenantDb: string,
  subscriptionId: string
): Promise<void> {
  const { PushSubscription } = await connectWithModels(tenantDb);

  const MAX_FAILURES = 5;

  const subscription = await PushSubscription.findOneAndUpdate(
    { subscription_id: subscriptionId },
    { $inc: { failure_count: 1 } },
    { new: true }
  );

  if (subscription && subscription.failure_count >= MAX_FAILURES) {
    await PushSubscription.updateOne(
      { subscription_id: subscriptionId },
      { is_active: false }
    );
  }
}

/**
 * Reset failure count (called on successful push)
 */
export async function resetFailureCount(
  tenantDb: string,
  subscriptionId: string
): Promise<void> {
  const { PushSubscription } = await connectWithModels(tenantDb);

  await PushSubscription.updateOne(
    { subscription_id: subscriptionId },
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
 * Get subscription statistics for a tenant
 */
export async function getSubscriptionStats(
  tenantDb: string
): Promise<{
  total: number;
  active: number;
  byUserType: Record<PushUserType | "unknown", number>;
  byDeviceType: Record<string, number>;
}> {
  const { PushSubscription } = await connectWithModels(tenantDb);

  const [stats] = await PushSubscription.aggregate([
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
        anonymous: {
          $sum: { $cond: [{ $eq: ["$user_type", "anonymous"] }, 1, 0] }
        },
        desktop: {
          $sum: { $cond: [{ $eq: ["$device_type", "desktop"] }, 1, 0] }
        },
        mobile: {
          $sum: { $cond: [{ $eq: ["$device_type", "mobile"] }, 1, 0] }
        },
        tablet: {
          $sum: { $cond: [{ $eq: ["$device_type", "tablet"] }, 1, 0] }
        }
      }
    }
  ]);

  if (!stats) {
    return {
      total: 0,
      active: 0,
      byUserType: { b2b_user: 0, portal_user: 0, anonymous: 0, unknown: 0 },
      byDeviceType: { desktop: 0, mobile: 0, tablet: 0, unknown: 0 }
    };
  }

  return {
    total: stats.total,
    active: stats.active,
    byUserType: {
      b2b_user: stats.b2b_user,
      portal_user: stats.portal_user,
      anonymous: stats.anonymous,
      unknown: stats.total - stats.b2b_user - stats.portal_user - stats.anonymous
    },
    byDeviceType: {
      desktop: stats.desktop,
      mobile: stats.mobile,
      tablet: stats.tablet,
      unknown: stats.total - stats.desktop - stats.mobile - stats.tablet
    }
  };
}
