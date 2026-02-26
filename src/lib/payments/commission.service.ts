/**
 * Commission Service
 *
 * Calculates and records platform commissions on transactions.
 * Uses tenant-specific commission rates from TenantPaymentConfig.
 */

import mongoose from "mongoose";
import { getModelRegistry } from "@/lib/db/model-registry";
import { PAYMENT_DEFAULTS } from "@/lib/constants/payment";
import type { CommissionBreakdown } from "@/lib/types/payment";

// ============================================
// COMMISSION CALCULATION
// ============================================

/**
 * Calculate commission breakdown for a given amount and rate.
 */
export function calculateCommission(
  grossAmount: number,
  commissionRate: number,
  currency: string = PAYMENT_DEFAULTS.CURRENCY
): CommissionBreakdown {
  const commissionAmount = Math.round(grossAmount * commissionRate * 100) / 100;
  const netAmount = Math.round((grossAmount - commissionAmount) * 100) / 100;

  return {
    gross_amount: grossAmount,
    commission_rate: commissionRate,
    commission_amount: commissionAmount,
    net_amount: netAmount,
    currency,
  };
}

// ============================================
// TENANT COMMISSION RATE
// ============================================

/**
 * Get commission rate for a tenant.
 * Falls back to default rate if no config found.
 */
export async function getTenantCommissionRate(
  tenantDb: mongoose.Connection,
  tenantId: string
): Promise<number> {
  const registry = getModelRegistry(tenantDb);
  const TenantPaymentConfig = registry.TenantPaymentConfig;

  if (!TenantPaymentConfig) {
    return PAYMENT_DEFAULTS.COMMISSION_RATE;
  }

  const config = await TenantPaymentConfig.findOne({ tenant_id: tenantId })
    .select("commission_rate")
    .lean();

  return config?.commission_rate ?? PAYMENT_DEFAULTS.COMMISSION_RATE;
}

// ============================================
// RECORD COMMISSION
// ============================================

/**
 * Record a commission entry after a successful payment.
 * Updates the transaction with commission data.
 */
export async function recordCommission(
  tenantDb: mongoose.Connection,
  transactionId: string,
  commission: CommissionBreakdown
): Promise<void> {
  const registry = getModelRegistry(tenantDb);
  const PaymentTransaction = registry.PaymentTransaction;

  if (!PaymentTransaction) {
    throw new Error("PaymentTransaction model not registered");
  }

  await PaymentTransaction.updateOne(
    { transaction_id: transactionId },
    {
      $set: {
        commission_rate: commission.commission_rate,
        commission_amount: commission.commission_amount,
        net_amount: commission.net_amount,
      },
    }
  );
}

// ============================================
// COMMISSION QUERIES
// ============================================

/**
 * Get total pending commissions for a tenant.
 */
export async function getTenantCommissionSummary(
  tenantDb: mongoose.Connection,
  tenantId: string
): Promise<{
  total_collected: number;
  total_pending: number;
  transaction_count: number;
}> {
  const registry = getModelRegistry(tenantDb);
  const PaymentTransaction = registry.PaymentTransaction;

  if (!PaymentTransaction) {
    return { total_collected: 0, total_pending: 0, transaction_count: 0 };
  }

  const result = await PaymentTransaction.aggregate([
    { $match: { tenant_id: tenantId, status: "completed" } },
    {
      $group: {
        _id: null,
        total_collected: { $sum: "$commission_amount" },
        total_gross: { $sum: "$gross_amount" },
        transaction_count: { $sum: 1 },
      },
    },
  ]);

  if (!result.length) {
    return { total_collected: 0, total_pending: 0, transaction_count: 0 };
  }

  return {
    total_collected: result[0].total_collected,
    total_pending: 0, // TODO: track payout status
    transaction_count: result[0].transaction_count,
  };
}
