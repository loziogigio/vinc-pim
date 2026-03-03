/**
 * Trigger Dispatch Service
 *
 * Generic notification dispatch — the single entry point for all
 * event-driven notifications. Currently handles order events;
 * extensible for bookings, subscriptions, etc.
 *
 * Design: fire-and-forget from API routes — never blocks operations.
 * All errors are caught and logged internally.
 */

import type { IOrder } from "@/lib/db/models/order";
import type { NotificationTrigger } from "@/lib/constants/notification";
import type { NotificationUserType } from "@/lib/db/models/notification";
import { dispatchOrderNotification } from "./order-notification.service";

// ============================================
// TRIGGER CONTEXT TYPES
// ============================================

interface OrderTriggerContext {
  type: "order";
  order: IOrder;
  portalUserId?: string;
  userType?: NotificationUserType;
}

interface PaymentTriggerContext {
  type: "payment";
  order: IOrder;
  paymentAmount?: number;
  paymentMethod?: string;
  portalUserId?: string;
  userType?: NotificationUserType;
}

// Future: BookingTriggerContext, SubscriptionTriggerContext, etc.

export type TriggerContext = OrderTriggerContext | PaymentTriggerContext;

// ============================================
// DISPATCH
// ============================================

/**
 * Fire-and-forget notification dispatch.
 *
 * Catches all errors internally — never throws.
 * Safe to call with `void dispatchTrigger(...)`.
 *
 * @example
 * ```ts
 * // In API route, after successful lifecycle operation:
 * void dispatchTrigger(dbName, "order_confirmation", {
 *   type: "order",
 *   order: result.order!,
 *   portalUserId: auth.userId || undefined,
 * });
 * ```
 */
export async function dispatchTrigger(
  tenantDb: string,
  trigger: NotificationTrigger,
  context: TriggerContext
): Promise<void> {
  try {
    switch (context.type) {
      case "order":
      case "payment":
        await dispatchOrderNotification(tenantDb, trigger, context.order, {
          portalUserId: context.portalUserId,
          userType: context.userType,
          paymentAmount: context.type === "payment" ? context.paymentAmount : undefined,
          paymentMethod: context.type === "payment" ? context.paymentMethod : undefined,
        });
        break;

      default:
        console.warn(`[TriggerDispatch] Unknown context type, skipping`);
    }
  } catch (error) {
    console.error(`[TriggerDispatch] Failed to dispatch ${trigger}:`, error);
  }
}
