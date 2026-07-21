/**
 * Subscription Plan Service
 *
 * CRUD + validation for channel-scoped subscription plans (tiers).
 * Mirrors the coupon service conventions (ServiceResult, connectWithModels).
 */

import { connectWithModels } from "@/lib/db/connection";
import { isValidChannelCode } from "@/lib/constants/channel";
import {
  isBillingInterval,
  isMetricAggregation,
  isPlanKind,
  isCheckoutMode,
  isPlanStatus,
} from "@/lib/constants/subscription";
import type {
  CreatePlanRequest,
  UpdatePlanRequest,
  ISubscriptionPlan,
  PlanStatus,
} from "@/lib/types/subscription";
import type { ServiceResult } from "./order.service";

function validatePricing(
  billingOptions: CreatePlanRequest["billing_options"],
  metrics: CreatePlanRequest["metrics"]
): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(billingOptions) || billingOptions.length === 0) {
    return { ok: false, error: "At least one billing option is required" };
  }
  const seenIntervals = new Set<string>();
  for (const opt of billingOptions) {
    if (!isBillingInterval(opt.interval)) {
      return { ok: false, error: `Invalid billing interval: ${opt.interval}` };
    }
    if (typeof opt.base_price !== "number" || opt.base_price < 0) {
      return { ok: false, error: "base_price must be a non-negative number" };
    }
    // One price per cadence: interval+count identifies the billing option
    const cadence = `${opt.interval}x${opt.interval_count ?? 1}`;
    if (seenIntervals.has(cadence)) {
      return { ok: false, error: `Duplicate billing option for interval: ${opt.interval}` };
    }
    seenIntervals.add(cadence);
  }
  const seenMetricKeys = new Set<string>();
  for (const m of metrics ?? []) {
    if (!m.metric_key || typeof m.metric_key !== "string") {
      return { ok: false, error: "Each metric requires a metric_key" };
    }
    if (seenMetricKeys.has(m.metric_key)) {
      return { ok: false, error: `Duplicate metric_key: ${m.metric_key}` };
    }
    seenMetricKeys.add(m.metric_key);
    if (typeof m.included_quantity !== "number" || m.included_quantity < 0) {
      return { ok: false, error: "included_quantity must be a non-negative number" };
    }
    if (typeof m.overage_unit_price !== "number" || m.overage_unit_price < 0) {
      return { ok: false, error: "overage_unit_price must be a non-negative number" };
    }
    if (m.hard_cap != null && (typeof m.hard_cap !== "number" || m.hard_cap < 0)) {
      return { ok: false, error: "hard_cap must be a non-negative number or null" };
    }
    if (m.aggregation !== undefined && !isMetricAggregation(m.aggregation)) {
      return { ok: false, error: `Invalid metric aggregation: ${m.aggregation}` };
    }
  }
  return { ok: true };
}

/**
 * Validate the optional enum + bound fields shared by create and update.
 * Rejecting here keeps invalid input a clean 400 instead of a Mongoose
 * ValidationError surfacing as a 500 from the route's catch-all.
 */
function validatePlanOptions(
  data: Pick<UpdatePlanRequest, "kind" | "checkout_mode" | "status" | "trial_days">
): { ok: true } | { ok: false; error: string } {
  if (data.kind !== undefined && !isPlanKind(data.kind)) {
    return { ok: false, error: `Invalid plan kind: ${data.kind}` };
  }
  if (data.checkout_mode !== undefined && !isCheckoutMode(data.checkout_mode)) {
    return { ok: false, error: `Invalid checkout mode: ${data.checkout_mode}` };
  }
  if (data.status !== undefined && !isPlanStatus(data.status)) {
    return { ok: false, error: `Invalid plan status: ${data.status}` };
  }
  if (data.trial_days != null && (typeof data.trial_days !== "number" || data.trial_days < 0)) {
    return { ok: false, error: "trial_days must be a non-negative number or null" };
  }
  return { ok: true };
}

export async function createSubscriptionPlan(
  tenantDb: string,
  data: CreatePlanRequest
): Promise<ServiceResult<ISubscriptionPlan>> {
  const { SubscriptionPlan } = await connectWithModels(tenantDb);

  const channel = (data.channel || "").trim().toLowerCase();
  if (!channel || !isValidChannelCode(channel)) {
    return { success: false, error: "A valid channel code is required", status: 400 };
  }
  const code = (data.code || "").trim().toLowerCase();
  if (!code) {
    return { success: false, error: "Plan code is required", status: 400 };
  }
  if (!data.name) {
    return { success: false, error: "Plan name is required", status: 400 };
  }

  const pricing = validatePricing(data.billing_options, data.metrics);
  if (!pricing.ok) {
    return { success: false, error: pricing.error, status: 400 };
  }
  const options = validatePlanOptions(data);
  if (!options.ok) {
    return { success: false, error: options.error, status: 400 };
  }

  const existing = await SubscriptionPlan.findOne({ channel, code }).lean();
  if (existing) {
    return { success: false, error: "A plan with this code already exists for this channel", status: 409 };
  }

  const plan = await SubscriptionPlan.create({
    channel,
    code,
    name: data.name,
    description: data.description,
    feature_bullets: data.feature_bullets ?? [],
    is_featured: data.is_featured ?? false,
    public: data.public ?? false,
    sort_order: data.sort_order ?? 0,
    currency: data.currency ?? "EUR",
    billing_options: data.billing_options.map((o) => ({
      interval: o.interval,
      interval_count: o.interval_count ?? 1,
      base_price: o.base_price,
    })),
    metrics: (data.metrics ?? []).map((m) => ({
      metric_key: m.metric_key,
      label: m.label,
      included_quantity: m.included_quantity ?? 0,
      overage_unit_price: m.overage_unit_price ?? 0,
      hard_cap: m.hard_cap ?? null,
      aggregation: m.aggregation ?? "sum",
    })),
    trial_days: data.trial_days ?? null,
    sandbox_included: data.sandbox_included ?? false,
    entitlements: data.entitlements ?? {},
    kind: data.kind ?? "standard",
    checkout_mode: data.checkout_mode ?? "self_serve",
    status: data.status ?? "active",
  });

  return { success: true, data: plan.toObject() as ISubscriptionPlan };
}

export async function getSubscriptionPlan(
  tenantDb: string,
  planId: string
): Promise<ServiceResult<ISubscriptionPlan>> {
  const { SubscriptionPlan } = await connectWithModels(tenantDb);
  const plan = (await SubscriptionPlan.findOne({ plan_id: planId }).lean()) as ISubscriptionPlan | null;
  if (!plan) {
    return { success: false, error: "Plan not found", status: 404 };
  }
  return { success: true, data: plan };
}

export async function updateSubscriptionPlan(
  tenantDb: string,
  planId: string,
  data: UpdatePlanRequest
): Promise<ServiceResult<ISubscriptionPlan>> {
  const { SubscriptionPlan } = await connectWithModels(tenantDb);
  const plan = await SubscriptionPlan.findOne({ plan_id: planId });
  if (!plan) {
    return { success: false, error: "Plan not found", status: 404 };
  }

  // Mirror create's required-field guards: reject blanking rather than
  // letting schema `required` fail on save() (which would surface as a 500)
  const nextChannel = (data.channel ?? plan.channel).trim().toLowerCase();
  const nextCode = (data.code ?? plan.code).trim().toLowerCase();
  if (data.channel !== undefined && !isValidChannelCode(nextChannel)) {
    return { success: false, error: "A valid channel code is required", status: 400 };
  }
  if (data.code !== undefined && !nextCode) {
    return { success: false, error: "Plan code is required", status: 400 };
  }
  if ("name" in data && !data.name) {
    return { success: false, error: "Plan name is required", status: 400 };
  }
  const options = validatePlanOptions(data);
  if (!options.ok) {
    return { success: false, error: options.error, status: 400 };
  }
  if (data.channel !== undefined || data.code !== undefined) {
    const clash = await SubscriptionPlan.findOne({
      channel: nextChannel,
      code: nextCode,
      plan_id: { $ne: planId },
    }).lean();
    if (clash) {
      return { success: false, error: "A plan with this code already exists for this channel", status: 409 };
    }
  }

  if (data.billing_options !== undefined || data.metrics !== undefined) {
    const pricing = validatePricing(
      data.billing_options ?? (plan.billing_options as CreatePlanRequest["billing_options"]),
      data.metrics ?? (plan.metrics as CreatePlanRequest["metrics"])
    );
    if (!pricing.ok) {
      return { success: false, error: pricing.error, status: 400 };
    }
  }

  const assignable: (keyof UpdatePlanRequest)[] = [
    "name", "description", "feature_bullets", "is_featured", "public",
    "sort_order", "currency", "billing_options", "metrics", "trial_days",
    "sandbox_included", "entitlements", "kind", "checkout_mode", "status",
  ];
  for (const field of assignable) {
    if (data[field] !== undefined) {
      (plan as Record<string, unknown>)[field] = data[field];
    }
  }
  if (data.channel !== undefined) plan.channel = nextChannel;
  if (data.code !== undefined) plan.code = nextCode;

  await plan.save();
  return { success: true, data: plan.toObject() as ISubscriptionPlan };
}

export async function deleteSubscriptionPlan(
  tenantDb: string,
  planId: string
): Promise<ServiceResult> {
  const { SubscriptionPlan } = await connectWithModels(tenantDb);
  const result = await SubscriptionPlan.deleteOne({ plan_id: planId });
  if (result.deletedCount === 0) {
    return { success: false, error: "Plan not found", status: 404 };
  }
  return { success: true };
}

export async function listSubscriptionPlans(
  tenantDb: string,
  filters: {
    page?: number;
    limit?: number;
    status?: PlanStatus;
    channel?: string;
    search?: string;
  }
): Promise<
  ServiceResult<{
    items: ISubscriptionPlan[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>
> {
  const { SubscriptionPlan } = await connectWithModels(tenantDb);
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};
  if (filters.status) query.status = filters.status;
  if (filters.channel) query.channel = filters.channel.trim().toLowerCase();
  if (filters.search) {
    const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.code = new RegExp(escaped, "i");
  }

  const [items, total] = await Promise.all([
    SubscriptionPlan.find(query)
      .sort({ sort_order: 1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean() as Promise<ISubscriptionPlan[]>,
    SubscriptionPlan.countDocuments(query),
  ]);

  return {
    success: true,
    data: {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  };
}
